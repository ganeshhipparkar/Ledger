import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { Filter } from 'src/utilities/filter';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { InvoiceEntity, InvoiceStatus } from 'src/invoice/entity/invoice.entity';
import { TaxCalculation } from 'src/invoice/entity/invoice.item.entity';
import { DebitNoteEntity, DebitNoteStatus } from '../entity/debit.note.entity';
import { DebitNoteAttachmentsEntity } from '../entity/debit.note.attachments.entity';
import { DebitNoteListDto } from '../dto/debit.note.dto';

@Injectable()
export class DebitNoteListService {
  constructor(
    @InjectRepository(DebitNoteEntity)
    private readonly debitNoteRepo: Repository<DebitNoteEntity>,

    @InjectRepository(DebitNoteAttachmentsEntity)
    private readonly attachmentRepo: Repository<DebitNoteAttachmentsEntity>,

    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgRepo: Repository<UserCompanyGroupEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(taxGroupEntity)
    private readonly taxGroupRepo: Repository<taxGroupEntity>,

    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,

    private readonly filter: Filter,
  ) {}

  async invoicesByCustomer(customerId: number, currencyId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgRepo);
      const eligibleStatuses = [InvoiceStatus.UNPAID, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID];

      const qb = this.invoiceRepo
        .createQueryBuilder('invoice')
        .select(['invoice.invoiceId', 'invoice.invoiceCode', 'invoice.status', 'invoice.currencyId'])
        .leftJoinAndSelect('invoice.currency', 'currency')
        .where('invoice.customerId = :customerId', { customerId })
        .andWhere('invoice.currencyId = :currencyId', { currencyId })
        .andWhere('invoice.status IN (:...statuses)', { statuses: eligibleStatuses });

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (scopedCompanyIds.length > 0) {
          qb.andWhere('invoice.companyId IN (:...scopedCompanyIds)', { scopedCompanyIds });
        } else {
          return { success: 1, data: [] };
        }
      }

      const invoices = await qb.getMany();
      return {
        success: 1,
        data: invoices.map((inv) => ({
          invoiceId: inv.invoiceId,
          invoiceCode: inv.invoiceCode,
          status: inv.status,
          currencyId: inv.currencyId,
          currencyCode: (inv.currency as any)?.code ?? null,
          currencySymbol: (inv.currency as any)?.symbol ?? null,
        })),
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async debitNoteList(param: DebitNoteListDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgRepo);
      const qb = this.debitNoteRepo
        .createQueryBuilder('cn')
        .leftJoinAndSelect('cn.customer', 'customer')
        .leftJoinAndSelect('cn.currency', 'currency')
        .leftJoinAndSelect('cn.invoice', 'invoice')
        .leftJoinAndSelect('cn.company', 'company');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (scopedCompanyIds.length > 0) {
          qb.andWhere('cn.companyId IN (:...scopedCompanyIds)', { scopedCompanyIds });
        } else {
          return { success: 1, message: 'Credit notes fetched successfully', total: 0, data: [] };
        }
      }

      const filterStr = await this.filter.makeFilterString(
        param.filters,
        'cn',
        {
          customerName: 'customer',
          companyName: 'company',
        },
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (filterStr && filterStr !== '') qb.andWhere(filterStr);

      const [skip, limit] = (await this.filter.calcPages(param, this.debitNoteRepo)) as [number, number];
      qb.skip(skip).take(limit).orderBy('cn.id', 'DESC');

      const [data, total] = await qb.getManyAndCount();

      const addedByIds = [...new Set(data.map((r) => r.addedBy).filter(Boolean))] as number[];
      const userMap = new Map<number, string>();
      if (addedByIds.length > 0) {
        const users = await this.userRepo.find({ where: { userId: In(addedByIds) }, select: ['userId', 'name'] });
        users.forEach((u) => userMap.set(u.userId, u.name));
      }

      const formatted = data.map((cn) => ({
        ...cn,
        customerName: cn.customer?.customerName ?? null,
        currencyCode: (cn.currency as any)?.code ?? null,
        currencySymbol: (cn.currency as any)?.symbol ?? null,
        invoiceCode: cn.invoice?.invoiceCode ?? null,
        companyName: cn.company?.companyName ?? null,
        addedByName: cn.addedBy ? (userMap.get(cn.addedBy) ?? null) : null,
      }));

      return { success: 1, message: 'Credit notes fetched successfully', total, data: formatted };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async debitNoteDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgRepo);

    const cn = await this.debitNoteRepo.findOne({
      where: { id },
      relations: ['customer', 'currency', 'invoice', 'company', 'taxGroup', 'attachments'],
    });

    if (!cn) throw new NotFoundException('Credit note not found');

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
      if (!scopedCompanyIds.includes(Number(cn.companyId))) {
        throw new ForbiddenException('Access denied: credit note belongs to another company');
      }
    }

    const addedByUser = cn.addedBy
      ? await this.userRepo.findOne({ where: { userId: cn.addedBy } })
      : null;

    return {
      ...cn,
      customerName: cn.customer?.customerName ?? null,
      currencyCode: (cn.currency as any)?.code ?? null,
      currencySymbol: (cn.currency as any)?.symbol ?? null,
      invoiceCode: cn.invoice?.invoiceCode ?? null,
      companyName: cn.company?.companyName ?? null,
      taxGroupName: cn.taxGroup?.taxName ?? null,
      taxGroupCode: cn.taxGroup?.taxCode ?? null,
      taxGroupValue: cn.taxGroup?.taxValue ?? null,
      addedByName: addedByUser?.name ?? null,
    };
  }

  async invoiceItems(invoiceId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgRepo);
      const invoice = await this.invoiceRepo.findOne({
        where: { invoiceId },
        relations: ['invoiceItems', 'invoiceItems.item', 'customer', 'currency'],
      });

      if (!invoice) return { success: 0, message: 'Invoice not found' };

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(invoice.companyId))) {
          return { success: 0, message: 'Access denied: invoice belongs to another company' };
        }
      }

      // Load all tax groups for this company
      const taxGroups = await this.taxGroupRepo.find({ where: { companyId: invoice.companyId } });

      const items = (invoice.invoiceItems || []).map((it, idx) => {
        // Debit note cap is just the invoice item quantity (no past usage deduction)
        const remainingQuantity = Number(it.quantity);
        
        let taxGroupId: number | null = null;
        let taxGroupLabel: string | null = null;
        let taxRate = 0;
        
        if (it.taxGroup) {
          const matchedGroup = taxGroups.find(tg => tg.taxCode === it.taxGroup);
          if (matchedGroup) {
            taxGroupId = matchedGroup.taxId;
            taxGroupLabel = matchedGroup.taxName;
            taxRate = Number(matchedGroup.taxValue);
          }
        }

        return {
          invoiceItemId: it.invoiceItemId,
          lineNo: idx + 1,
          itemId: it.itemId,
          itemName: it.item?.itemName ?? (it.description ?? ''),
          itemLabel: it.item?.itemName ? `${it.item.itemName} (${it.item.itemCode})` : (it.description ?? ''),
          description: it.description,
          itemGL: it.itemGL,
          quantity: Number(it.quantity),
          remainingQuantity: remainingQuantity,
          unitPrice: Number(it.unitPrice),
          taxCalculation: it.taxCalculation,
          taxGroupId: taxGroupId,
          taxGroup: it.taxGroup,
          taxGroupLabel: taxGroupLabel,
          taxRate: taxRate,
          isDecimalAllowed: it.item?.isDecimalAllowed ?? true
        };
      });

      return {
        success: 1,
        invoiceId: invoice.invoiceId,
        invoiceCode: invoice.invoiceCode,
        invoiceDate: invoice.invoiceDate,
        status: invoice.status,
        customerId: invoice.customerId,
        customerName: invoice.customer?.customerName ?? null,
        currencyId: invoice.currencyId,
        currencyCode: (invoice.currency as any)?.code ?? invoice.currencyCode,
        currencySymbol: (invoice.currency as any)?.symbol ?? null,
        items,
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}
