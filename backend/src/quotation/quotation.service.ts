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
      if (item.taxCalculation !== TaxCalculation.EXCLUSIVE || !item.taxGroup) continue;
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
    item: QuotationItemInputDto,
    taxRate: number,
  ): ComputedItemAmounts {
    const rawAmount = Number(item.quantity) * Number(item.unitPrice);
    const itemDiscount = (item.discounts ?? []).reduce(
      (s, d) => s + Number(d.discountPrice),
      0,
    );
    const itemExtraCharge = (item.extraCharges ?? []).reduce(
      (s, ec) => s + Number(ec.extraChargesPrice),
      0,
    );
    const totalAmount = rawAmount - itemDiscount + itemExtraCharge;
    const taxableAmount =
      item.taxCalculation === TaxCalculation.EXCLUSIVE ? totalAmount : 0;
    const taxAmount =
      Math.round(taxableAmount * taxRate / 100 * 10000) / 10000;
    const finalAmount = totalAmount + taxAmount;
    return { totalAmount, taxableAmount, taxAmount, finalAmount };
  }


  private computeQuotationTotals(
    computedItems: ComputedItemAmounts[],
    quotationDiscounts: QuotationDiscountInputDto[] | undefined,
    quotationExtraCharges: QuotationExtraChargeInputDto[] | undefined,
  ): ComputedQuotationTotals {
    const totalAmount = computedItems.reduce((s, i) => s + i.totalAmount, 0);
    const taxableAmount = computedItems.reduce((s, i) => s + i.taxableAmount, 0);
    const taxAmount = computedItems.reduce((s, i) => s + i.taxAmount, 0);
    const discount = (quotationDiscounts ?? []).reduce(
      (s, d) => s + Number(d.discountPrice),
      0,
    );
    const extraCharge = (quotationExtraCharges ?? []).reduce(
      (s, ec) => s + Number(ec.extraChargesPrice),
      0,
    );
    const finalAmount = totalAmount + taxAmount + extraCharge - discount;
    return { totalAmount, taxableAmount, taxAmount, discount, extraCharge, finalAmount };
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
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      // Filter out older superseded versions (only list main/current quotations)
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
        .orderBy('quotation.quotationCode', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((q) => ({
        ...q,
        customerName: q.customer?.customerName ?? null,
        currencyCode: q.currency?.code ?? null,
        companyName: q.company?.companyName ?? null,
        salesPersonName: q.salesPerson?.name ?? null,
        bankBookName: q.bankBook?.accountNumber ?? null,
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

// details 
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

    // Fetch older superseded versions of this quotation
    const versionHistory = await this.quotationRepo.find({
      where: { parentQuotationId: id },
      order: { addedDate: 'DESC' },
      select: [
        'quotationId',
        'quotationCode',
        'versionCode',
        'status',
        'finalAmount',
        'addedDate',
      ],
    });

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

      // 1. Company scope 
      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(body.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add quotation to another company',
          };
        }
      }

      // 2. Date validation
      const dateError = this.validateDates(body.issueDate, body.expiryDate);
      if (dateError) return { success: 0, message: dateError };

      // 3. Tax-group validation 
      const taxResult = await this.validateTaxGroups(
        body.quotationItems,
        Number(body.companyId),
      );
      if (!taxResult.valid) return { success: 0, message: taxResult.message };
      const { rateMap } = taxResult;

      // 4. Generate quotation code
      const quotationCode = await this.codeGeneratorService.generateCode(
        this.quotationRepo,
        body.customerId.toString(),
        Number(body.companyId),
        'quotationCode',
        'QUO',
      );

      // 5. currency code
      const currency = await this.currencyRepo.findOne({
        where: { curId: Number(body.currencyId) },
      });
      const currencyCode = currency?.code ?? '';

      // 6. Compute amounts
      const computedItems = body.quotationItems.map((item) =>
        this.computeItemAmounts(
          item,
          item.taxCalculation === TaxCalculation.EXCLUSIVE && item.taxGroup
            ? (rateMap.get(item.taxGroup) ?? 0)
            : 0,
        ),
      );
      const totals = this.computeQuotationTotals(
        computedItems,
        body.quotationDiscounts,
        body.quotationExtraCharges,
      );

      // 7. performer
      const { performerId, performerEmail } = this.resolvePerformer(req, body.addedBy);

      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 8. Insert main quotation row
      const quotationInsert = await queryRunner.manager.insert(QuotationEntity, {
        quotationCode,
        currencyId: Number(body.currencyId),
        currencyCode,
        customerId: Number(body.customerId),
        issueDate: new Date(body.issueDate),
        expiryDate: new Date(body.expiryDate),
        companyId: Number(body.companyId),
        remarks: body.remarks ?? undefined,
        termsConditionsId: body.termsConditionsId ?? null,
        termsConditionsText: body.termsConditionsText ?? undefined,
        bankBookId: body.bankBookId ?? null,
        accountNumber: body.accountNumber ?? undefined,
        salesPersonId: body.salesPersonId ?? null,
        currencyConversionRate: Number(body.currencyConversionRate),
        vatWithheld: body.vatWithheld,
        totalAmount: totals.totalAmount,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        discount: totals.discount || null,
        extraCharge: totals.extraCharge || null,
        finalAmount: totals.finalAmount,
        versionCode: body.versionCode || 'V1',
        parentQuotationId: null, // New quotation is main by default
        addedBy: performerId ? Number(performerId) : undefined,
        addedDate: new Date(),
      });
      const insertId: number = quotationInsert.raw?.insertId;

      // If this is a Change Quotation (new version of an existing quotation),
      // re-point the previous quotation's parentQuotationId to point to this new main quotation ID
      if (body.parentQuotationId) {
        await queryRunner.manager.update(
          QuotationEntity,
          { quotationId: Number(body.parentQuotationId) },
          { parentQuotationId: insertId },
        );
      }

      // 9. Insert quotation items + their line-level discounts/extra charges
      for (let i = 0; i < body.quotationItems.length; i++) {
        const item = body.quotationItems[i];
        const computed = computedItems[i];

        const itemInsert = await queryRunner.manager.insert(QuotationItemEntity, {
          quotationId: insertId,
          itemId: Number(item.itemId),
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

        // discounts
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

        // extra charges
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

      // 10. Insert quotation-level discounts
      for (const d of body.quotationDiscounts ?? []) {
        await queryRunner.manager.insert(QuotationDiscountEntity, {
          quotationId: insertId,
          quotationItemId: null,
          manufacturerId: d.manufacturerId ?? null,
          discountPrice: Number(d.discountPrice),
          discountDescription: d.discountDescription,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      // 11. Insert quotation-level extra charges
      for (const ec of body.quotationExtraCharges ?? []) {
        await queryRunner.manager.insert(QuotationExtraChargeEntity, {
          quotationId: insertId,
          quotationItemId: null,
          manufacturerId: ec.manufacturerId ?? null,
          extraChargesPrice: Number(ec.extraChargesPrice),
          extraChargesDescription: ec.extraChargesDescription,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      await queryRunner.commitTransaction();

      // 12. File uploads 

      // termsConditionsFile
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

      // 13. Activity log
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
      await queryRunner.rollbackTransaction();
      return { success: 0, message: err.message };
    } finally {
      await queryRunner.release();
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

      // 1. Load existing quotation
      const existing = await this.quotationRepo.findOne({
        where: { quotationId },
      });
      if (!existing) return { success: 0, message: 'Quotation not found' };

      // 2. Scope check
      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(existing.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update quotation of another company',
          };
        }
      }

      // 3. Date validation 
      if (body.issueDate || body.expiryDate) {
        const effectiveIssue = body.issueDate ?? String(existing.issueDate);
        const effectiveExpiry = body.expiryDate ?? String(existing.expiryDate);
        const dateError = this.validateDates(effectiveIssue, effectiveExpiry);
        if (dateError) return { success: 0, message: dateError };
      }

      // 4. Effective companyId for tax validation
      const effectiveCompanyId = body.companyId
        ? Number(body.companyId)
        : Number(existing.companyId);

      // 5. Tax-group validation + amount recomputation (only when items are being replaced)
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
            item.taxCalculation === TaxCalculation.EXCLUSIVE && item.taxGroup
              ? (rateMap.get(item.taxGroup) ?? 0)
              : 0,
          ),
        );
        totals = this.computeQuotationTotals(
          computedItems,
          body.quotationDiscounts,
          body.quotationExtraCharges,
        );
      }

      // 6. Resolve performer
      const { performerId, performerEmail } = this.resolvePerformer(req, body.updatedBy);

      // 7. Build patch object — only fields that were explicitly sent
      const patch: any = {};
      if (body.customerId !== undefined) patch.customerId = Number(body.customerId);
      if (body.currencyId !== undefined) {
        patch.currencyId = Number(body.currencyId);
        const cur = await this.currencyRepo.findOne({ where: { curId: Number(body.currencyId) } });
        patch.currencyCode = cur?.code ?? existing.currencyCode;
      }
      if (body.issueDate !== undefined) patch.issueDate = new Date(body.issueDate);
      if (body.expiryDate !== undefined) patch.expiryDate = new Date(body.expiryDate);
      if (body.companyId !== undefined) patch.companyId = Number(body.companyId);
      if (body.remarks !== undefined) patch.remarks = body.remarks;
      if (body.termsConditionsId !== undefined) patch.termsConditionsId = body.termsConditionsId ?? null;
      if (body.termsConditionsText !== undefined) patch.termsConditionsText = body.termsConditionsText ?? null;
      if (body.bankBookId !== undefined) patch.bankBookId = body.bankBookId ?? null;
      if (body.accountNumber !== undefined) patch.accountNumber = body.accountNumber ?? null;
      if (body.salesPersonId !== undefined) patch.salesPersonId = body.salesPersonId ?? null;
      if (body.currencyConversionRate !== undefined) patch.currencyConversionRate = Number(body.currencyConversionRate);
      if (body.vatWithheld !== undefined) patch.vatWithheld = body.vatWithheld;
      if (body.status !== undefined) patch.status = body.status; // no transition guard per plan

      // Include recomputed financial columns if items were replaced
      if (totals) {
        patch.totalAmount = totals.totalAmount;
        patch.taxableAmount = totals.taxableAmount;
        patch.taxAmount = totals.taxAmount;
        patch.discount = totals.discount || null;
        patch.extraCharge = totals.extraCharge || null;
        patch.finalAmount = totals.finalAmount;
      }

      if (performerId) patch.updatedBy = Number(performerId);
      patch.updatedDate = new Date();

      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 8. Update main quotation row
      if (Object.keys(patch).length > 0) {
        await queryRunner.manager.update(QuotationEntity, { quotationId }, patch);
      }

      // 9. Replace line items (full delete-then-reinsert)
      if (body.quotationItems && body.quotationItems.length > 0 && computedItems) {
        // Find existing item IDs to delete their child rows first
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

          const itemInsert = await queryRunner.manager.insert(QuotationItemEntity, {
            quotationId,
            itemId: Number(item.itemId),
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

      // 10. Replace quotation-level discounts (if sent)
      if (body.quotationDiscounts !== undefined) {
        await queryRunner.manager.delete(QuotationDiscountEntity, {
          quotationId,
          quotationItemId: null,  // only quotation-level rows
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

      // 11. Replace quotation-level extra charges (if sent)
      if (body.quotationExtraCharges !== undefined) {
        await queryRunner.manager.delete(QuotationExtraChargeEntity, {
          quotationId,
          quotationItemId: null,  // only quotation-level rows
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

      // 12. Delete selected attachments (outside transaction)
      if (body.deletedAttachmentIds && body.deletedAttachmentIds.length > 0) {
        const toDelete = await this.attachmentRepo.find({
          where: { quotationAttachmentId: In(body.deletedAttachmentIds), quotationId },
        });
        for (const att of toDelete) {
          const relativePath = att.attachmentUrl.startsWith('/')
            ? att.attachmentUrl.substring(1)
            : att.attachmentUrl;
          const fullPath = path.resolve('.', relativePath);
          if (fs.existsSync(fullPath)) {
            try { await fs.promises.unlink(fullPath); } catch { /* ignore ENOENT */ }
          }
        }
        await this.attachmentRepo.delete({
          quotationAttachmentId: In(body.deletedAttachmentIds),
          quotationId,
        });
      }

      // 13. Append new attachments (outside transaction)
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

      // 14. Replace termsConditionsFile if a new one was uploaded (outside transaction)
      // Old physical file is NOT deleted — matches item image append pattern
      const termsFile = files?.termsConditionsFile?.[0];
      if (termsFile) {
        const termsFilename = termsFile.filename || termsFile.originalname;
        await this.fileTransfer.fileTransfer(termsFilename, quotationId, 'quotation', { subfolder: 'terms' });
        await this.quotationRepo.update(
          { quotationId },
          { termsConditionsFile: `/upload/quotation/${quotationId}/terms/${termsFilename}` },
        );
      }

      // 15. Activity log
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

      return { success: 1, message: 'Quotation updated successfully' };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      return { success: 0, message: err.message };
    } finally {
      await queryRunner.release();
    }
  }
}