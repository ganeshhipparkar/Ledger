import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotationEntity, PdfStatus } from './entity/quotation.entity';
import { QuotationPdfService } from './quotation.pdf.service';
import { PDF_GENERATION_QUEUE, PDF_JOB_NAME, PdfJobData } from './quotation.pdf.queue';

@Processor(PDF_GENERATION_QUEUE, { concurrency: 1 })
export class QuotationPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(QuotationPdfProcessor.name);

  constructor(
    private readonly quotationPdfService: QuotationPdfService,

    @InjectRepository(QuotationEntity)
    private readonly quotationRepo: Repository<QuotationEntity>,
  ) {
    super();
  }

  async process(job: Job<PdfJobData>): Promise<void> {
    if (job.name === PDF_JOB_NAME) {
      await this.processGenerateQuotationPdf(job);
    } else {
      this.logger.warn(`Unknown job name: ${job.name} — ignoring`);
    }
  }

  private async processGenerateQuotationPdf(job: Job<PdfJobData>): Promise<void> {
    const { quotationId } = job.data;
    this.logger.log(`[attempt ${job.attemptsMade + 1}/${job.opts.attempts}] Generating PDF for quotation ${quotationId}`);

     const quotation = await this.quotationRepo.findOne({
      where: { quotationId },
      select: ['quotationId', 'status'],
    });

    if (!quotation) {
       throw new UnrecoverableError(`Quotation ${quotationId} not found`);
    }

    if (quotation.status !== 'CONFIRMED') {
       this.logger.warn(
        `Quotation ${quotationId} is no longer CONFIRMED (status: ${quotation.status}) — discarding job`,
      );
      throw new UnrecoverableError(
        `Quotation ${quotationId} is no longer CONFIRMED (current: ${quotation.status})`,
      );
    }

     await this.quotationRepo.update({ quotationId }, { pdfStatus: PdfStatus.PROCESSING });
 
    await this.quotationPdfService.generateAndStoreInvoicePdf(quotationId);

  
    await this.quotationRepo.update({ quotationId }, { pdfStatus: PdfStatus.READY, pdfStatusMessage: null });
    this.logger.log(`PDF successfully generated for quotation ${quotationId}`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PdfJobData>, err: Error): Promise<void> {
    const { quotationId } = job.data;
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    const isUnrecoverable = err instanceof UnrecoverableError;

    if (isFinalAttempt || isUnrecoverable) {
      this.logger.error(
        `PDF generation permanently failed for quotation ${quotationId} after ${job.attemptsMade} attempt(s): ${err.message}`,
        err.stack,
      );

      await this.quotationRepo.update(
        { quotationId },  
        {
          pdfStatus: PdfStatus.FAILED,
          pdfStatusMessage: err.message.slice(0, 499),
        },
      ).catch((updateErr) =>
        this.logger.error(`Failed to update pdfStatus to FAILED for quotation ${quotationId}: ${updateErr.message}`),
      );
    } else {
      this.logger.warn(
        `PDF generation attempt ${job.attemptsMade} failed for quotation ${quotationId}: ${err.message} — will retry`,
      );
    }
  }   
}
