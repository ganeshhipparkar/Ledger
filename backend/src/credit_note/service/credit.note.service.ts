import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { FileTransfer } from 'src/utilities/file.transfer';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { Filter } from 'src/utilities/filter';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { InvoiceEntity, InvoiceStatus } from 'src/invoice/entity/invoice.entity';
import { TaxCalculation } from 'src/invoice/entity/invoice.item.entity';
import { CreditNoteEntity, CreditNoteStatus } from '../entity/credit.note.entity';
import { CreditNoteAttachmentsEntity } from '../entity/credit.note.attachments.entity';
import { CreditNoteDto, CreditNoteListDto } from '../dto/credit.note.dto';

@Injectable()
export class CreditNoteService {
  constructor(
    @InjectRepository(CreditNoteEntity)
    private readonly creditNoteRepo: Repository<CreditNoteEntity>,

    @InjectRepository(CreditNoteAttachmentsEntity)
    private readonly attachmentRepo: Repository<CreditNoteAttachmentsEntity>,

    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgRepo: Repository<UserCompanyGroupEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(taxGroupEntity)
    private readonly taxGroupRepo: Repository<taxGroupEntity>,

    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,

    private readonly filter: Filter,
    private readonly fileTransfer: FileTransfer,
  ) {}

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;


  private toOptionalNumber(v: any): number | undefined {
    if (v === undefined || v === null || v === '' || v === 'null') return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }

  private toValidNumber(v: any, fallback = 0): number {
    if (v === undefined || v === null || v === '') return fallback;
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  }


  private computeAmounts(
    totalAmount: number,
    taxCalculation: string,
    taxRate: number,
  ): { taxAmount: number; finalAmount: number } {
    const validRate = isNaN(taxRate) ? 0 : taxRate;
    let taxAmount = 0;
    let finalAmount = totalAmount;

    if (taxCalculation === TaxCalculation.INCLUSIVE) {
      // Tax is embedded inside totalAmount
      taxAmount = validRate > 0
        ? Math.round((totalAmount - totalAmount / (1 + validRate / 100)) * 10000) / 10000
        : 0;
      finalAmount = totalAmount; // finalAmount = totalAmount (tax already inside)
    } else if (taxCalculation === TaxCalculation.EXCLUSIVE) {
      // Tax is added on top
      taxAmount = Math.round(((totalAmount * validRate) / 100) * 10000) / 10000;
      finalAmount = totalAmount + (isNaN(taxAmount) ? 0 : taxAmount);
    }
    // NA: taxAmount=0, finalAmount=totalAmount

    return { taxAmount: isNaN(taxAmount) ? 0 : taxAmount, finalAmount };
  }

  // ─────────────────── invoicesByCustomer ───────────────────────────────────

  /**
   * Returns invoices for a given customer filtered to eligible statuses.
   * Used by the frontend Add panel's invoice dropdown.
   */
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


  async creditNoteList(param: CreditNoteListDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgRepo);
      const qb = this.creditNoteRepo
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

      const [skip, limit] = (await this.filter.calcPages(param, this.creditNoteRepo)) as [number, number];
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


  async creditNoteDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgRepo);

    const cn = await this.creditNoteRepo.findOne({
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

  async insertCreditNote(
    body: CreditNoteDto,
    req?: any,
    files?: { attachments?: Express.Multer.File[] },
  ) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgRepo);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(body.companyId))) {
          return { success: 0, message: 'Access denied: cannot add credit note to another company' };
        }
      }

      const invoice = await this.invoiceRepo.findOne({ where: { invoiceId: body.invoiceId } });
      if (!invoice) return { success: 0, message: 'Invoice not found' };
      const eligibleStatuses: string[] = [InvoiceStatus.UNPAID, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID];
      if (!eligibleStatuses.includes(invoice.status)) {
        return { success: 0, message: 'Credit notes can only be created for UNPAID, PAID, or PARTIALLY_PAID invoices' };
      }

      let taxRate = 0;
      if (body.taxCalculation !== TaxCalculation.NA) {
        if (!body.taxGroupId) {
          return { success: 0, message: 'taxGroupId is required when taxCalculation is EXCLUSIVE or INCLUSIVE' };
        }
        const tg = await this.taxGroupRepo.findOne({
          where: { taxId: body.taxGroupId, companyId: Number(body.companyId) },
        });
        if (!tg) return { success: 0, message: 'Tax group not found for this company' };
        taxRate = Number(tg.taxValue);
      }

      const totalAmount = this.toValidNumber(body.totalAmount, 0);
      const { taxAmount, finalAmount } = this.computeAmounts(totalAmount, body.taxCalculation, taxRate);

      const performerId = req?.user?.userId ?? this.toOptionalNumber(body.addedBy);

      const creditNoteCode = await this.codeGeneratorService.generateCode(
        this.creditNoteRepo,
        `CN${body.customerId}`,
        Number(body.companyId),
        'creditNoteCode',
        'CN',
      );

      const inserted = await this.creditNoteRepo.insert({
        creditNoteCode,
        companyId: Number(body.companyId),
        customerId: Number(body.customerId),
        currencyId: Number(body.currencyId),
        invoiceId: Number(body.invoiceId),
        customerCharges: body.customerCharges,
        narration: body.narration ?? null,
        taxCalculation: body.taxCalculation,
        taxGroupId: body.taxGroupId ? Number(body.taxGroupId) : null,
        totalAmount,
        taxAmount,
        finalAmount,
        status: CreditNoteStatus.SUBMITTED,
        approvalStatus: null,
        addedBy: performerId ? Number(performerId) : undefined,
        addedDate: new Date(),
      });

      const insertId: number = inserted.raw?.insertId;

      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransfer(filename, insertId, 'credit_note', {
          subfolder: 'attachments',
        });
        await this.attachmentRepo.insert({
          creditNoteId: insertId,
          invoiceId: Number(body.invoiceId),
          attachmentUrl: `/upload/credit_note/${insertId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
          status: 'Active',
        });
      }

      return { success: 1, message: 'Credit note created successfully', id: insertId, creditNoteCode };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}
