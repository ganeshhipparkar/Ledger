export const ORDER_PDF_GENERATION_QUEUE = 'order-pdf-generation';

export const ORDER_PDF_JOB_NAME = 'generate-order-invoice-pdf';

export interface OrderPdfJobData {
  orderId: number;
}

export const orderPdfJobId = (orderId: number) =>
  `order-pdf-${orderId}`;

