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
import { ActivityCode } from '../activity/enums/activity-code.enum';
import { Filter } from 'src/utilities/filter';
import { FileTransfer } from 'src/utilities/file.transfer';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { QuotationEntity } from './entity/quotation.entity';
import { QuotationItemEntity } from './entity/quotation.item.entity';
import { QuotationDiscountEntity } from './entity/quotation.discount.entity';
import { QuotationExtraChargeEntity } from './entity/quotation.extra.charge.entity';
import { QuotationAttachmentsEntity } from './entity/quotation.attachments';
import {
  QuotationDiscountInputDto,
  QuotationDto,
  QuotationExtraChargeInputDto,
  QuotationItemInputDto,
  QuotationListDto,
  QuotationUpdateDto,
} from './dto/quotation.dto';
import { TaxCalculation } from './entity/quotation.item.entity';
import { QuotationPdfService } from './quotation.pdf.service';


interface ComputedItemAmounts {
  totalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  finalAmount: number;
}

interface ComputedQuotationTotals {
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
export class QuotationService {
  constructor(
    @InjectRepository(QuotationEntity)
    private readonly quotationRepo: Repository<QuotationEntity>,

    @InjectRepository(QuotationItemEntity)
    private readonly quotationItemRepo: Repository<QuotationItemEntity>,

    @InjectRepository(QuotationDiscountEntity)
    private readonly discountRepo: Repository<QuotationDiscountEntity>,

    @InjectRepository(QuotationExtraChargeEntity)
    private readonly extraChargeRepo: Repository<QuotationExtraChargeEntity>,

    @InjectRepository(QuotationAttachmentsEntity)
    private readonly attachmentRepo: Repository<QuotationAttachmentsEntity>,

    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,

    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,

    @InjectRepository(CurrencyEntity)
    private readonly currencyRepo: Repository<CurrencyEntity>,

    @InjectRepository(taxGroupEntity)
    private readonly taxGroupRepo: Repository<taxGroupEntity>,

    private readonly eventEmitter: EventEmitter2,
    private readonly fileTransfer: FileTransfer,
    private readonly dataSource: DataSource,
    private readonly quotationPdfService: QuotationPdfService,
  ) {}

  @Inject()
  private readonly filter!: Filter;

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

  private async validateTaxGroups(
    items: QuotationItemInputDto[],
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

  private toValidNumber(val: any, fallback: number = 0): number {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  }

  private toOptionalNumber(val: any): number | undefined {
    if (val === undefined || val === null || val === '' || val === 'undefined' || val === 'null') return undefined;
    const n = Number(val);
    return isNaN(n) ? undefined : n;
  }

  private computeItemAmounts(
    item: QuotationItemInputDto,
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


  private computeQuotationTotals(
    computedItems: ComputedItemAmounts[],
    quotationDiscounts: QuotationDiscountInputDto[] | undefined,
    quotationExtraCharges: QuotationExtraChargeInputDto[] | undefined,
    vatWithheld: string,
  ): ComputedQuotationTotals {
    const totalAmount = computedItems.reduce((s, i) => s + this.toValidNumber(i.totalAmount, 0), 0);
    const taxableAmount = computedItems.reduce((s, i) => s + this.toValidNumber(i.taxableAmount, 0), 0);
    const taxAmount = computedItems.reduce((s, i) => s + this.toValidNumber(i.taxAmount, 0), 0);
    const discount = (quotationDiscounts ?? []).reduce(
      (s, d) => s + this.toValidNumber(d.discountPrice, 0),
      0,
    );
    const extraCharge = (quotationExtraCharges ?? []).reduce(
      (s, ec) => s + this.toValidNumber(ec.extraChargesPrice, 0),
      0,
    );
    const vatWithheldAmount = vatWithheld === 'YES' ? taxAmount : 0;
    const itemsFinalTotal = computedItems.reduce((s, i) => s + this.toValidNumber(i.finalAmount, 0), 0);
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

  private validateDates(issueDate: string, expiryDate: string): string | null {
    const issue = new Date(issueDate);
    const expiry = new Date(expiryDate);
    if (isNaN(issue.getTime())) return 'Invalid issueDate';
    if (isNaN(expiry.getTime())) return 'Invalid expiryDate';
    if (issue >= expiry) return 'expiryDate must be after issueDate';
    const diffDays = Math.floor(
      (expiry.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays < 15)
      return 'expiryDate must be at least 15 days after issueDate';
    return null;
  }

  async quotationList(param: QuotationListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.quotationRepo.createQueryBuilder('quotation');

      if (!authCtx.isSuperAdmin) {  
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'quotation.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Quotations fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'quotation',
        {
          customerName: 'customer',
          companyName: 'company',
        },
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      queryBuilder.andWhere('(quotation.parentQuotationId IS NULL OR quotation.parentQuotationId = 0)');

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.quotationRepo,
      )) as [number, number];

      queryBuilder
        .leftJoinAndSelect('quotation.customer', 'customer')
        .leftJoinAndSelect('quotation.currency', 'currency')
        .leftJoinAndSelect('quotation.company', 'company')
        .leftJoinAndSelect('quotation.salesPerson', 'salesPerson')
        .leftJoinAndSelect('quotation.bankBook', 'bankBook')
        .skip(skip)
        .take(limit)
        .orderBy('quotation.addedDate', 'DESC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const addedByIds = Array.from(
        new Set(data.map((q) => q.addedBy).filter(Boolean)),
      );
      const userMap = new Map<number, string>();
      if (addedByIds.length > 0) {
        const users = await this.userEntity.find({
          where: { userId: In(addedByIds) },
          select: ['userId', 'name'],
        });
        users.forEach((u) => userMap.set(u.userId, u.name));
      }

      const formattedData = data.map((q) => ({
        ...q,
        customerName: q.customer?.customerName ?? null,
        currencyCode: q.currency?.code ?? null,
        companyName: q.company?.companyName ?? null,
        salesPersonName: q.salesPerson?.name ?? null,
        bankBookName: q.bankBook?.accountNumber ?? null,
        addedByName: q.addedBy ? (userMap.get(q.addedBy) ?? null) : null,
      }));

      return_data = {
        success: 1,
        message: 'Quotations fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getQuotationDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);

    const quotation = await this.quotationRepo.findOne({
      where: { quotationId: id },
      relations: [
        'customer',
        'currency',
        'company',
        'bankBook',
        'salesPerson',
        'termsConditions',
        'quotationItems',
        'quotationItems.item',
        'quotationItems.discounts',
        'quotationItems.extraCharges',
        'discounts',
        'extraCharges',
        'attachments',
      ],

    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
      if (!scopedCompanyIds.includes(Number(quotation.companyId))) {
        throw new ForbiddenException(
          'Access denied: quotation belongs to another company',
        );
      }
    }

    const addedByUser = quotation.addedBy
      ? await this.userEntity.findOne({ where: { userId: quotation.addedBy } })
      : null;
    const updatedByUser = quotation.updatedBy
      ? await this.userEntity.findOne({ where: { userId: quotation.updatedBy } })
      : null;

    const versionHistoryRaw = await this.quotationRepo.find({
      where: { parentQuotationId: id },
      order: { addedDate: 'DESC' },
      select: [
        'quotationId',
        'quotationCode',
        'versionCode',
        'status',
        'finalAmount',
        'addedDate',
        'issueDate',
        'expiryDate',
        'addedBy',
      ],
    });

    const userIds = [...new Set(versionHistoryRaw.map(v => v.addedBy).filter(Boolean))];
    const users = userIds.length > 0 ? await this.userEntity.find({ where: { userId: In(userIds) } }) : [];
    const userMap = new Map(users.map(u => [u.userId, u.name]));

    const versionHistory = versionHistoryRaw.map(v => ({
      ...v,
      addedByName: v.addedBy ? userMap.get(v.addedBy) || null : null,
    }));

    return {
      ...quotation,
      customerName: quotation.customer?.customerName ?? null,
      currencyCode: quotation.currency?.code ?? null,
      currencySymbol: quotation.currency?.symbol ?? null,
      companyName: quotation.company?.companyName ?? null,
      salesPersonName: quotation.salesPerson?.name ?? null,
      bankBookName: quotation.bankBook?.accountNumber ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
      versionHistory: versionHistory || [],
    };
  }

  async insertQuotation(
    body: QuotationDto,
    req?: any,
    files?: { attachments?: Express.Multer.File[]; termsConditionsFile?: Express.Multer.File[] },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(body.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add quotation to another company',
          };
        }
      }

      const dateError = this.validateDates(body.issueDate, body.expiryDate);
      if (dateError) return { success: 0, message: dateError };

      const taxResult = await this.validateTaxGroups(
        body.quotationItems,
        Number(body.companyId),
      );
      if (!taxResult.valid) return { success: 0, message: taxResult.message };
      const { rateMap } = taxResult;

      const quotationCode = await this.codeGeneratorService.generateCode(
        this.quotationRepo,
        `QN${body.customerId}`,
        Number(body.companyId),
        'quotationCode',
      );

      const currency = await this.currencyRepo.findOne({
        where: { curId: Number(body.currencyId) },
      });
      const currencyCode = currency?.code ?? '';

      const computedItems = body.quotationItems.map((item) =>
        this.computeItemAmounts(
          item,
          (item.taxCalculation === TaxCalculation.EXCLUSIVE || item.taxCalculation === TaxCalculation.INCLUSIVE) && item.taxGroup
            ? (rateMap.get(item.taxGroup) ?? 0)
            : 0,
        ),
      );
      const totals = this.computeQuotationTotals(
        computedItems,
        body.quotationDiscounts,
        body.quotationExtraCharges,
        body.vatWithheld,
      );

      const { performerId, performerEmail } = this.resolvePerformer(req, body.addedBy);

      await queryRunner.connect();
      await queryRunner.startTransaction();

      const quotationInsert = await queryRunner.manager.insert(QuotationEntity, {
        quotationCode,
        currencyId: this.toValidNumber(body.currencyId),
        currencyCode,
        customerId: this.toValidNumber(body.customerId),
        issueDate: new Date(body.issueDate),
        expiryDate: new Date(body.expiryDate),
        companyId: this.toValidNumber(body.companyId),
        remarks: body.remarks ?? undefined,
        termsConditionsId: this.toOptionalNumber(body.termsConditionsId) ?? null,
        termsConditionsText: body.termsConditionsText ?? undefined,
        bankBookId: this.toOptionalNumber(body.bankBookId) ?? null,
        accountNumber: body.accountNumber ?? undefined,
        salesPersonId: this.toOptionalNumber(body.salesPersonId) ?? null,
        currencyConversionRate: this.toValidNumber(body.currencyConversionRate, 1),
        vatWithheld: body.vatWithheld,  
        totalAmount: this.toValidNumber(totals.totalAmount, 0),
        taxableAmount: this.toValidNumber(totals.taxableAmount, 0),
        taxAmount: this.toValidNumber(totals.taxAmount, 0),
        discount: this.toValidNumber(totals.discount, 0) || null,
        extraCharge: this.toValidNumber(totals.extraCharge, 0) || null,
        vatWithheldAmount: this.toValidNumber(totals.vatWithheldAmount, 0),
        finalAmount: this.toValidNumber(totals.finalAmount, 0),
        versionCode: body.versionCode || 'V1',
        parentQuotationId: null, 
        status: body.status ?? 'DRAFT',
        addedBy: this.toOptionalNumber(performerId),
        addedDate: new Date(),
      });
      const insertId: number = quotationInsert.raw?.insertId;

      if (body.parentQuotationId) {
        const parentId = this.toValidNumber(body.parentQuotationId);
        const parentQuotation = await queryRunner.manager.findOne(QuotationEntity, {
          where: { quotationId: parentId },
        });

        if (!parentQuotation) {
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          return { success: 0, message: 'Parent quotation not found.' };
        }

        if (parentQuotation.parentQuotationId !== null) {
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          return { success: 0, message: 'Only the latest version of a quotation can perform this action.' };
        }

        if (parentQuotation.status !== 'SUBMITTED') {
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          return { success: 0, message: 'Only submitted quotations can be changed.' };
        }

        await queryRunner.manager.update(
          QuotationEntity,
          [
            { quotationId: parentId },
            { parentQuotationId: parentId },
          ],
          { parentQuotationId: insertId },
        );
      }

      if (body.cloneFromId) {
        const cloneFromId = this.toValidNumber(body.cloneFromId);
        const sourceQuotation = await queryRunner.manager.findOne(QuotationEntity, {
          where: { quotationId: cloneFromId },
        });

        if (sourceQuotation && sourceQuotation.parentQuotationId !== null) {
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          return { success: 0, message: 'Only the latest version of a quotation can perform this action.' };
        }
      }

      for (let i = 0; i < body.quotationItems.length; i++) {
        const item = body.quotationItems[i];

        const computed = computedItems[i];

        const validItemId = this.toOptionalNumber(item.itemId);
        if ((!validItemId || validItemId <= 0) && !item.description?.trim()) {
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          return { success: 0, message: `Row ${i + 1}: Valid item selection or description is required.` };
        }

        const itemInsert = await queryRunner.manager.insert(QuotationItemEntity, {
          quotationId: insertId,
          itemId: validItemId,
          description: item.description ?? null,
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
          await queryRunner.manager.insert(QuotationDiscountEntity, {
            quotationItemId: itemInsertId,
            quotationId: null,
            manufacturerId: this.toOptionalNumber(d.manufacturerId) ?? null,
            discountPrice: this.toValidNumber(d.discountPrice, 0),
            discountDescription: d.discountDescription,
            addedBy: this.toOptionalNumber(performerId),
            addedDate: new Date(),
          });
        }

        for (const ec of item.extraCharges ?? []) {
          await queryRunner.manager.insert(QuotationExtraChargeEntity, {
            quotationItemId: itemInsertId,
            quotationId: null,
            manufacturerId: this.toOptionalNumber(ec.manufacturerId) ?? null,
            extraChargesPrice: this.toValidNumber(ec.extraChargesPrice, 0),
            extraChargesDescription: ec.extraChargesDescription,
            addedBy: this.toOptionalNumber(performerId),
            addedDate: new Date(),
          });
        }
      }

      for (const d of body.quotationDiscounts ?? []) {
        await queryRunner.manager.insert(QuotationDiscountEntity, {
          quotationId: insertId,
          quotationItemId: null,
          manufacturerId: this.toOptionalNumber(d.manufacturerId) ?? null,
          discountPrice: this.toValidNumber(d.discountPrice, 0),
          discountDescription: d.discountDescription,
          addedBy: this.toOptionalNumber(performerId),
          addedDate: new Date(),
        });
      }

      for (const ec of body.quotationExtraCharges ?? []) {
        await queryRunner.manager.insert(QuotationExtraChargeEntity, {
          quotationId: insertId,
          quotationItemId: null,
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
        await this.fileTransfer.fileTransfer(termsFilename, insertId, 'quotation', { subfolder: 'terms' });
        const termsUrl = `/upload/quotation/${insertId}/terms/${termsFilename}`;
        await this.quotationRepo.update({ quotationId: insertId }, { termsConditionsFile: termsUrl });
      }

      // Attachments
      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransfer(filename, insertId, 'quotation', { subfolder: 'attachments' });
        await this.attachmentRepo.insert({
          quotationId: insertId,
          attachmentUrl: `/upload/quotation/${insertId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.QUOTATION_CREATE,
        userId: performerId,
        companyId: Number(body.companyId),
        actorType: 'USER',
        targetType: 'QUOTATION',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          quotationCode,
          customerId: body.customerId,
          companyId: body.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Quotation created successfully',
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


  async updateQuotation(
    body: QuotationUpdateDto & { updatedBy?: number },
    req?: any,
    files?: { attachments?: Express.Multer.File[]; termsConditionsFile?: Express.Multer.File[] },
  ) {
    if (!body.quotationId) {
      return { success: 0, message: 'quotationId is mandatory' };
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const quotationId = Number(body.quotationId);

      // Load existing quotation
      const existing = await this.quotationRepo.findOne({
        where: { quotationId },
      });
      if (!existing) return { success: 0, message: 'Quotation not found' };

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(existing.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update quotation of another company',
          };
        }
      }

      if (existing.parentQuotationId !== null) {
        return { success: 0, message: 'Only the latest version of a quotation can perform this action.' };
      }

      if (existing.status !== 'DRAFT') {
        const isContentUpdate =
          body.quotationItems !== undefined ||
          body.customerId !== undefined ||
          body.currencyId !== undefined ||
          body.issueDate !== undefined ||
          body.expiryDate !== undefined ||
          body.bankBookId !== undefined ||
          body.salesPersonId !== undefined ||
          body.remarks !== undefined ||
          body.termsConditionsId !== undefined ||
          body.vatWithheld !== undefined;

        if (isContentUpdate) {
          return {
            success: 0,
            message: 'Only draft quotations can be edited.',
          };
        }
      }

      // Date validation 
      if (body.issueDate || body.expiryDate) {
        const effectiveIssue = body.issueDate ?? String(existing.issueDate);
        const effectiveExpiry = body.expiryDate ?? String(existing.expiryDate);
        const dateError = this.validateDates(effectiveIssue, effectiveExpiry);
        if (dateError) return { success: 0, message: dateError };
      }

      //tax validation
      const effectiveCompanyId = body.companyId
        ? Number(body.companyId)
        : Number(existing.companyId);

      // Tax-group validation + amount recomputation (only when items are being replaced)
      let computedItems: ComputedItemAmounts[] | null = null;
      let totals: ComputedQuotationTotals | null = null;
      let rateMap: Map<string, number> = new Map();

      if (body.quotationItems && body.quotationItems.length > 0) {
        const taxResult = await this.validateTaxGroups(
          body.quotationItems,
          effectiveCompanyId,
        );
        if (!taxResult.valid) return { success: 0, message: taxResult.message };
        rateMap = taxResult.rateMap;

        computedItems = body.quotationItems.map((item) =>
          this.computeItemAmounts(
            item,
            (item.taxCalculation === TaxCalculation.EXCLUSIVE || item.taxCalculation === TaxCalculation.INCLUSIVE) && item.taxGroup
              ? (rateMap.get(item.taxGroup) ?? 0)
              : 0,
          ),
        );
        totals = this.computeQuotationTotals(
          computedItems,
          body.quotationDiscounts,
          body.quotationExtraCharges,
          body.vatWithheld ?? existing.vatWithheld,
        );
      }

      // performer
      const { performerId, performerEmail } = this.resolvePerformer(req, body.updatedBy);

      const patch: any = {};
      if (body.customerId !== undefined) patch.customerId = this.toValidNumber(body.customerId, existing.customerId);
      if (body.currencyId !== undefined) {
        const curId = this.toValidNumber(body.currencyId, existing.currencyId);
        patch.currencyId = curId;
        const cur = await this.currencyRepo.findOne({ where: { curId } });
        patch.currencyCode = cur?.code ?? existing.currencyCode;
      }
      if (body.issueDate !== undefined) patch.issueDate = new Date(body.issueDate);
      if (body.expiryDate !== undefined) patch.expiryDate = new Date(body.expiryDate);
      if (body.companyId !== undefined) patch.companyId = this.toValidNumber(body.companyId, existing.companyId);
      if (body.remarks !== undefined) patch.remarks = body.remarks;
      if (body.termsConditionsId !== undefined) patch.termsConditionsId = this.toOptionalNumber(body.termsConditionsId) ?? null;
      if (body.termsConditionsText !== undefined) patch.termsConditionsText = body.termsConditionsText ?? null;
      if (body.bankBookId !== undefined) patch.bankBookId = this.toOptionalNumber(body.bankBookId) ?? null;
      if (body.accountNumber !== undefined) patch.accountNumber = body.accountNumber ?? null;
      if (body.salesPersonId !== undefined) patch.salesPersonId = this.toOptionalNumber(body.salesPersonId) ?? null;
      if (body.currencyConversionRate !== undefined) patch.currencyConversionRate = this.toValidNumber(body.currencyConversionRate, existing.currencyConversionRate || 1);
      if (body.vatWithheld !== undefined) patch.vatWithheld = body.vatWithheld;
      if (body.status !== undefined) patch.status = body.status;

      const isBeingConfirmed =
        body.status === 'CONFIRMED' && existing.status !== 'CONFIRMED';

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
        await queryRunner.manager.update(QuotationEntity, { quotationId }, patch);
      }

      if (body.quotationItems && body.quotationItems.length > 0 && computedItems) {
        const existingItems = await queryRunner.manager.find(QuotationItemEntity, {
          where: { quotationId },
          select: ['quotationItemId'],
        });
        const existingItemIds = existingItems.map((i) => i.quotationItemId);

        if (existingItemIds.length > 0) {
          await queryRunner.manager.delete(QuotationDiscountEntity, {
            quotationItemId: In(existingItemIds),
          });
          await queryRunner.manager.delete(QuotationExtraChargeEntity, {
            quotationItemId: In(existingItemIds),
          });
        }
        await queryRunner.manager.delete(QuotationItemEntity, { quotationId });

        // Re-insert
        for (let i = 0; i < body.quotationItems.length; i++) {
          const item = body.quotationItems[i];
          const computed = computedItems[i];

          const validItemId = this.toOptionalNumber(item.itemId);
          if ((!validItemId || validItemId <= 0) && !item.description?.trim()) {
            if (queryRunner.isTransactionActive) {
              await queryRunner.rollbackTransaction();
            }
            return { success: 0, message: `Row ${i + 1}: Valid item selection or description is required.` };
          }

          const itemInsert = await queryRunner.manager.insert(QuotationItemEntity, {
            quotationId,
            itemId: validItemId,
            description: item.description ?? null,
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
            await queryRunner.manager.insert(QuotationDiscountEntity, {
              quotationItemId: itemInsertId,
              quotationId: null,
              manufacturerId: d.manufacturerId ?? null,
              discountPrice: Number(d.discountPrice),
              discountDescription: d.discountDescription,
              addedBy: performerId ? Number(performerId) : undefined,
              addedDate: new Date(),
            });  
          }

          for (const ec of item.extraCharges ?? []) {
            await queryRunner.manager.insert(QuotationExtraChargeEntity, {
              quotationItemId: itemInsertId,
              quotationId: null,
              manufacturerId: ec.manufacturerId ?? null,
              extraChargesPrice: Number(ec.extraChargesPrice),
              extraChargesDescription: ec.extraChargesDescription,  
              addedBy: performerId ? Number(performerId) : undefined,
              addedDate: new Date(),
            });
          }
        }
      }

      // Replace quotation discounts
      if (body.quotationDiscounts !== undefined) {
        await queryRunner.manager.delete(QuotationDiscountEntity, {
          quotationId,
          quotationItemId: null,  
        });
        for (const d of body.quotationDiscounts) {
          await queryRunner.manager.insert(QuotationDiscountEntity, {
            quotationId,
            quotationItemId: null,
            manufacturerId: d.manufacturerId ?? null,
            discountPrice: Number(d.discountPrice),
            discountDescription: d.discountDescription,
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
        }
      }

      // eplace quotation extra charges (if sent)
      if (body.quotationExtraCharges !== undefined) {
        await queryRunner.manager.delete(QuotationExtraChargeEntity, {
          quotationId,
          quotationItemId: null, 
        });
        for (const ec of body.quotationExtraCharges) {
          await queryRunner.manager.insert(QuotationExtraChargeEntity, {
            quotationId,
            quotationItemId: null,
            manufacturerId: ec.manufacturerId ?? null,
            extraChargesPrice: Number(ec.extraChargesPrice),
            extraChargesDescription: ec.extraChargesDescription,
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
        }
      }

      await queryRunner.commitTransaction();



      // Append new attachments 
      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransfer(filename, quotationId, 'quotation', { subfolder: 'attachments' });
        await this.attachmentRepo.insert({
          quotationId,
          attachmentUrl: `/upload/quotation/${quotationId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      const termsFile = files?.termsConditionsFile?.[0];
      if (termsFile) {
        const termsFilename = termsFile.filename || termsFile.originalname;
        await this.fileTransfer.fileTransfer(termsFilename, quotationId, 'quotation', { subfolder: 'terms' });
        await this.quotationRepo.update(
          { quotationId },
          { termsConditionsFile: `/upload/quotation/${quotationId}/terms/${termsFilename}` },
        );
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.QUOTATION_UPDATE,
        userId: performerId,
        companyId: existing.companyId,
        actorType: 'USER',
        targetType: 'QUOTATION',
        targetId: String(quotationId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          quotationCode: existing.quotationCode,
          status: body.status ?? existing.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      if (isBeingConfirmed) {
        try {
          await this.quotationPdfService.generateAndStoreInvoicePdf(quotationId);
        } catch (err: any) {
          console.error(`[PDF] Failed to generate invoice for quotation ${quotationId}:`, err.message);
        }
      }

      return { success: 1, message: 'Quotation updated successfully' };
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

  async deleteQuotationAttachment(attachmentId: number, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const att = await this.attachmentRepo.findOne({
        where: { quotationAttachmentId: attachmentId },
      });
      if (!att) {
        throw new NotFoundException('Quotation attachment not found');
      }

      const quotation = await this.quotationRepo.findOne({
        where: { quotationId: att.quotationId },
      });
      if (!quotation) {
        throw new NotFoundException('Associated quotation not found');
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(quotation.companyId))) {
          throw new ForbiddenException(
            'Access denied: quotation attachment belongs to another company',
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
        } catch {
        }
      }

      await this.attachmentRepo.delete({ quotationAttachmentId: attachmentId });

      return {
        success: 1,
        message: 'Quotation attachment deleted successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async deleteQuotationTermsFile(quotationId: number, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const quotation = await this.quotationRepo.findOne({
        where: { quotationId },
      });
      if (!quotation) {
        throw new NotFoundException('Quotation not found');
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(quotation.companyId))) {
          throw new ForbiddenException(
            'Access denied: quotation belongs to another company',
          );
        }
      }

      if (quotation.termsConditionsFile) {
        const relativePath = quotation.termsConditionsFile.startsWith('/')
          ? quotation.termsConditionsFile.substring(1)
          : quotation.termsConditionsFile;
        const fullPath = path.resolve('.', relativePath);
        if (fs.existsSync(fullPath)) {
          try {
            await fs.promises.unlink(fullPath);
          } catch {
          }
        }

        await this.quotationRepo.update(
          { quotationId },
          { termsConditionsFile: null },
        );
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