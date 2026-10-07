import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { VaultService } from 'src/vault/vault.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
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
import { OrderEntity, OrderStatus, OrderLifecycleStatus } from 'src/order/entity/order.entity';
import { QuotationEntity, QuotationStatus } from 'src/quotation/entity/quotation.entity';
import { InvoiceListDto } from '../dto/invoice.dto';
import { ModSettings } from 'src/user/entity/mod.settings';

@Injectable()
export class InvoiceListService {
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

    private readonly filter: Filter,
    private readonly vaultService: VaultService,
  ) {}

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
        'sourceOrder',
        'sourceQuotation',
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

    const invoicePaymentMode = (process.env.INVOICE_PAYMENT_MODE || 'AUTOMATIC').toUpperCase();

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
      sourceOrderCode: invoice.sourceOrder?.orderCode ?? null,
      sourceQuotationCode: invoice.sourceQuotation?.quotationCode ?? null,
      invoicePaymentMode,
    };
  }

  async getInvoicePayments(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const invoice = await this.invoiceRepo.findOne({
      where: { invoiceId: id },
      relations: ['currency', 'company'],
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

    const { data, totalApplied } = await this.vaultService.getPaymentsForInvoice(id);
    return {
      success: 1,
      currencyCode: invoice.currency?.code ?? null,
      currencySymbol: (invoice.currency as any)?.symbol ?? null,
      finalAmount: Number(invoice.finalAmount),
      amountPaid: Number(invoice.amountPaid),
      totalApplied,
      data,
    };
  }
}
