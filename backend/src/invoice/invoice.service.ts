import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
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
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { InvoiceEntity, InvoiceFor, InvoiceStatus } from './entity/invoice.entity';
import { InvoiceItemEntity, TaxCalculation } from './entity/invoice.item.entity';
import { InvoiceDiscountEntity } from './entity/invoice.discount.entity';
import { InvoiceExtraChargeEntity } from './entity/invoice.extra.charge.entity';
import { InvoiceAttachmentsEntity } from './entity/invoice.attachments';
import { InvoiceDueDateHistoryEntity } from './entity/invoice.due.date.history.entity';
import {
  InvoiceDiscountInputDto,
  InvoiceDto,
  InvoiceExtraChargeInputDto,
  InvoiceItemInputDto,
  InvoiceListDto,
  InvoiceUpdateDto,
  InvoiceUpdateDueDateDto,
} from './dto/invoice.dto';
import { InvoicePdfService } from './invoice.pdf.service';

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

    private readonly filter: Filter,
    private readonly fileTransfer: FileTransfer,
    private readonly eventEmitter: EventEmitter2,
    private readonly invoicePdfService: InvoicePdfService,
  ) {
    this.dataSource = this.invoiceRepo.manager.connection;
  }

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;


  private resolvePerformer(req: any, fallbackId?: number) {
    const performerId: number | undefined = req?.user?.isImpersonation
      ? req?.user?.userId
      : (req?.user?.impersonatedBy ?? fallbackId);
    const performerEmail: string = req?.user?.isImpersonation
      ? (req?.user?.email ?? '')
      : (req?.user?.impersonatorEmail ?? '');
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
    if (invoiceDate) {
      const inv = new Date(invoiceDate);
      if (isNaN(inv.getTime())) return 'Invalid invoiceDate';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (inv < today) return 'invoiceDate must be today or a future date';

      if (deliveryDate) {
        const del = new Date(deliveryDate);
        if (isNaN(del.getTime())) return 'Invalid deliveryDate';
        const minDelivery = new Date(inv);
        minDelivery.setDate(minDelivery.getDate() + 15);
        if (del < minDelivery)
          return 'deliveryDate must be at least 15 calendar days after invoiceDate';
      }
    }
    return null;
  }


  private validateInvoiceSource(body: {
    invoiceFor?: string;
    sourceOrderId?: number;
    sourceQuotationId?: number;
  }): string | null {
    if (body.invoiceFor === InvoiceFor.ORDER) {
      if (!body.sourceOrderId)
        return 'sourceOrderId is required when invoiceFor is ORDER';
      if (body.sourceQuotationId)
        return 'sourceQuotationId must not be set when invoiceFor is ORDER';
    } else if (body.invoiceFor === InvoiceFor.QUOTATION) {
      if (!body.sourceQuotationId)
        return 'sourceQuotationId is required when invoiceFor is QUOTATION';
      if (body.sourceOrderId)
        return 'sourceOrderId must not be set when invoiceFor is QUOTATION';
    } else {
      if (body.sourceOrderId || body.sourceQuotationId)
        return 'sourceOrderId and sourceQuotationId must be null when invoiceFor is not set';
    }
    return null;
  }


  async invoiceList(param: InvoiceListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.invoiceRepo.createQueryBuilder('invoice');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'invoice.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Invoices fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'invoice',
        {
          customerName: 'customer',
          companyName: 'company',
        },
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.invoiceRepo,
      )) as [number, number];

      queryBuilder
        .leftJoinAndSelect('invoice.customer', 'customer')
        .leftJoinAndSelect('invoice.currency', 'currency')
        .leftJoinAndSelect('invoice.company', 'company')
        .leftJoinAndSelect('invoice.salesPerson', 'salesPerson')
        .leftJoinAndSelect('invoice.bankBook', 'bankBook')
        .skip(skip)
        .take(limit)
        .orderBy('invoice.addedDate', 'DESC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const addedByIds = Array.from(
        new Set(data.map((o) => o.addedBy).filter(Boolean)),
      );
      const userMap = new Map<number, string>();
      if (addedByIds.length > 0) {
        const users = await this.userEntity.find({
          where: { userId: In(addedByIds) },
          select: ['userId', 'name'],
        });
        users.forEach((u) => userMap.set(u.userId, u.name));
      }

      const formattedData = data.map((o) => ({
        ...o,
        customerName: o.customer?.customerName ?? null,
        currencyCode: o.currency?.code ?? null,
        companyName: o.company?.companyName ?? null,
        salesPersonName: o.salesPerson?.name ?? null,
        bankBookName: o.bankBook?.accountNumber ?? null,
        addedByName: o.addedBy ? (userMap.get(o.addedBy) ?? null) : null,
      }));

      return_data = {
        success: 1,
        message: 'Invoices fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getInvoiceDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);

    const invoice = await this.invoiceRepo.findOne({
      where: { invoiceId: id },
      relations: [
        'customer',
        'currency',
        'company',
        'bankBook',
        'salesPerson',
        'contactPerson',
        'termsConditions',
        'invoiceItems',
        'invoiceItems.item',
        'invoiceItems.discounts',
        'invoiceItems.extraCharges',
        'discounts',
        'extraCharges',
        'attachments',
        'dueDateHistory',
      ],
    });

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

    const addedByUser = invoice.addedBy
      ? await this.userEntity.findOne({ where: { userId: invoice.addedBy } })
      : null;
    const updatedByUser = invoice.updatedBy
      ? await this.userEntity.findOne({ where: { userId: invoice.updatedBy } })
      : null;

    return {
      ...invoice,
      termsConditionsFileUrl: invoice.termsConditionsFile ?? null,
      customerName: invoice.customer?.customerName ?? null,
      currencyCode: invoice.currency?.code ?? null,
      currencySymbol: (invoice.currency as any)?.symbol ?? null,
      companyName: invoice.company?.companyName ?? null,
      salesPersonName: invoice.salesPerson?.name ?? null,
      contactPersonName: invoice.contactPerson?.name ?? null,
      bankBookName: invoice.bankBook?.accountNumber ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }

  async insertInvoice(
    body: InvoiceDto,
    req?: any,
    files?: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
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

      const sourceError = this.validateInvoiceSource(body);
      if (sourceError) return { success: 0, message: sourceError };

      const taxResult = await this.validateTaxGroups(
        body.invoiceItems,
        Number(body.companyId),
      );
      if (!taxResult.valid) return { success: 0, message: taxResult.message };
      const { rateMap } = taxResult;

      const invoiceCode = await this.codeGeneratorService.generateCode(
        this.invoiceRepo,
        'INV',
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
        deliveryType: body.deliveryType,
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
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Invoice created successfully',
        data: { insertData: insertId },
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
        const isContentUpdate =
          body.invoiceItems !== undefined ||
          body.invoiceDate !== undefined ||
          body.deliveryDate !== undefined ||
          body.bankBookId !== undefined ||
          body.salesPersonId !== undefined ||
          body.contactPersonId !== undefined ||
          body.remarks !== undefined ||
          body.termsConditionsId !== undefined ||
          body.vatWithheld !== undefined ||
          body.businessTerms !== undefined ||
          body.paymentType !== undefined ||
          body.deliveryTerms !== undefined ||
          body.discountApplicable !== undefined ||
          body.shippingState !== undefined ||
          body.billingState !== undefined ||
          body.deliveryState !== undefined ||
          body.deliveryType !== undefined;

        if (isContentUpdate) {
          return {
            success: 0,
            message: 'Only draft invoices can be fully edited.',
          };
        }
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
        const sourceError = this.validateInvoiceSource({
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
      if (body.deliveryType !== undefined) patch.deliveryType = body.deliveryType;
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

      return { success: 1, message: 'Invoice updated successfully' };
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

      if (invoice.status !== InvoiceStatus.DRAFT) {
        return { success: 0, message: 'Only draft invoices can be submitted' };
      }

      await this.invoiceRepo.update({ invoiceId }, { status: InvoiceStatus.UNPAID });

      this.invoicePdfService
        .generateAndStoreInvoicePdf(invoiceId)
        .catch((err: Error) =>
          console.error(
            `[PDF] Failed to generate invoice PDF for invoice ${invoiceId}:`,
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
          transition: 'DRAFT→UNPAID',
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return { success: 1, message: 'Invoice submitted successfully' };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async markAsPaid(invoiceId: number, req?: any) {
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

      await this.invoiceRepo.update({ invoiceId }, { status: InvoiceStatus.PAID });

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
          transition: `${invoice.status}→PAID`,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return { success: 1, message: 'Invoice marked as paid successfully' };
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
}
