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
import { DebitNoteEntity, DebitNoteStatus } from '../entity/debit.note.entity';
import { DebitNoteAttachmentsEntity } from '../entity/debit.note.attachments.entity';
import { DebitNoteDto, DebitNoteListDto } from '../dto/debit.note.dto';
import { DebitNotePdfService } from '../debit.note.pdf.service';
import { DebitNoteItemEntity, DebitNoteLineType } from '../entity/debit.note.item.entity';
import { InvoiceItemEntity } from 'src/invoice/entity/invoice.item.entity';
import { NoteMode } from 'src/credit_note/entity/credit.note.entity';

@Injectable()
export class DebitNoteService {
  constructor(
    @InjectRepository(DebitNoteEntity)
    private readonly debitNoteRepo: Repository<DebitNoteEntity>,

    @InjectRepository(DebitNoteAttachmentsEntity)
    private readonly attachmentRepo: Repository<DebitNoteAttachmentsEntity>,

    private readonly debitNotePdfService: DebitNotePdfService,

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

  async insertDebitNote(
    body: DebitNoteDto,
    req?: any,
    files?: { attachments?: Express.Multer.File[] },
  ) {
    const queryRunner = this.debitNoteRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const authCtx = await resolveAuthContext(req, this.ucgRepo);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(body.companyId))) {
          throw new Error('Access denied: cannot add debit note to another company');
        }
      }

      const invoice = await queryRunner.manager.findOne(InvoiceEntity, { where: { invoiceId: body.invoiceId } });
      if (!invoice) throw new Error('Invoice not found');
      
      const eligibleStatuses: string[] = [InvoiceStatus.UNPAID, InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID];
      if (!eligibleStatuses.includes(invoice.status)) {
        throw new Error('Debit notes can only be created for UNPAID, PAID, or PARTIALLY_PAID invoices');
      }

      let taxRate = 0;
      let taxGroupId: number | null = null;
      let finalTaxCalculation = body.taxCalculation ?? TaxCalculation.NA;
      let finalCustomerCharges = body.customerCharges ?? null;
      let headerTotalAmount = this.toValidNumber(body.totalAmount, 0);
      let headerTaxAmount = 0;
      let headerTaxableAmount = 0;
      let headerFinalAmount = headerTotalAmount;

      let parsedItems: any[] = [];
      const isInvoiceMode = body.noteMode === NoteMode.INVOICE;

      if (isInvoiceMode) {
        finalCustomerCharges = null as any;
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
          where: { invoiceId: invoice.invoiceId },
          relations: ['item'],
        });
        const invoiceItemMap = new Map(invoiceItems.map(it => [it.invoiceItemId, it]));

        const taxGroups = await queryRunner.manager.find(taxGroupEntity, {
          where: { companyId: Number(body.companyId) }
        });

        headerTotalAmount = 0;
        headerTaxAmount = 0;
        headerTaxableAmount = 0;
        headerFinalAmount = 0;
        const seenInvoiceItemIds = new Set<number>();

        for (const item of parsedItems) {
           const lineType = item.lineType === 'SERVICE' ? DebitNoteLineType.SERVICE : DebitNoteLineType.INVOICE_ITEM;
           const qty = parseFloat(item.quantity) || 0;
           if (qty <= 0) throw new Error("Quantity must be greater than 0");

           if (lineType === DebitNoteLineType.INVOICE_ITEM) {
             const invItemId = Number(item.invoiceItemId);
             if (seenInvoiceItemIds.has(invItemId)) {
               throw new Error(`Duplicate invoice line ${invItemId} in payload`);
             }
             seenInvoiceItemIds.add(invItemId);

             const invItem = invoiceItemMap.get(invItemId);
             if (!invItem) throw new Error(`Invoice item ${invItemId} not found`);

             // No remaining quantity deduction cap for debit notes. 
             // We just enforce they don't exceed the original line quantity.
             if (qty > parseFloat(invItem.quantity as any)) {
                 throw new Error(`Quantity exceeds original invoice quantity for item ${invItem.item?.itemName ?? invItem.description ?? ''}`);
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
                itemId: invItem.itemId,
                description: invItem.description,
                itemGL: invItem.itemGL,
                quantity: qty,
                unitPrice,
                totalAmount,
                taxCalculation: itemTaxCalculation,
                taxGroupId: itemTaxCalculation !== TaxCalculation.NA ? Number(item.taxGroupId) : null,
                taxGroup: itemTaxGroupCode,
                taxAmount,
                taxableAmount,
                finalAmount
             };
           } else {
             if (!item.description || !item.description.trim()) {
               throw new Error("Description is required for service items");
             }
             const unitPrice = parseFloat(item.unitPrice) || 0;
             if (unitPrice < 0) throw new Error("Unit price must be >= 0");
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
               invoiceItemId: null,
               itemId: null,
               description: item.description.trim(),
               itemGL: null,
               quantity: qty,
               unitPrice,
               totalAmount,
               taxCalculation: itemTaxCalculation,
               taxGroupId: itemTaxCalculation !== TaxCalculation.NA ? Number(item.taxGroupId) : null,
               taxGroup: itemTaxGroupCode,
               taxAmount,
               taxableAmount,
               finalAmount
             };
           }

           headerTotalAmount += item.computed.totalAmount;
           headerTaxAmount += item.computed.taxAmount;
           headerTaxableAmount += item.computed.taxableAmount;
           headerFinalAmount += item.computed.finalAmount;
        }

      } else {
        if (body.taxCalculation !== TaxCalculation.NA) {
          if (!body.taxGroupId) {
            throw new Error('taxGroupId is required when taxCalculation is EXCLUSIVE or INCLUSIVE');
          }
          const tg = await queryRunner.manager.findOne(taxGroupEntity, {
            where: { taxId: body.taxGroupId, companyId: Number(body.companyId) },
          });
          if (!tg) throw new Error('Tax group not found for this company');
          taxRate = Number(tg.taxValue);
          taxGroupId = tg.taxId;
        }
        const { taxAmount, finalAmount } = this.computeAmounts(headerTotalAmount, body.taxCalculation ?? TaxCalculation.NA, taxRate);
        headerTaxAmount = taxAmount;
        headerFinalAmount = finalAmount;
      }

      const performerId = req?.user?.userId ?? this.toOptionalNumber(body.addedBy);

      const debitNoteCode = await this.codeGeneratorService.generateCode(
        this.debitNoteRepo,
        `DN${body.customerId}`,
        Number(body.companyId),
        'debitNoteCode',
        'DN',
      );

      const inserted = await queryRunner.manager.insert(DebitNoteEntity, {
        debitNoteCode,
        companyId: Number(body.companyId),
        customerId: Number(body.customerId),
        currencyId: Number(body.currencyId),
        invoiceId: Number(body.invoiceId),
        customerCharges: finalCustomerCharges as any,
        narration: body.narration ?? null,
        taxCalculation: finalTaxCalculation as any,
        taxGroupId: taxGroupId,
        totalAmount: headerTotalAmount,
        taxAmount: headerTaxAmount,
        finalAmount: headerFinalAmount,
        status: DebitNoteStatus.SUBMITTED,
        approvalStatus: null,
        addedBy: performerId ? Number(performerId) : undefined,
        addedDate: new Date(),
      });

      const insertId: number = inserted.raw?.insertId;

      if (isInvoiceMode && parsedItems.length > 0) {
        for (const item of parsedItems) {
           await queryRunner.manager.insert(DebitNoteItemEntity, {
             debitNoteId: insertId,
             ...item.computed,
             addedBy: performerId ? Number(performerId) : undefined,
             addedDate: new Date()
           });
        }
      }

      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransfer(filename, insertId, 'debit_note', {
          subfolder: 'attachments',
        });
        await queryRunner.manager.insert(DebitNoteAttachmentsEntity, {
          debitNoteId: insertId,
          invoiceId: Number(body.invoiceId),
          attachmentUrl: `/upload/debit_note/${insertId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
          status: 'Active',
        });
      }

      await queryRunner.commitTransaction();

      this.debitNotePdfService.generateAndStoreDebitNotePdf(insertId).catch(err => {
        console.error(`Failed to generate PDF for debit note ${insertId}:`, err);
      });

      return { success: 1, message: 'Debit note created successfully', id: insertId, debitNoteCode };
    } catch (err: any) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      return { success: 0, message: err.message };
    } finally {
      if (!queryRunner.isReleased) await queryRunner.release();
    }
  }
}
