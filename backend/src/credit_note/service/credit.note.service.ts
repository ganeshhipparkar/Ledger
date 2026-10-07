import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { FileTransfer } from 'src/utilities/file.transfer';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { Filter } from 'src/utilities/filter';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { InvoiceEntity, InvoiceStatus, VatWithheld } from 'src/invoice/entity/invoice.entity';
import { InvoiceItemEntity } from 'src/invoice/entity/invoice.item.entity';
import { TaxCalculation } from 'src/invoice/entity/invoice.item.entity';
import { CreditNoteEntity, CreditNoteStatus, NoteMode, CustomerCharges } from '../entity/credit.note.entity';
import { CreditNoteAttachmentsEntity } from '../entity/credit.note.attachments.entity';
import { CreditNoteItemEntity, CreditNoteLineType } from '../entity/credit.note.item.entity';
import { CreditNoteDto, CreditNoteListDto } from '../dto/credit.note.dto';
import { CreditNotePdfService } from '../credit.note.pdf.service';

@Injectable()
export class CreditNoteService {
  constructor(
    @InjectRepository(CreditNoteEntity)
    private readonly creditNoteRepo: Repository<CreditNoteEntity>,

    @InjectRepository(CreditNoteAttachmentsEntity)
    private readonly attachmentRepo: Repository<CreditNoteAttachmentsEntity>,

    private readonly creditNotePdfService: CreditNotePdfService,

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
    private readonly dataSource: DataSource,
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
      taxAmount = validRate > 0
        ? Math.round((totalAmount - totalAmount / (1 + validRate / 100)) * 10000) / 10000
        : 0;
      finalAmount = totalAmount; 
    } else if (taxCalculation === TaxCalculation.EXCLUSIVE) {
      taxAmount = Math.round(((totalAmount * validRate) / 100) * 10000) / 10000;
      finalAmount = totalAmount + (isNaN(taxAmount) ? 0 : taxAmount);
    }

    return { taxAmount: isNaN(taxAmount) ? 0 : taxAmount, finalAmount };
  }

  async insertCreditNote(
    body: CreditNoteDto,
    req?: any,
    files?: { attachments?: Express.Multer.File[] },
  ) {
    const authCtx = await resolveAuthContext(req, this.ucgRepo);

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
      if (!scopedCompanyIds.includes(Number(body.companyId))) {
        return { success: 0, message: 'Access denied: cannot add credit note to another company' };
      }
    }

    const isInvoiceMode = body.noteMode === NoteMode.INVOICE;

    let invoice: InvoiceEntity | null = null;
    if (body.invoiceId) {
      invoice = await this.invoiceRepo.findOne({ where: { invoiceId: body.invoiceId } });
      if (!invoice) return { success: 0, message: 'Invoice not found' };
      const eligibleStatuses: string[] = [InvoiceStatus.UNPAID, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID];
      if (!eligibleStatuses.includes(invoice.status)) {
        return { success: 0, message: 'Credit notes can only be created for UNPAID, PAID, or PARTIALLY_PAID invoices' };
      }
      
      if (isInvoiceMode) {
        if (invoice.companyId !== Number(body.companyId)) return { success: 0, message: 'Invoice company mismatch' };
        if (invoice.customerId !== Number(body.customerId)) return { success: 0, message: 'Invoice customer mismatch' };
        if (invoice.currencyId !== Number(body.currencyId)) return { success: 0, message: 'Invoice currency mismatch' };
        if (body.issueDate && new Date(body.issueDate) < new Date(invoice.invoiceDate)) {
            return { success: 0, message: 'Issue date cannot be earlier than invoice date' };
        }
      }
    } else if (isInvoiceMode) {
      return { success: 0, message: 'invoiceId is required in INVOICE mode' };
    }

    const performerId = req?.user?.userId ?? this.toOptionalNumber(body.addedBy);

    const creditNoteCode = await this.codeGeneratorService.generateCode(
      this.creditNoteRepo,
      `CN${body.customerId}`,
      Number(body.companyId),
      'creditNoteCode',
      'CN',
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let taxRate = 0;
      let taxGroupId: number | null = null;
      let finalTaxCalculation = body.taxCalculation ?? TaxCalculation.NA;
      let finalCustomerCharges = body.customerCharges ?? null;
      let headerTotalAmount = this.toValidNumber(body.totalAmount, 0);
      let headerTaxAmount = 0;
      let headerTaxableAmount = 0;
      let headerFinalAmount = headerTotalAmount;

      let parsedItems: any[] = [];
      let vatWithheldAmount = 0;

      if (isInvoiceMode) {
        finalCustomerCharges = CustomerCharges.INVOICE_CHARGES;
        finalTaxCalculation = TaxCalculation.NA;
        
        if (body.items) {
           try {
             parsedItems = typeof body.items === 'string' ? JSON.parse(body.items) : body.items;
           } catch {
             throw new Error("Invalid items payload");
           }
        }
        
        if (!parsedItems || parsedItems.length === 0) {
            throw new Error("At least one line item is required in INVOICE mode");
        }

        const invoiceItems = await queryRunner.manager.find(InvoiceItemEntity, {
            where: { invoiceId: invoice!.invoiceId },
            relations: ['item'],
            lock: { mode: 'pessimistic_write' }
        });

        const invoiceItemMap = new Map(invoiceItems.map(it => [it.invoiceItemId, it]));

        const earlierCnItems = await queryRunner.manager.createQueryBuilder(CreditNoteItemEntity, 'cni')
          .innerJoin('cni.creditNote', 'cn')
          .where('cn.invoiceId = :invoiceId', { invoiceId: invoice!.invoiceId })
          .select('cni.invoiceItemId', 'invoiceItemId')
          .addSelect('SUM(cni.quantity)', 'creditedQty')
          .groupBy('cni.invoiceItemId')
          .getRawMany();

        const creditedQtyMap = new Map();
        for (const r of earlierCnItems) {
            if (r.invoiceItemId) {
              creditedQtyMap.set(Number(r.invoiceItemId), parseFloat(r.creditedQty));
            }
        }

        const taxGroups = await queryRunner.manager.find(taxGroupEntity, {
          where: { companyId: Number(body.companyId) }
        });

        headerTotalAmount = 0;
        headerTaxAmount = 0;
        headerTaxableAmount = 0;
        headerFinalAmount = 0;

        const seenInvoiceItemIds = new Set<number>();

        for (const item of parsedItems) {
           const lineType = item.lineType === 'SERVICE' ? CreditNoteLineType.SERVICE : CreditNoteLineType.INVOICE_ITEM;
           const qty = parseFloat(item.quantity) || 0;
           if (qty <= 0) throw new Error("Quantity must be greater than 0");

           if (lineType === CreditNoteLineType.INVOICE_ITEM) {
             const invItemId = Number(item.invoiceItemId);
             if (seenInvoiceItemIds.has(invItemId)) {
               throw new Error(`Duplicate invoice line ${invItemId} in payload`);
             }
             seenInvoiceItemIds.add(invItemId);

             const invItem = invoiceItemMap.get(invItemId);
             if (!invItem) throw new Error(`Invoice item ${invItemId} not found`);

             const alreadyCredited = creditedQtyMap.get(invItemId) || 0;
             if (qty > parseFloat(invItem.quantity as any) - alreadyCredited) {
                 throw new Error(`Quantity exceeds remaining uncredited quantity for item ${invItem.item?.itemName ?? invItem.description ?? ''}`);
             }

             const unitPrice = parseFloat(item.unitPrice);
             if (isNaN(unitPrice) || unitPrice < 0) throw new Error("Unit price must be >= 0");

             const totalAmount = qty * unitPrice;
             const itemTaxCalculation = item.taxCalculation || TaxCalculation.NA;
             let itemTaxRate = 0;
             let itemTaxGroupCode: string | null = null;
             
             if (itemTaxCalculation !== TaxCalculation.NA) {
               const tgId = Number(item.taxGroupId);
               if (!tgId) throw new Error("Tax group is required when tax is calculated");
               const tg = taxGroups.find(t => t.taxId === tgId);
               if (!tg) throw new Error("Tax group not found or belongs to another company");
               itemTaxRate = Number(tg.taxValue);
               itemTaxGroupCode = tg.taxCode;
             }

             const { taxAmount, finalAmount } = this.computeAmounts(totalAmount, itemTaxCalculation, itemTaxRate);
             let taxableAmount = 0;
             if (itemTaxCalculation === TaxCalculation.INCLUSIVE) {
                 taxableAmount = totalAmount - taxAmount;
             } else if (itemTaxCalculation === TaxCalculation.EXCLUSIVE) {
                 taxableAmount = totalAmount;
             }

             item.computed = {
                lineType,
                invoiceItemId: invItemId,
                unitPrice,
                totalAmount,
                taxCalculation: itemTaxCalculation,
                taxGroup: itemTaxGroupCode,
                taxAmount,
                taxableAmount,
                finalAmount,
                itemId: invItem.itemId,
                description: item.description?.trim() || invItem.description,
                itemGL: invItem.itemGL
             };

             headerTotalAmount += totalAmount;
             headerTaxableAmount += taxableAmount;
             headerTaxAmount += taxAmount;
             headerFinalAmount += finalAmount;

           } else {
              const description = item.description?.trim();
             if (!description) throw new Error("Service description is required");
             if (description.length > 255) throw new Error("Service description too long");

             const unitPrice = parseFloat(item.unitPrice);
             if (isNaN(unitPrice) || unitPrice < 0) throw new Error("Service unit price must be >= 0");

             const totalAmount = qty * unitPrice;
             const itemTaxCalculation = item.taxCalculation || TaxCalculation.NA;
             
             let itemTaxRate = 0;
             let itemTaxGroupCode: string | null = null;

             if (itemTaxCalculation !== TaxCalculation.NA) {
               const tgId = Number(item.taxGroupId);
               if (!tgId) throw new Error("Tax group is required for service when tax is calculated");
               const tg = taxGroups.find(t => t.taxId === tgId);
               if (!tg) throw new Error("Tax group not found or belongs to another company");
               itemTaxRate = Number(tg.taxValue);
               itemTaxGroupCode = tg.taxCode;
             }

             const { taxAmount, finalAmount } = this.computeAmounts(totalAmount, itemTaxCalculation, itemTaxRate);
             let taxableAmount = 0;
             if (itemTaxCalculation === TaxCalculation.INCLUSIVE) {
                 taxableAmount = totalAmount - taxAmount;
             } else if (itemTaxCalculation === TaxCalculation.EXCLUSIVE) {
                 taxableAmount = totalAmount;
             }

             item.computed = {
                lineType,
                invoiceItemId: null,
                unitPrice,
                totalAmount,
                taxCalculation: itemTaxCalculation,
                taxGroup: itemTaxGroupCode,
                taxAmount,
                taxableAmount,
                finalAmount,
                itemId: null,
                description,
                itemGL: null
             };

             headerTotalAmount += totalAmount;
             headerTaxableAmount += taxableAmount;
             headerTaxAmount += taxAmount;
             headerFinalAmount += finalAmount;
           }
        }

        if (body.vatWithheld === VatWithheld.YES) {
            vatWithheldAmount = headerTaxAmount;
            headerFinalAmount -= vatWithheldAmount;
        }

      } else {
          if (finalTaxCalculation !== TaxCalculation.NA) {
            if (!body.taxGroupId) {
              throw new Error('taxGroupId is required when taxCalculation is EXCLUSIVE or INCLUSIVE');
            }
            const tg = await this.taxGroupRepo.findOne({
              where: { taxId: body.taxGroupId, companyId: Number(body.companyId) },
            });
            if (!tg) throw new Error('Tax group not found for this company');
            taxRate = Number(tg.taxValue);
            taxGroupId = Number(body.taxGroupId);
          }

          const { taxAmount, finalAmount } = this.computeAmounts(headerTotalAmount, finalTaxCalculation, taxRate);
          headerTaxAmount = taxAmount;
          headerFinalAmount = finalAmount;
          if (finalTaxCalculation === TaxCalculation.EXCLUSIVE) headerTaxableAmount = headerTotalAmount;
          else if (finalTaxCalculation === TaxCalculation.INCLUSIVE) headerTaxableAmount = headerTotalAmount - taxAmount;
          
          if (body.vatWithheld === VatWithheld.YES) {
             vatWithheldAmount = headerTaxAmount;
             headerFinalAmount -= vatWithheldAmount;
          }
      }

      const inserted = await queryRunner.manager.insert(CreditNoteEntity, {
        creditNoteCode,
        companyId: Number(body.companyId),
        customerId: Number(body.customerId),
        currencyId: Number(body.currencyId),
        invoiceId: body.invoiceId ? Number(body.invoiceId) : null,
        issueDate: body.issueDate ? new Date(body.issueDate) : null,
        vatWithheld: body.vatWithheld ?? VatWithheld.NO,
        vatWithheldAmount: vatWithheldAmount,
        customerCharges: finalCustomerCharges,
        narration: body.narration ?? null,
        remarks: body.remarks ?? null,
        taxCalculation: finalTaxCalculation,
        taxGroupId: taxGroupId,
        totalAmount: headerTotalAmount,
        taxableAmount: headerTaxableAmount,
        taxAmount: headerTaxAmount,
        finalAmount: headerFinalAmount,
        noteMode: body.noteMode ?? NoteMode.CUSTOMER,
        status: CreditNoteStatus.SUBMITTED,
        approvalStatus: null,
        addedBy: performerId ? Number(performerId) : undefined,
        addedDate: new Date(),
      });

      const insertId: number = inserted.raw?.insertId;

      if (isInvoiceMode && parsedItems.length > 0) {
         for (const item of parsedItems) {
            await queryRunner.manager.insert(CreditNoteItemEntity, {
                creditNoteId: insertId,
                lineType: item.computed.lineType,
                invoiceItemId: item.computed.invoiceItemId,
                itemId: item.computed.itemId,
                description: item.computed.description,
                itemGL: item.computed.itemGL,
                quantity: parseFloat(item.quantity),
                unitPrice: item.computed.unitPrice,
                totalAmount: item.computed.totalAmount,
                taxCalculation: item.computed.taxCalculation,
                taxGroup: item.computed.taxGroup,
                taxAmount: item.computed.taxAmount,
                taxableAmount: item.computed.taxableAmount,
                finalAmount: item.computed.finalAmount,
                addedBy: performerId ? Number(performerId) : undefined,
                addedDate: new Date(),
            });
         }
      }

      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransfer(filename, insertId, 'credit_note', {
          subfolder: 'attachments',
        });
        await queryRunner.manager.insert(CreditNoteAttachmentsEntity, {
          creditNoteId: insertId,
          invoiceId: body.invoiceId ? Number(body.invoiceId) : null,
          attachmentUrl: `/upload/credit_note/${insertId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
          status: 'Active',
        });
      }

      await queryRunner.commitTransaction();

       this.creditNotePdfService.generateAndStoreCreditNotePdf(insertId).catch(err => {
        console.error(`Failed to generate PDF for credit note ${insertId}:`, err);
      });

      return { success: 1, message: 'Credit note created successfully', id: insertId, creditNoteCode };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      return { success: 0, message: err.message };
    } finally {
      await queryRunner.release();
    }
  }
}