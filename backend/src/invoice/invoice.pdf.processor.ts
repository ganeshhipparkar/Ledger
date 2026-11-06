import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceEntity, InvoiceStatus } from './entity/invoice.entity';
import { PdfStatus } from 'src/utilities/pdf-status.enum';
import { InvoicePdfService } from './invoice.pdf.service';
import {
  INVOICE_PDF_GENERATION_QUEUE,
  INVOICE_PDF_JOB_NAME,
  InvoicePdfJobData,
} from './invoice.pdf.queue';

@Processor(INVOICE_PDF_GENERATION_QUEUE, { concurrency: 1 })
export class InvoicePdfProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoicePdfProcessor.name);

  constructor(
    private readonly invoicePdfService: InvoicePdfService,

    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
  ) {
    super();
  }

  async process(job: Job<InvoicePdfJobData>): Promise<void> {
    if (job.name === INVOICE_PDF_JOB_NAME) {
      await this.processGenerateInvoicePdf(job);
    } else {
      this.logger.warn(`Unknown job name: ${job.name} — ignoring`);
    }
  }

  private async processGenerateInvoicePdf(job: Job<InvoicePdfJobData>): Promise<void> {
    const { invoiceId } = job.data;
    this.logger.log(`[attempt ${job.attemptsMade + 1}/${job.opts.attempts}] Generating PDF for invoice ${invoiceId}`);

    const invoice = await this.invoiceRepo.findOne({
      where: { invoiceId },
      select: ['invoiceId', 'status'],
    });

    if (!invoice) {
      throw new UnrecoverableError(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status === InvoiceStatus.DRAFT) {
      this.logger.warn(
        `Invoice ${invoiceId} is in DRAFT status — discarding job`,
      );
      throw new UnrecoverableError(
        `Cannot generate PDF for draft invoice ${invoiceId}`,
      );
    }

    await this.invoiceRepo.update({ invoiceId }, { pdfStatus: PdfStatus.PROCESSING });

    await this.invoicePdfService.generateAndStoreInvoicePdf(invoiceId);

    await this.invoiceRepo.update({ invoiceId }, { pdfStatus: PdfStatus.READY, pdfStatusMessage: null });
    this.logger.log(`PDF successfully generated for invoice ${invoiceId}`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<InvoicePdfJobData>, err: Error): Promise<void> {
    const { invoiceId } = job.data;
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    const isUnrecoverable = err instanceof UnrecoverableError;
    const isStalled = err?.message?.includes('stalled');

    if (isFinalAttempt || isUnrecoverable || isStalled) {
      this.logger.error(
        `PDF generation permanently failed for invoice ${invoiceId} after ${job.attemptsMade} attempt(s): ${err.message}`,
        err.stack,
      );

      await this.invoiceRepo.update(
        { invoiceId },
        {
          pdfStatus: PdfStatus.FAILED,
          pdfStatusMessage: err.message.slice(0, 499),
        },
      ).catch((updateErr) =>
        this.logger.error(`Failed to update pdfStatus to FAILED for invoice ${invoiceId}: ${updateErr.message}`),
      );
    } else {
      this.logger.warn(
        `PDF generation attempt ${job.attemptsMade} failed for invoice ${invoiceId}: ${err.message} — will retry`,
      );
    }
  }
}

