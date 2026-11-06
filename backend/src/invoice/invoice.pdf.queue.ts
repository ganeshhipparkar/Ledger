export const INVOICE_PDF_GENERATION_QUEUE = 'invoice-pdf-generation';
export const INVOICE_PDF_JOB_NAME = 'generate-invoice-pdf';

export interface InvoicePdfJobData {
  invoiceId: number;
}

export const invoicePdfJobId = (invoiceId: number | string) =>
  `invoice-pdf-${invoiceId}`;

