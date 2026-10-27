import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { ActivityCode } from 'src/activity/enums/activity-code.enum';
import { Filter } from 'src/utilities/filter';
import { FileTransfer } from 'src/utilities/file.transfer';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { checkGroupPermission } from 'src/utilities/permissions.guard';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import type Redis from 'ioredis';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { InvoiceEntity, InvoiceFor, InvoiceStatus } from '../entity/invoice.entity';
import { InvoiceItemEntity, TaxCalculation } from '../entity/invoice.item.entity';
import { InvoiceDiscountEntity } from '../entity/invoice.discount.entity';
import { InvoiceExtraChargeEntity } from '../entity/invoice.extra.charge.entity';
import { InvoiceAttachmentsEntity } from '../entity/invoice.attachments';
import { InvoiceDueDateHistoryEntity } from '../entity/invoice.due.date.history.entity';
import { OrderEntity, OrderStatus, OrderLifecycleStatus, InvoiceAutoApproval, InvoiceGenerationOn } from 'src/order/entity/order.entity';
import { QuotationEntity, QuotationStatus } from 'src/quotation/entity/quotation.entity';
import {
  InvoiceDiscountInputDto,
  InvoiceDto,
  InvoiceExtraChargeInputDto,
  InvoiceItemInputDto,
  InvoiceListDto,
  InvoiceUpdateDto,
  InvoiceUpdateDueDateDto,
  VaultPaymentBodyDto,
} from '../dto/invoice.dto';
import { InvoicePdfService } from '../invoice.pdf.service';
import { VaultService } from 'src/vault/vault.service';
import { ModSettings } from 'src/user/entity/mod.settings';

interface ComputedItemAmounts {
  totalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  finalAmount: number;
}

interface ComputedInvoiceTotals {
  totalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  discount: number;
  extraCharge: number;
  vatWithheldAmount: number;
  finalAmount: number;
}

type TaxValidationResult =
  | { valid: true; rateMap: Map<string, number> }
  | { valid: false; message: string };

@Injectable()
export class InvoiceService {
  private readonly dataSource: DataSource;

  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,

    @InjectRepository(InvoiceItemEntity)
    private readonly invoiceItemRepo: Repository<InvoiceItemEntity>,

    @InjectRepository(InvoiceDiscountEntity)
    private readonly discountRepo: Repository<InvoiceDiscountEntity>,

    @InjectRepository(InvoiceExtraChargeEntity)
    private readonly extraChargeRepo: Repository<InvoiceExtraChargeEntity>,

    @InjectRepository(InvoiceAttachmentsEntity)
    private readonly attachmentRepo: Repository<InvoiceAttachmentsEntity>,

    @InjectRepository(InvoiceDueDateHistoryEntity)
    private readonly dueDateHistoryRepo: Repository<InvoiceDueDateHistoryEntity>,

    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,

    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,

    @InjectRepository(CurrencyEntity)
    private readonly currencyRepo: Repository<CurrencyEntity>,

    @InjectRepository(taxGroupEntity)
    private readonly taxGroupRepo: Repository<taxGroupEntity>,

    @InjectRepository(QuotationEntity)
    private readonly quotationRepo: Repository<QuotationEntity>,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,

    @InjectRepository(ModSettings)
    private readonly modSettingsRepo: Repository<ModSettings>,

    @InjectRepository(GroupPermissionEntity)
    private readonly gpRepo: Repository<GroupPermissionEntity>,

    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,

    private readonly vaultService: VaultService,
    private readonly filter: Filter,
    private readonly fileTransfer: FileTransfer,
    private readonly eventEmitter: EventEmitter2,
    private readonly invoicePdfService: InvoicePdfService,
  ) {
    this.dataSource = this.invoiceRepo.manager.connection;
  }

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;

  private async hasUserPermission(
    authCtx: any,
    permission: string,
  ): Promise<boolean> {
    if (authCtx?.isSuperAdmin) return true;
    if (!authCtx?.activeGroupId) return false;
    return checkGroupPermission(
      authCtx.activeGroupId,
      permission,
      this.gpRepo,
      this.redis,
    );
  }

  private resolvePerformer(req: any, fallbackId?: number) {
    const performerId: number | undefined = req?.user?.isImpersonation
      ? req?.user?.userId
      : (req?.user?.userId ?? fallbackId);
    const performerEmail: string = req?.user?.isImpersonation
      ? (req?.user?.email ?? '')
      : (req?.user?.email ?? '');
    return { performerId, performerEmail };
  } 

  private toValidNumber(val: any, fallback: number = 0): number {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  }

  private toOptionalNumber(val: any): number | undefined {
    if (
      val === undefined ||
      val === null ||
      val === '' ||
      val === 'undefined' ||
      val === 'null'
    )
      return undefined;
    const n = Number(val);
    return isNaN(n) ? undefined : n;
  }

  private async validateTaxGroups(
    items: InvoiceItemInputDto[],
    companyId: number,
  ): Promise<TaxValidationResult> {
    const invalidCodes: string[] = [];
    const rateMap = new Map<string, number>();

    for (const item of items) {
      if (item.taxCalculation === TaxCalculation.NA || !item.taxGroup) continue;
      if (rateMap.has(item.taxGroup)) continue;

      const rec = await this.taxGroupRepo.findOne({
        where: { taxCode: item.taxGroup, companyId },
      });

      if (!rec) {
        invalidCodes.push(item.taxGroup);
      } else {
        rateMap.set(item.taxGroup, Number(rec.taxValue));
      }
    }

    if (invalidCodes.length > 0) {
      return {
        valid: false,
        message: `Invalid tax group code(s) for this company: ${invalidCodes.join(', ')}`,
      };
    }
    return { valid: true, rateMap };
  }

  private computeItemAmounts(
    item: InvoiceItemInputDto,
    taxRate: number,
  ): ComputedItemAmounts {
    const qty = this.toValidNumber(item.quantity, 0);
    const up = this.toValidNumber(item.unitPrice, 0);
    const rawAmount = qty * up;
    const itemDiscount = (item.discounts ?? []).reduce(
      (s, d) => s + this.toValidNumber(d.discountPrice, 0),
      0,
    );
    const itemExtraCharge = (item.extraCharges ?? []).reduce(
      (s, ec) => s + this.toValidNumber(ec.extraChargesPrice, 0),
      0,
    );
    const totalAmount = Math.max(0, rawAmount - itemDiscount + itemExtraCharge);
    const validRate = this.toValidNumber(taxRate, 0);
    let taxableAmount = 0;
    let taxAmount = 0;
    let finalAmount = totalAmount;

    if (item.taxCalculation === TaxCalculation.INCLUSIVE) {
      taxableAmount = validRate > 0 ? totalAmount / (1 + validRate / 100) : totalAmount;
      taxAmount = totalAmount - taxableAmount;
      taxAmount = Math.round(taxAmount * 10000) / 10000;
      taxableAmount = Math.round(taxableAmount * 10000) / 10000;
      finalAmount = totalAmount;
    } else if (item.taxCalculation === TaxCalculation.EXCLUSIVE) {
      taxableAmount = totalAmount;
      taxAmount = Math.round(((taxableAmount * validRate) / 100) * 10000) / 10000;
      finalAmount = totalAmount + (isNaN(taxAmount) ? 0 : taxAmount);
    } else {
      taxableAmount = 0;
      taxAmount = 0;
      finalAmount = totalAmount;
    }
    return {
      totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
      taxableAmount: isNaN(taxableAmount) ? 0 : taxableAmount,
      taxAmount: isNaN(taxAmount) ? 0 : taxAmount,
      finalAmount: isNaN(finalAmount) ? 0 : finalAmount,
    };
  }

  private computeInvoiceTotals(
    computedItems: ComputedItemAmounts[],
    invoiceDiscounts: InvoiceDiscountInputDto[] | undefined,
    invoiceExtraCharges: InvoiceExtraChargeInputDto[] | undefined,
    vatWithheld: string,
  ): ComputedInvoiceTotals {
    const totalAmount = computedItems.reduce(
      (s, i) => s + this.toValidNumber(i.totalAmount, 0),
      0,
    );
    const taxableAmount = computedItems.reduce(
      (s, i) => s + this.toValidNumber(i.taxableAmount, 0),
      0,
    );
    const taxAmount = computedItems.reduce(
      (s, i) => s + this.toValidNumber(i.taxAmount, 0),
      0,
    );
    const discount = (invoiceDiscounts ?? []).reduce(
      (s, d) => s + this.toValidNumber(d.discountPrice, 0),
      0,
    );
    const extraCharge = (invoiceExtraCharges ?? []).reduce(
      (s, ec) => s + this.toValidNumber(ec.extraChargesPrice, 0),
      0,
    );
    const vatWithheldAmount = vatWithheld === 'YES' ? taxAmount : 0;
    const itemsFinalTotal = computedItems.reduce(
      (s, i) => s + this.toValidNumber(i.finalAmount, 0),
      0,
    );
    const finalAmount = itemsFinalTotal + extraCharge - discount - vatWithheldAmount;
    return {
      totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
      taxableAmount: isNaN(taxableAmount) ? 0 : taxableAmount,
      taxAmount: isNaN(taxAmount) ? 0 : taxAmount,
      discount: isNaN(discount) ? 0 : discount,
      extraCharge: isNaN(extraCharge) ? 0 : extraCharge,
      vatWithheldAmount: isNaN(vatWithheldAmount) ? 0 : vatWithheldAmount,
      finalAmount: isNaN(finalAmount) ? 0 : finalAmount,
    };
  }

  private validateInvoiceDates(
    invoiceDate?: string,
    deliveryDate?: string,
  ): string | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    if (invoiceDate) {
      const inv = new Date(invoiceDate);
      if (isNaN(inv.getTime())) return 'Invalid invoiceDate';
      if (inv < oneMonthAgo) return 'invoiceDate cannot be more than 1 month in the past';
    }

    if (deliveryDate) {
      const del = new Date(deliveryDate);
      if (isNaN(del.getTime())) return 'Invalid deliveryDate (exchangeDate)';
      if (del < oneMonthAgo) return 'exchangeDate cannot be more than 1 month in the past';
    }

    return null;
  }

  private async validateInvoiceSource(body: {
    invoiceFor?: string;
    sourceOrderId?: number;
    sourceQuotationId?: number;
  }): Promise<string | null> {
    if (body.invoiceFor === InvoiceFor.ORDER) {
      if (!body.sourceOrderId)
        return 'sourceOrderId is required when invoiceFor is ORDER';
      if (body.sourceQuotationId)
        return 'sourceQuotationId must not be set when invoiceFor is ORDER';
        
      const order = await this.orderRepo.findOne({
        where: { orderId: body.sourceOrderId }
      });
      if (!order) {
        return 'Source order not found';
      }
      if (order.status !== OrderStatus.DELIVERED || order.orderStatus !== OrderLifecycleStatus.OPEN) {
        return 'Source order must be in DELIVERED and OPEN status.';
      }
    } else if (body.invoiceFor === InvoiceFor.QUOTATION) {
      if (!body.sourceQuotationId)
        return 'sourceQuotationId is required when invoiceFor is QUOTATION';
      if (body.sourceOrderId)
        return 'sourceOrderId must not be set when invoiceFor is QUOTATION';
        
      const quotation = await this.quotationRepo.findOne({
        where: { quotationId: body.sourceQuotationId }
      });
      if (!quotation) {
        return 'Source quotation not found';
      }
      if (quotation.status !== QuotationStatus.CONFIRMED) {
        return 'Source quotation must be in CONFIRMED status.';
      }
    } else {
      if (body.sourceOrderId || body.sourceQuotationId)
        return 'sourceOrderId and sourceQuotationId must be null when invoiceFor is not set';
    }
    return null;
  }

  async insertInvoice(
    body: InvoiceDto,
    req?: any,
    files?: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
    options?: { isAutoGenerated?: boolean },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(body.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add invoice to another company',
          };
        }
      }

      const dateError = this.validateInvoiceDates(body.invoiceDate, body.deliveryDate);
      if (dateError) return { success: 0, message: dateError };

      const sourceError = await this.validateInvoiceSource(body);
      if (sourceError) return { success: 0, message: sourceError };

      const taxResult = await this.validateTaxGroups(
        body.invoiceItems,
        Number(body.companyId),
      );
      if (!taxResult.valid) return { success: 0, message: taxResult.message };
      const { rateMap } = taxResult;

      const invoiceCode = await this.codeGeneratorService.generateCode(
        this.invoiceRepo,
        `INV${body.customerId}`,
        Number(body.companyId),
        'invoiceCode',
      );

      const currency = await this.currencyRepo.findOne({
        where: { curId: Number(body.currencyId) },
      });
      const currencyCode = (currency as any)?.code ?? '';

      const computedItems = body.invoiceItems.map((item) =>
        this.computeItemAmounts(
          item,
          (item.taxCalculation === TaxCalculation.EXCLUSIVE ||
            item.taxCalculation === TaxCalculation.INCLUSIVE) &&
            item.taxGroup
            ? (rateMap.get(item.taxGroup) ?? 0)
            : 0,
        ),
      );
      const totals = this.computeInvoiceTotals(
        computedItems,
        body.invoiceDiscounts,
        body.invoiceExtraCharges,
        body.vatWithheld,
      );

      const { performerId, performerEmail } = this.resolvePerformer(req, body.addedBy);

      await queryRunner.connect();
      await queryRunner.startTransaction();

      const invoiceInsert = await queryRunner.manager.insert(InvoiceEntity, {
        invoiceCode,
        currencyId: this.toValidNumber(body.currencyId),
        currencyCode,
        customerId: this.toValidNumber(body.customerId),
        invoiceDate: new Date(body.invoiceDate),
        deliveryDate: new Date(body.deliveryDate),
        companyId: this.toValidNumber(body.companyId),
        remarks: body.remarks ?? undefined,
        termsConditionsId: this.toOptionalNumber(body.termsConditionsId) ?? null,
        termsConditionsText: body.termsConditionsText ?? undefined,
        bankBookId: this.toOptionalNumber(body.bankBookId) ?? null,
        accountNumber: body.accountNumber ?? undefined,
        salesPersonId: this.toOptionalNumber(body.salesPersonId) ?? null,
        contactPersonId: this.toOptionalNumber(body.contactPersonId) ?? null,
        currencyConversionRate: this.toValidNumber(body.currencyConversionRate, 1),
        vatWithheld: body.vatWithheld,
        businessTerms: body.businessTerms,
        paymentType: body.paymentType,
        deliveryTerms: body.deliveryTerms ?? null,
        discountApplicable: body.discountApplicable,
        shippingState: body.shippingState,
        billingState: body.billingState,
        deliveryState: body.deliveryState,
        deliveryType: body.deliveryType ?? null,
        invoiceFor: body.invoiceFor ?? null,
        sourceOrderId: this.toOptionalNumber(body.sourceOrderId) ?? null,
        sourceQuotationId: this.toOptionalNumber(body.sourceQuotationId) ?? null,
        totalAmount: this.toValidNumber(totals.totalAmount, 0),
        taxableAmount: this.toValidNumber(totals.taxableAmount, 0),
        taxAmount: this.toValidNumber(totals.taxAmount, 0),
        discount: this.toValidNumber(totals.discount, 0) || null,
        extraCharge: this.toValidNumber(totals.extraCharge, 0) || null,
        vatWithheldAmount: this.toValidNumber(totals.vatWithheldAmount, 0),
        finalAmount: this.toValidNumber(totals.finalAmount, 0),
        status: InvoiceStatus.DRAFT,
        addedBy: this.toOptionalNumber(performerId),
        addedDate: new Date(),
      });
      const insertId: number = invoiceInsert.raw?.insertId;

      for (let i = 0; i < body.invoiceItems.length; i++) {
        const item = body.invoiceItems[i];
        const computed = computedItems[i];

        const validItemId = this.toOptionalNumber(item.itemId);
        if ((!validItemId || validItemId <= 0) && !item.description?.trim()) {
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          return {
            success: 0,
            message: `Row ${i + 1}: Valid item selection or description is required.`,
          };
        }

        const itemInsert = await queryRunner.manager.insert(InvoiceItemEntity, {
          invoiceId: insertId,
          itemId: validItemId,
          description: item.description ?? null,
          itemGL: item.itemGL ?? null,
          quantity: this.toValidNumber(item.quantity, 0),
          unitPrice: this.toValidNumber(item.unitPrice, 0),
          taxCalculation: item.taxCalculation,
          taxGroup: item.taxGroup ?? null,
          totalAmount: this.toValidNumber(computed.totalAmount, 0),
          taxableAmount: this.toValidNumber(computed.taxableAmount, 0),
          taxAmount: this.toValidNumber(computed.taxAmount, 0),
          finalAmount: this.toValidNumber(computed.finalAmount, 0),
          addedBy: this.toOptionalNumber(performerId),
          addedDate: new Date(),
        });
        const itemInsertId: number = itemInsert.raw?.insertId;

        for (const d of item.discounts ?? []) {
          await queryRunner.manager.insert(InvoiceDiscountEntity, {
            invoiceItemId: itemInsertId,
            invoiceId: null,
            manufacturerId: this.toOptionalNumber(d.manufacturerId) ?? null,
            discountPrice: this.toValidNumber(d.discountPrice, 0),
            discountDescription: d.discountDescription,
            addedBy: this.toOptionalNumber(performerId),
            addedDate: new Date(),
          });
        }

        for (const ec of item.extraCharges ?? []) {
          await queryRunner.manager.insert(InvoiceExtraChargeEntity, {
            invoiceItemId: itemInsertId,
            invoiceId: null,
            manufacturerId: this.toOptionalNumber(ec.manufacturerId) ?? null,
            extraChargesPrice: this.toValidNumber(ec.extraChargesPrice, 0),
            extraChargesDescription: ec.extraChargesDescription,
            addedBy: this.toOptionalNumber(performerId),
            addedDate: new Date(),
          });
        }
      }

      for (const d of body.invoiceDiscounts ?? []) {
        await queryRunner.manager.insert(InvoiceDiscountEntity, {
          invoiceId: insertId,
          invoiceItemId: null,
          manufacturerId: this.toOptionalNumber(d.manufacturerId) ?? null,
          discountPrice: this.toValidNumber(d.discountPrice, 0),
          discountDescription: d.discountDescription,
          addedBy: this.toOptionalNumber(performerId),
          addedDate: new Date(),
        });
      }

      for (const ec of body.invoiceExtraCharges ?? []) {
        await queryRunner.manager.insert(InvoiceExtraChargeEntity, {
          invoiceId: insertId,
          invoiceItemId: null,
          manufacturerId: this.toOptionalNumber(ec.manufacturerId) ?? null,
          extraChargesPrice: this.toValidNumber(ec.extraChargesPrice, 0),
          extraChargesDescription: ec.extraChargesDescription,
          addedBy: this.toOptionalNumber(performerId),
          addedDate: new Date(),
        });
      }

      await queryRunner.commitTransaction();

      const termsFile = files?.termsConditionsFile?.[0];
      if (termsFile) {
        const termsFilename = termsFile.filename || termsFile.originalname;
        await this.fileTransfer.fileTransfer(termsFilename, insertId, 'invoice', {
          subfolder: 'terms',
        });
        const termsUrl = `/upload/invoice/${insertId}/terms/${termsFilename}`;
        await this.invoiceRepo.update({ invoiceId: insertId }, { termsConditionsFile: termsUrl });
      }

      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransfer(filename, insertId, 'invoice', {
          subfolder: 'attachments',
        });
        await this.attachmentRepo.insert({
          invoiceId: insertId,
          attachmentUrl: `/upload/invoice/${insertId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      const sourceOrderId = this.toOptionalNumber(body.sourceOrderId);
      const isOrderSource =
        (body.invoiceFor === InvoiceFor.ORDER ||
          String(body.invoiceFor).toUpperCase() === 'ORDER') &&
        !!sourceOrderId;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.INVOICE_CREATE,
        userId: performerId,
        companyId: Number(body.companyId),
        actorType: 'USER',
        targetType: 'INVOICE',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          invoiceCode,
          customerId: body.customerId,
          companyId: body.companyId,
          impersonated: !!req?.user?.isImpersonation,
          ...(options?.isAutoGenerated
            ? { autoGenerated: true, trigger: 'ORDER_DELIVERY', sourceOrderId }
            : {}),
        },
        metadata: options?.isAutoGenerated
          ? { note: 'Auto-generated on order delivery', sourceOrderId }
          : {},
      });

      let autoApproved = false;
      let autoApprovalMessage: string | undefined = undefined;
      let finalStatus: InvoiceStatus = InvoiceStatus.DRAFT;
      let vaultResult: any = null;

      if (isOrderSource) {
        try {
          const sourceOrder = await this.orderRepo.findOne({
            where: { orderId: sourceOrderId },
          });

          if (
            (sourceOrder?.invoiceGenerationOn === InvoiceGenerationOn.DELIVERY_LEVEL ||
              sourceOrder?.invoiceGenerationOn === 'DELIVERY_LEVEL') &&
            (sourceOrder?.invoiceAutoApproval === InvoiceAutoApproval.YES ||
              sourceOrder?.invoiceAutoApproval === 'YES')
          ) {
            const createdInvoice = await this.invoiceRepo.findOne({
              where: { invoiceId: insertId },
            });

            if (createdInvoice) {
              const approvalResult = await this.executeInvoiceApproval(
                createdInvoice,
                authCtx,
                req,
                true,
              );

              if (approvalResult.success === 1) {
                autoApproved = true;
                finalStatus = approvalResult.finalStatus || InvoiceStatus.UNPAID;
                vaultResult = approvalResult.vaultResult;
              } else {
                autoApproved = false;
                autoApprovalMessage = approvalResult.message || 'Auto-approval failed';
                console.warn(
                  `[AutoApproval] Order ${sourceOrderId} invoice ${insertId} approval failed:`,
                  approvalResult.message,
                );
              }
            }
          }
        } catch (approvalErr: any) {
          autoApproved = false;
          autoApprovalMessage = approvalErr.message || 'Auto-approval error occurred';
          console.error(
            `[AutoApproval] Error auto-approving invoice ${insertId} for order ${sourceOrderId}:`,
            approvalErr,
          );
        }
      }

      let submitted = false;
      let submitFailureMessage: string | undefined = undefined;

      if (autoApproved) {
        submitted = true;
      } else if (body.submit) {
        // Skip it if the order auto-approval path already approved the invoice (do not approve twice)
        const hasUpdatePerm = await this.hasUserPermission(authCtx, 'invoiceUpdate');
        if (!hasUpdatePerm) {
          submitted = false;
          finalStatus = InvoiceStatus.DRAFT;
          submitFailureMessage = 'Missing permission invoiceUpdate';
        } else {
          const createdInvoice = await this.invoiceRepo.findOne({
            where: { invoiceId: insertId },
          });
          if (createdInvoice) {
            const approvalResult = await this.executeInvoiceApproval(
              createdInvoice,
              authCtx,
              req,
              false,
            );
            if (approvalResult.success === 1) {
              submitted = true;
              finalStatus = approvalResult.finalStatus || InvoiceStatus.UNPAID;
              vaultResult = approvalResult.vaultResult;
            } else {
              submitted = false;
              finalStatus = InvoiceStatus.DRAFT;
              submitFailureMessage = approvalResult.message || 'Submission failed';
            }
          }
        }
      }

      let responseMessage: string;
      if (body.submit) {
        if (submitted) {
          responseMessage = autoApproved
            ? 'Invoice created and auto-approved successfully'
            : 'Invoice created and submitted successfully';
        } else {
          responseMessage = `Invoice saved as draft, but could not be submitted: ${submitFailureMessage || 'Approval failed'}`;
        }
      } else {
        if (autoApproved) {
          responseMessage = 'Invoice created and auto-approved successfully';
        } else if (autoApprovalMessage) {
          responseMessage = `Invoice created successfully, but auto-approval failed: ${autoApprovalMessage}`;
        } else {
          responseMessage = 'Invoice created successfully';
        }
      }

      return {
        success: 1,
        message: responseMessage,
        data: {
          insertData: insertId,
          invoiceId: insertId,
          invoiceCode,
          autoApproved,
          submitted,
          status: finalStatus,
          finalStatus,
          vaultResult,
          ...(autoApprovalMessage ? { autoApprovalMessage } : {}),
        },
        invoiceId: insertId,
        invoiceCode,
        autoApproved,
        submitted,
        status: finalStatus,
        finalStatus,
        vaultResult,
        ...(autoApprovalMessage ? { autoApprovalMessage } : {}),
      };
    } catch (err: any) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      return { success: 0, message: err.message };
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  async updateInvoice(
    body: InvoiceUpdateDto & { updatedBy?: number },
    req?: any,
    files?: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
  ) {
    if (!body.invoiceId) {
      return { success: 0, message: 'invoiceId is mandatory' };
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const invoiceId = Number(body.invoiceId);

      const existing = await this.invoiceRepo.findOne({ where: { invoiceId } });
      if (!existing) return { success: 0, message: 'Invoice not found' };

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(existing.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update invoice of another company',
          };
        }
      }

      if (existing.status !== InvoiceStatus.DRAFT) {
        return {
          success: 0,
          message: 'Only invoices in Draft status can be updated.',
        };
      }

      if (body.invoiceDate || body.deliveryDate) {
        const effectiveInvoice = body.invoiceDate ?? String(existing.invoiceDate);
        const effectiveDelivery = body.deliveryDate ?? String(existing.deliveryDate);
        const dateError = this.validateInvoiceDates(effectiveInvoice, effectiveDelivery);
        if (dateError) return { success: 0, message: dateError };
      }

      if (
        body.invoiceFor !== undefined ||
        body.sourceOrderId !== undefined ||
        body.sourceQuotationId !== undefined
      ) {
        const sourceError = await this.validateInvoiceSource({
          invoiceFor: body.invoiceFor ?? (existing.invoiceFor as string | undefined),
          sourceOrderId:
            body.sourceOrderId ?? (existing.sourceOrderId ?? undefined),
          sourceQuotationId:
            body.sourceQuotationId ?? (existing.sourceQuotationId ?? undefined),
        });
        if (sourceError) return { success: 0, message: sourceError };
      }

      const effectiveCompanyId = body.companyId
        ? Number(body.companyId)
        : Number(existing.companyId);

      let computedItems: ComputedItemAmounts[] | null = null;
      let totals: ComputedInvoiceTotals | null = null;
      let rateMap: Map<string, number> = new Map();

      if (body.invoiceItems && body.invoiceItems.length > 0) {
        const taxResult = await this.validateTaxGroups(
          body.invoiceItems,
          effectiveCompanyId,
        );
        if (!taxResult.valid) return { success: 0, message: taxResult.message };
        rateMap = taxResult.rateMap;

        computedItems = body.invoiceItems.map((item) =>
          this.computeItemAmounts(
            item,
            (item.taxCalculation === TaxCalculation.EXCLUSIVE ||
              item.taxCalculation === TaxCalculation.INCLUSIVE) &&
              item.taxGroup
              ? (rateMap.get(item.taxGroup) ?? 0)
              : 0,
          ),
        );
        totals = this.computeInvoiceTotals(
          computedItems,
          body.invoiceDiscounts,
          body.invoiceExtraCharges,
          body.vatWithheld ?? existing.vatWithheld,
        );
      }

      const { performerId, performerEmail } = this.resolvePerformer(
        req,
        body.updatedBy,
      );

      const patch: any = {};
      if (body.invoiceDate !== undefined) patch.invoiceDate = new Date(body.invoiceDate);
      if (body.deliveryDate !== undefined)
        patch.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
      if (body.companyId !== undefined)
        patch.companyId = this.toValidNumber(body.companyId, existing.companyId);
      if (body.remarks !== undefined) patch.remarks = body.remarks;
      if (body.termsConditionsId !== undefined)
        patch.termsConditionsId = this.toOptionalNumber(body.termsConditionsId) ?? null;
      if (body.termsConditionsText !== undefined)
        patch.termsConditionsText = body.termsConditionsText ?? null;
      if (body.bankBookId !== undefined)
        patch.bankBookId = this.toOptionalNumber(body.bankBookId) ?? null;
      if (body.accountNumber !== undefined)
        patch.accountNumber = body.accountNumber ?? null;
      if (body.salesPersonId !== undefined)
        patch.salesPersonId = this.toOptionalNumber(body.salesPersonId) ?? null;
      if (body.contactPersonId !== undefined)
        patch.contactPersonId = this.toOptionalNumber(body.contactPersonId) ?? null;
      if (body.currencyConversionRate !== undefined)
        patch.currencyConversionRate = this.toValidNumber(
          body.currencyConversionRate,
          existing.currencyConversionRate || 1,
        );
      if (body.vatWithheld !== undefined) patch.vatWithheld = body.vatWithheld;
      if (body.businessTerms !== undefined) patch.businessTerms = body.businessTerms;
      if (body.paymentType !== undefined) patch.paymentType = body.paymentType;
      if (body.deliveryTerms !== undefined) patch.deliveryTerms = body.deliveryTerms ?? null;
      if (body.discountApplicable !== undefined)
        patch.discountApplicable = body.discountApplicable;
      if (body.shippingState !== undefined) patch.shippingState = body.shippingState;
      if (body.billingState !== undefined) patch.billingState = body.billingState;
      if (body.deliveryState !== undefined) patch.deliveryState = body.deliveryState;
      if (body.deliveryType !== undefined) patch.deliveryType = body.deliveryType ?? null;
      if (body.invoiceFor !== undefined) patch.invoiceFor = body.invoiceFor ?? null;
      if (body.sourceOrderId !== undefined)
        patch.sourceOrderId = this.toOptionalNumber(body.sourceOrderId) ?? null;
      if (body.sourceQuotationId !== undefined)
        patch.sourceQuotationId = this.toOptionalNumber(body.sourceQuotationId) ?? null;
      if (body.status !== undefined) patch.status = body.status;

      if (totals) {
        patch.totalAmount = this.toValidNumber(totals.totalAmount, 0);
        patch.taxableAmount = this.toValidNumber(totals.taxableAmount, 0);
        patch.taxAmount = this.toValidNumber(totals.taxAmount, 0);
        patch.discount = this.toValidNumber(totals.discount, 0) || null;
        patch.extraCharge = this.toValidNumber(totals.extraCharge, 0) || null;
        patch.vatWithheldAmount = this.toValidNumber(totals.vatWithheldAmount, 0);
        patch.finalAmount = this.toValidNumber(totals.finalAmount, 0);
      }

      const pId = this.toOptionalNumber(performerId);
      if (pId) patch.updatedBy = pId;
      patch.updatedDate = new Date();

      await queryRunner.connect();
      await queryRunner.startTransaction();

      if (Object.keys(patch).length > 0) {
        await queryRunner.manager.update(InvoiceEntity, { invoiceId }, patch);
      }

      if (body.invoiceItems && body.invoiceItems.length > 0 && computedItems) {
        const existingItems = await queryRunner.manager.find(InvoiceItemEntity, {
          where: { invoiceId },
          select: ['invoiceItemId'],
        });
        const existingItemIds = existingItems.map((i) => i.invoiceItemId);

        if (existingItemIds.length > 0) {
          await queryRunner.manager.delete(InvoiceDiscountEntity, {
            invoiceItemId: In(existingItemIds),
          });
          await queryRunner.manager.delete(InvoiceExtraChargeEntity, {
            invoiceItemId: In(existingItemIds),
          });
        }
        await queryRunner.manager.delete(InvoiceItemEntity, { invoiceId });

        for (let i = 0; i < body.invoiceItems.length; i++) {
          const item = body.invoiceItems[i];
          const computed = computedItems[i];

          const validItemId = this.toOptionalNumber(item.itemId);
          if ((!validItemId || validItemId <= 0) && !item.description?.trim()) {
            if (queryRunner.isTransactionActive) {
              await queryRunner.rollbackTransaction();
            }
            return {
              success: 0,
              message: `Row ${i + 1}: Valid item selection or description is required.`,
            };
          }

          const itemInsert = await queryRunner.manager.insert(InvoiceItemEntity, {
            invoiceId,
            itemId: validItemId,
            description: item.description ?? null,
            itemGL: item.itemGL ?? null,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            taxCalculation: item.taxCalculation,
            taxGroup: item.taxGroup ?? null,
            totalAmount: computed.totalAmount,
            taxableAmount: computed.taxableAmount,
            taxAmount: computed.taxAmount,
            finalAmount: computed.finalAmount,
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
          const itemInsertId: number = itemInsert.raw?.insertId;

          for (const d of item.discounts ?? []) {
            await queryRunner.manager.insert(InvoiceDiscountEntity, {
              invoiceItemId: itemInsertId,
              invoiceId: null,
              manufacturerId: d.manufacturerId ?? null,
              discountPrice: Number(d.discountPrice),
              discountDescription: d.discountDescription,
              addedBy: performerId ? Number(performerId) : undefined,
              addedDate: new Date(),
            });
          }

          for (const ec of item.extraCharges ?? []) {
            await queryRunner.manager.insert(InvoiceExtraChargeEntity, {
              invoiceItemId: itemInsertId,
              invoiceId: null,
              manufacturerId: ec.manufacturerId ?? null,
              extraChargesPrice: Number(ec.extraChargesPrice),
              extraChargesDescription: ec.extraChargesDescription,
              addedBy: performerId ? Number(performerId) : undefined,
              addedDate: new Date(),
            });
          }
        }
      }

      if (body.invoiceDiscounts !== undefined) {
        await queryRunner.manager.delete(InvoiceDiscountEntity, {
          invoiceId,
          invoiceItemId: null,
        });
        for (const d of body.invoiceDiscounts) {
          await queryRunner.manager.insert(InvoiceDiscountEntity, {
            invoiceId,
            invoiceItemId: null,
            manufacturerId: d.manufacturerId ?? null,
            discountPrice: Number(d.discountPrice),
            discountDescription: d.discountDescription,
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
        }
      }

      if (body.invoiceExtraCharges !== undefined) {
        await queryRunner.manager.delete(InvoiceExtraChargeEntity, {
          invoiceId,
          invoiceItemId: null,
        });
        for (const ec of body.invoiceExtraCharges) {
          await queryRunner.manager.insert(InvoiceExtraChargeEntity, {
            invoiceId,
            invoiceItemId: null,
            manufacturerId: ec.manufacturerId ?? null,
            extraChargesPrice: Number(ec.extraChargesPrice),
            extraChargesDescription: ec.extraChargesDescription,
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
        }
      }

      // Delete requested attachments
      if (body.deletedAttachmentIds && body.deletedAttachmentIds.length > 0) {
        const toDelete = await queryRunner.manager.find(InvoiceAttachmentsEntity, {
          where: { invoiceAttachmentId: In(body.deletedAttachmentIds) },
        });
        for (const att of toDelete) {
          const relativePath = att.attachmentUrl.startsWith('/')
            ? att.attachmentUrl.substring(1)
            : att.attachmentUrl;
          const fullPath = path.resolve('.', relativePath);
          if (fs.existsSync(fullPath)) {
            try {
              await fs.promises.unlink(fullPath);
            } catch { /* ignore */ }
          }
        }
        await queryRunner.manager.delete(InvoiceAttachmentsEntity, {
          invoiceAttachmentId: In(body.deletedAttachmentIds),
        });
      }

      await queryRunner.commitTransaction();

      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransfer(filename, invoiceId, 'invoice', {
          subfolder: 'attachments',
        });
        await this.attachmentRepo.insert({
          invoiceId,
          attachmentUrl: `/upload/invoice/${invoiceId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      const termsFile = files?.termsConditionsFile?.[0];
      if (termsFile) {
        const termsFilename = termsFile.filename || termsFile.originalname;
        await this.fileTransfer.fileTransfer(termsFilename, invoiceId, 'invoice', {
          subfolder: 'terms',
        });
        await this.invoiceRepo.update(
          { invoiceId },
          {
            termsConditionsFile: `/upload/invoice/${invoiceId}/terms/${termsFilename}`,
          },
        );
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.INVOICE_UPDATE,
        userId: performerId,
        companyId: existing.companyId,
        actorType: 'USER',
        targetType: 'INVOICE',
        targetId: String(invoiceId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          invoiceCode: existing.invoiceCode,
          status: body.status ?? existing.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      let submitted = false;
      let finalStatus: InvoiceStatus = InvoiceStatus.DRAFT;
      let vaultResult: any = null;
      let submitFailureMessage: string | undefined = undefined;

      if (body.submit) {
        const updatedInvoice = await this.invoiceRepo.findOne({
          where: { invoiceId },
        });

        if (updatedInvoice) {
          const approvalResult = await this.executeInvoiceApproval(
            updatedInvoice,
            authCtx,
            req,
            false,
          );
          if (approvalResult.success === 1) {
            submitted = true;
            finalStatus = approvalResult.finalStatus || InvoiceStatus.UNPAID;
            vaultResult = approvalResult.vaultResult;
          } else {
            submitted = false;
            finalStatus = InvoiceStatus.DRAFT;
            submitFailureMessage = approvalResult.message || 'Submission failed';
          }
        }
      }

      let responseMessage: string;
      if (body.submit) {
        if (submitted) {
          responseMessage = 'Invoice updated and submitted successfully';
        } else {
          responseMessage = `Invoice saved as draft, but could not be submitted: ${submitFailureMessage || 'Approval failed'}`;
        }
      } else {
        responseMessage = 'Invoice updated successfully';
      }

      return {
        success: 1,
        message: responseMessage,
        data: {
          invoiceId,
          submitted,
          status: finalStatus,
          finalStatus,
          vaultResult,
        },
        invoiceId,
        submitted,
        status: finalStatus,
        finalStatus,
        vaultResult,
      };
    } catch (err: any) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      return { success: 0, message: err.message };
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  async submitInvoice(invoiceId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      const invoice = await this.invoiceRepo.findOne({ where: { invoiceId } });
      if (!invoice) return { success: 0, message: 'Invoice not found' };

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(invoice.companyId))) {
          return {
            success: 0,
            message: 'Access denied: invoice belongs to another company',
          };
        }
      }

      return await this.executeInvoiceApproval(invoice, authCtx, req, false);
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  private async executeInvoiceApproval(
    invoice: InvoiceEntity,
    authCtx: any,
    req?: any,
    isAutoApproval = false,
  ) {
    if (invoice.status !== InvoiceStatus.DRAFT) {
      return { success: 0, message: 'Only draft invoices can be submitted' };
    }

    const invoiceId = invoice.invoiceId;
    await this.invoiceRepo.update({ invoiceId }, { status: InvoiceStatus.UNPAID });

    let vaultResult: any = null;
    let finalStatus = InvoiceStatus.UNPAID;

    try {
      const mode = (process.env.INVOICE_PAYMENT_MODE || 'AUTOMATIC').toUpperCase();

      if (mode === 'AUTOMATIC') {
        const strategy = ((process.env.INVOICE_PAYMENT_STRATEGY as 'FIFO' | 'LIFO') || 'FIFO').toUpperCase() as 'FIFO' | 'LIFO';

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          vaultResult = await this.vaultService.deductAutomatic(
            invoice.invoiceId,
            invoice.customerId,
            invoice.currencyId,
            invoice.companyId,
            Number(invoice.finalAmount || 0),
            strategy,
            queryRunner,
          );

          if (vaultResult.result === 'PAID') finalStatus = InvoiceStatus.PAID;
          else if (vaultResult.result === 'PARTIAL') finalStatus = InvoiceStatus.PARTIALLY_PAID;

          if (finalStatus !== InvoiceStatus.UNPAID) {
            await queryRunner.manager.update(InvoiceEntity, { invoiceId }, {
              status: finalStatus,
              amountPaid: vaultResult.amountPaid,
            });
          }
          await queryRunner.commitTransaction();
        } catch (err) {
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          throw err;
        } finally {
          if (!queryRunner.isReleased) {
            await queryRunner.release();
          }
        }
      }

      this.invoicePdfService
        .generateAndStoreInvoicePdf(invoiceId)
        .catch((err: Error) =>
          console.error(
            `[PDF] Failed to generate invoice PDF for invoice ${invoiceId}:`,
            err.message,
          ),
        );

      const { performerId, performerEmail } = this.resolvePerformer(req, invoice.addedBy);
      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.INVOICE_UPDATE,
        userId: performerId,
        companyId: invoice.companyId,
        actorType: 'USER',
        targetType: 'INVOICE',
        targetId: String(invoiceId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx?.activeGroupName || 'N/A',
          invoiceCode: invoice.invoiceCode,
          transition: `DRAFT→${finalStatus}`,
          impersonated: !!req?.user?.isImpersonation,
          ...(isAutoApproval ? { autoApproved: true, trigger: 'AUTO_APPROVAL' } : {}),
        },
        metadata: isAutoApproval ? { note: 'Auto-approved on order invoice creation' } : {},
      });

      return {
        success: 1,
        message: 'Invoice submitted successfully',
        vaultResult,
        finalStatus,
      };
    } catch (err: any) {
      try {
        await this.invoiceRepo.update({ invoiceId }, { status: InvoiceStatus.DRAFT, amountPaid: 0 });
      } catch (revertErr) {
        console.error(`[executeInvoiceApproval] Failed to revert status to DRAFT for invoice ${invoiceId}:`, revertErr);
      }
      return {
        success: 0,
        message: err?.message || 'Invoice approval failed',
      };
    }
  }

  async markAsPaid(invoiceId: number, body: VaultPaymentBodyDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      const invoice = await this.invoiceRepo.findOne({ where: { invoiceId } });
      if (!invoice) return { success: 0, message: 'Invoice not found' };

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(invoice.companyId))) {
          return {
            success: 0,
            message: 'Access denied: invoice belongs to another company',
          };
        }
      }

      if (
        invoice.status !== InvoiceStatus.UNPAID &&
        invoice.status !== InvoiceStatus.PARTIALLY_PAID
      ) {
        return {
          success: 0,
          message: 'Only UNPAID or PARTIALLY_PAID invoices can be marked as paid',
        };
      }

      let vaultResult: any = null;
      let finalStatus = invoice.status;

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const remainingToPay = Number(invoice.finalAmount || 0) - Number(invoice.amountPaid || 0);
        const strategy = ((process.env.INVOICE_PAYMENT_STRATEGY as 'FIFO' | 'LIFO') || 'FIFO').toUpperCase() as 'FIFO' | 'LIFO';

        vaultResult = await this.vaultService.deductAutomatic(
          invoice.invoiceId,
          invoice.customerId,
          invoice.currencyId,
          invoice.companyId,
          remainingToPay,
          strategy,
          queryRunner
        );

        if (vaultResult && (vaultResult.result === 'PAID' || vaultResult.result === 'PARTIAL')) {
          finalStatus = vaultResult.result === 'PAID' ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
          const newAmountPaid = Number(invoice.amountPaid) + vaultResult.amountPaid;
          await queryRunner.manager.update(InvoiceEntity, { invoiceId }, { 
            status: finalStatus,
            amountPaid: newAmountPaid,
          });
        }
        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }

      this.invoicePdfService
        .generateAndStoreInvoicePdf(invoiceId)
        .catch((err: Error) =>
          console.error(
            `[PDF] Failed to regenerate invoice PDF for invoice ${invoiceId}:`,
            err.message,
          ),
        );

      const { performerId, performerEmail } = this.resolvePerformer(req);
      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.INVOICE_UPDATE,
        userId: performerId,
        companyId: invoice.companyId,
        actorType: 'USER',
        targetType: 'INVOICE',
        targetId: String(invoiceId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          invoiceCode: invoice.invoiceCode,
          transition: `${invoice.status}→${finalStatus}`,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      if (vaultResult && vaultResult.result === 'UNPAID') {
        return {
          success: 0,
          message: 'Insufficient vault balance — nothing was paid.',
          vaultResult
        };
      }

      return { 
        success: 1, 
        message: 'Invoice payment processed successfully',
        vaultResult
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateDueDate(body: InvoiceUpdateDueDateDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const invoiceId = Number(body.invoiceId);

      const invoice = await this.invoiceRepo.findOne({ where: { invoiceId } });
      if (!invoice) return { success: 0, message: 'Invoice not found' };

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(invoice.companyId))) {
          return {
            success: 0,
            message: 'Access denied: invoice belongs to another company',
          };
        }
      }

      if (invoice.status === InvoiceStatus.DRAFT) {
        return {
          success: 0,
          message: 'Use the standard update endpoint for draft invoices',
        };
      }

      const newDueDate = new Date(body.newDueDate);
      if (isNaN(newDueDate.getTime())) {
        return { success: 0, message: 'Invalid newDueDate' };
      }

      const { performerId } = this.resolvePerformer(req, body.updatedBy);

      await this.invoiceRepo.update(
        { invoiceId },
        { deliveryDate: newDueDate, updatedDate: new Date() },
      );

      await this.dueDateHistoryRepo.insert({
        invoiceId,
        previousDueDate: invoice.deliveryDate,
        newDueDate,
        remarks: body.remarks ?? null,
        changedBy: performerId ?? Number(body.updatedBy) ?? 0,
        changedAt: new Date(),
      });

      return { success: 1, message: 'Due date updated successfully' };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async deleteInvoice(invoiceId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      const invoice = await this.invoiceRepo.findOne({ where: { invoiceId } });
      if (!invoice) return { success: 0, message: 'Invoice not found' };

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(invoice.companyId))) {
          return {
            success: 0,
            message: 'Access denied: invoice belongs to another company',
          };
        }
      }

      if (invoice.status !== InvoiceStatus.DRAFT) {
        return { success: 0, message: 'Only draft invoices can be deleted' };
      }

      await this.invoiceRepo.softDelete({ invoiceId });

      const { performerId, performerEmail } = this.resolvePerformer(req);
      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.INVOICE_DELETE,
        userId: performerId,
        companyId: invoice.companyId,
        actorType: 'USER',
        targetType: 'INVOICE',
        targetId: String(invoiceId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          invoiceCode: invoice.invoiceCode,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return { success: 1, message: 'Invoice deleted successfully' };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async deleteInvoiceAttachment(attachmentId: number, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const att = await this.attachmentRepo.findOne({
        where: { invoiceAttachmentId: attachmentId },
      });
      if (!att) {
        throw new NotFoundException('Invoice attachment not found');
      }

      const invoice = await this.invoiceRepo.findOne({
        where: { invoiceId: att.invoiceId },
      });
      if (!invoice) {
        throw new NotFoundException('Associated invoice not found');
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(invoice.companyId))) {
          throw new ForbiddenException(
            'Access denied: invoice attachment belongs to another company',
          );
        }
      }

      const relativePath = att.attachmentUrl.startsWith('/')
        ? att.attachmentUrl.substring(1)
        : att.attachmentUrl;
      const fullPath = path.resolve('.', relativePath);
      if (fs.existsSync(fullPath)) {
        try {
          await fs.promises.unlink(fullPath);
        } catch { /* ignore */ }
      }

      await this.attachmentRepo.delete({ invoiceAttachmentId: attachmentId });

      return { success: 1, message: 'Invoice attachment deleted successfully' };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async deleteInvoiceTermsFile(invoiceId: number, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const invoice = await this.invoiceRepo.findOne({ where: { invoiceId } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(invoice.companyId))) {
          throw new ForbiddenException(
            'Access denied: invoice belongs to another company',
          );
        }
      }

      if (invoice.termsConditionsFile) {
        const relativePath = invoice.termsConditionsFile.startsWith('/')
          ? invoice.termsConditionsFile.substring(1)
          : invoice.termsConditionsFile;
        const fullPath = path.resolve('.', relativePath);
        if (fs.existsSync(fullPath)) {
          try {
            await fs.promises.unlink(fullPath);
          } catch { }
        }

        await this.invoiceRepo.update({ invoiceId }, { termsConditionsFile: null });
      }

      return {
        success: 1,
        message: 'Terms & Conditions file deleted successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async autoGenerateInvoiceFromOrder(
    orderId: number,
    req?: any,
    deliveryDateOverride?: string,
  ): Promise<{
    success: number;
    message: string;
    invoiceId?: number;
    invoiceCode?: string;
    invoiceStatus?: string;
    autoApproved?: boolean;
  }> {
    try {
      const existingInvoice = await this.invoiceRepo.findOne({
        where: {
          sourceOrderId: orderId,
          invoiceFor: InvoiceFor.ORDER,
        },
      });

      if (existingInvoice) {
        console.warn(
          `[autoGenerateInvoiceFromOrder] Invoice already exists for order ${orderId}: invoiceId=${existingInvoice.invoiceId}, code=${existingInvoice.invoiceCode}`,
        );
        return {
          success: 0,
          message: `Invoice already exists for order ${orderId}`,
          invoiceId: existingInvoice.invoiceId,
          invoiceCode: existingInvoice.invoiceCode,
          invoiceStatus: existingInvoice.status,
        };
      }

      const order = await this.orderRepo.findOne({
        where: { orderId },
        relations: [
          'customer',
          'currency',
          'company',
          'bankBook',
          'salesPerson',
          'contactPerson',
          'termsConditions',
          'orderItems',
          'orderItems.item',
          'orderItems.discounts',
          'orderItems.extraCharges',
          'discounts',
          'extraCharges',
        ],
      });

      if (!order) {
        console.error(`[autoGenerateInvoiceFromOrder] Order ${orderId} not found`);
        return { success: 0, message: `Order ${orderId} not found` };
      }

      if (
        order.invoiceGenerationOn !== InvoiceGenerationOn.DELIVERY_LEVEL &&
        (order.invoiceGenerationOn as any) !== 'DELIVERY_LEVEL'
      ) {
        return {
          success: 0,
          message: `Order ${orderId} is not configured for DELIVERY_LEVEL invoice generation`,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      let finalDeliveryDateStr = todayStr;
      const candidateDate = deliveryDateOverride || order.deliveryDate;
      if (candidateDate) {
        const d = new Date(candidateDate);
        if (!isNaN(d.getTime()) && d >= oneMonthAgo) {
          finalDeliveryDateStr = d.toISOString().split('T')[0];
        }
      }

      const invoiceItems: InvoiceItemInputDto[] = (order.orderItems || []).map((it) => {
        let taxCalc: TaxCalculation = TaxCalculation.NA;
        if (it.taxCalculation === 'EXCLUSIVE') taxCalc = TaxCalculation.EXCLUSIVE;
        else if (it.taxCalculation === 'INCLUSIVE') taxCalc = TaxCalculation.INCLUSIVE;

        const itemDiscounts: InvoiceDiscountInputDto[] = (it.discounts || []).map((d) => ({
          discountDescription: d.discountDescription || '',
          discountPrice: Number(d.discountPrice || 0),
          manufacturerId: d.manufacturerId ? Number(d.manufacturerId) : undefined,
        }));

        const itemExtraCharges: InvoiceExtraChargeInputDto[] = (it.extraCharges || []).map((ec) => ({
          extraChargesDescription: ec.extraChargesDescription || '',
          extraChargesPrice: Number(ec.extraChargesPrice || 0),
          manufacturerId: ec.manufacturerId ? Number(ec.manufacturerId) : undefined,
        }));

        return {
          itemId: it.itemId ? Number(it.itemId) : undefined,
          description: it.description || undefined,
          itemGL: it.itemGL || undefined,
          quantity: Number(it.quantity || 0),
          unitPrice: Number(it.unitPrice || 0),
          taxCalculation: taxCalc,
          taxGroup: it.taxGroup || undefined,
          discounts: itemDiscounts.length > 0 ? itemDiscounts : undefined,
          extraCharges: itemExtraCharges.length > 0 ? itemExtraCharges : undefined,
        };
      });

      if (!invoiceItems || invoiceItems.length === 0) {
        console.warn(`[autoGenerateInvoiceFromOrder] Order ${orderId} has no items. Skipping.`);
        return { success: 0, message: `Order ${orderId} has no items` };
      }

      const invoiceDiscounts: InvoiceDiscountInputDto[] = (order.discounts || []).map((d) => ({
        discountDescription: d.discountDescription || '',
        discountPrice: Number(d.discountPrice || 0),
        manufacturerId: d.manufacturerId ? Number(d.manufacturerId) : undefined,
      }));

      const invoiceExtraCharges: InvoiceExtraChargeInputDto[] = (order.extraCharges || []).map((ec) => ({
        extraChargesDescription: ec.extraChargesDescription || '',
        extraChargesPrice: Number(ec.extraChargesPrice || 0),
        manufacturerId: ec.manufacturerId ? Number(ec.manufacturerId) : undefined,
      }));

      const invoiceDto: InvoiceDto = {
        customerId: Number(order.customerId),
        currencyId: Number(order.currencyId),
        invoiceDate: todayStr,
        deliveryDate: finalDeliveryDateStr,
        companyId: Number(order.companyId),
        remarks: order.remarks || undefined,
        termsConditionsId: order.termsConditionsId ? Number(order.termsConditionsId) : undefined,
        termsConditionsText: order.termsConditionsText || undefined,
        bankBookId: order.bankBookId ? Number(order.bankBookId) : undefined,
        accountNumber: order.accountNumber || order.bankBook?.accountNumber || undefined,
        salesPersonId: order.salesPersonId ? Number(order.salesPersonId) : undefined,
        contactPersonId: order.contactPersonId ? Number(order.contactPersonId) : undefined,
        currencyConversionRate: Number(order.currencyConversionRate || 1),
        vatWithheld: (order.vatWithheld as any) || 'NO',
        businessTerms: order.businessTerms as any,
        paymentType: order.paymentType as any,
        deliveryTerms: order.deliveryTerms || undefined,
        discountApplicable: order.discountApplicable as any,
        shippingState: order.shippingState || '',
        billingState: order.billingState || '',
        deliveryState: order.deliveryState || '',
        deliveryType: (order.deliveryType as any) || undefined,
        invoiceFor: InvoiceFor.ORDER,
        sourceOrderId: order.orderId,
        invoiceItems,
        invoiceDiscounts: invoiceDiscounts.length > 0 ? invoiceDiscounts : undefined,
        invoiceExtraCharges: invoiceExtraCharges.length > 0 ? invoiceExtraCharges : undefined,
        submit: false,
        addedBy: order.addedBy ? Number(order.addedBy) : undefined,
      };

      const result: any = await this.insertInvoice(invoiceDto, req, undefined, {
        isAutoGenerated: true,
      });

      if (result && result.success === 1) {
        return {
          success: 1,
          message: result.message,
          invoiceId: result.invoiceId,
          invoiceCode: result.invoiceCode,
          invoiceStatus: result.status || result.finalStatus,
          autoApproved: result.autoApproved,
        };
      } else {
        console.warn(
          `[autoGenerateInvoiceFromOrder] Failed to create invoice for order ${orderId}:`,
          result?.message,
        );
        return {
          success: 0,
          message: result?.message || 'Failed to auto-generate invoice',
        };
      }
    } catch (err: any) {
      console.error(
        `[autoGenerateInvoiceFromOrder] Error auto-generating invoice for order ${orderId}:`,
        err,
      );
      return {
        success: 0,
        message: err.message,
      };
    }
  }
}
