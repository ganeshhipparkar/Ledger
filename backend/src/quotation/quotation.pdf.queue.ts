export const PDF_GENERATION_QUEUE = 'pdf-generation';

export const PDF_JOB_NAME = 'generate-quotation-pdf';

export interface PdfJobData {
  quotationId: number;
}

export const pdfJobId = (quotationId: number) =>
  `quotation-pdf-${quotationId}`;
