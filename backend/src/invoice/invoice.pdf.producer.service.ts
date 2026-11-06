import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceEntity } from './entity/invoice.entity';
import { PdfStatus } from 'src/utilities/pdf-status.enum';
import {
  INVOICE_PDF_GENERATION_QUEUE,
  INVOICE_PDF_JOB_NAME,
  InvoicePdfJobData,
  invoicePdfJobId,
} from './invoice.pdf.queue';

export interface EnqueueResult {
  queued: boolean;
  alreadyQueued: boolean;
}

@Injectable()
export class InvoicePdfProducerService {
  private readonly logger = new Logger(InvoicePdfProducerService.name);

  constructor(
    @InjectQueue(INVOICE_PDF_GENERATION_QUEUE)
    private readonly queue: Queue<InvoicePdfJobData>,

    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
  ) {}

  async enqueue(invoiceId: number): Promise<EnqueueResult> {
    const jobId = invoicePdfJobId(invoiceId);

    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (['waiting', 'active', 'delayed', 'prioritized'].includes(state)) {
        this.logger.log(
          `PDF job for invoice ${invoiceId} already ${state} — skipping duplicate enqueue`,
        );
        return { queued: false, alreadyQueued: true };
      }
    }

    await this.invoiceRepo.update(
      { invoiceId },
      { pdfStatus: PdfStatus.PENDING, pdfStatusMessage: null },
    );

    try {
      await this.queue.add(
        INVOICE_PDF_JOB_NAME,
        { invoiceId },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      this.logger.log(`PDF job queued for invoice ${invoiceId} (jobId: ${jobId})`);
      return { queued: true, alreadyQueued: false };
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue PDF job for invoice ${invoiceId}: ${err.message}`,
        err.stack,
      );

      await this.invoiceRepo
        .update(
          { invoiceId },
          {
            pdfStatus: PdfStatus.FAILED,
            pdfStatusMessage: 'PDF queue unavailable',
          },
        )
        .catch(() => {/* */});

      throw err;
    }
  }
}

