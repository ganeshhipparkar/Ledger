import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Filter } from 'src/utilities/filter';
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
import { QuotationListDto } from './dto/quotation.dto';

@Injectable()
export class QuotationListService {
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

    private readonly filter: Filter,
  ) {}

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

    const allTaxGroups = await this.taxGroupRepo.find({ where: { companyId: Number(quotation.companyId) } });
    const taxGroupMap = new Map(allTaxGroups.map(tg => [tg.taxCode, tg.taxId]));
    const quotationItems = quotation.quotationItems?.map(item => ({
      ...item,
      taxId: item.taxGroup ? (taxGroupMap.get(item.taxGroup) ?? null) : null,
    })) || [];

    return {
      ...quotation,
      quotationItems,
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
}
