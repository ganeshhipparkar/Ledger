import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceEntity } from './entity/invoice.entity';


@Injectable()
export class InvoicePdfService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
  ) {}

  async generateAndStoreInvoicePdf(invoiceId: number): Promise<string> {
    const invoice = await this.invoiceRepo.findOne({
      where: { invoiceId },
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
      ],
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }


    const pdfPath = `/upload/invoice/${invoiceId}/invoice-${invoice.invoiceCode}.pdf`;

    await this.invoiceRepo.update({ invoiceId }, { invoicePdfPath: pdfPath });

    return pdfPath;
  }
}
