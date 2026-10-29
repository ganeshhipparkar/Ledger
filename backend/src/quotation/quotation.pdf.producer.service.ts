import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotationEntity, PdfStatus } from './entity/quotation.entity';
import {
  PDF_GENERATION_QUEUE,
  PDF_JOB_NAME,
  PdfJobData,
  pdfJobId,
} from './quotation.pdf.queue';

export interface EnqueueResult {
  queued: boolean;
  alreadyQueued: boolean;
}

@Injectable()
export class QuotationPdfProducerService {
  private readonly logger = new Logger(QuotationPdfProducerService.name);

  constructor(
    @InjectQueue(PDF_GENERATION_QUEUE)
    private readonly queue: Queue<PdfJobData>,

    @InjectRepository(QuotationEntity)
    private readonly quotationRepo: Repository<QuotationEntity>,
  ) {}


  async enqueue(quotationId: number): Promise<EnqueueResult> {
    const jobId = pdfJobId(quotationId);
 
    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (['waiting', 'active', 'delayed', 'prioritized'].includes(state)) {
        this.logger.log(
          `PDF job for quotation ${quotationId} already ${state} — skipping duplicate enqueue`,
        );
        return { queued: false, alreadyQueued: true };
      }
    }
    
    await this.quotationRepo.update({ quotationId }, { pdfStatus: PdfStatus.PENDING, pdfStatusMessage: null });

    try {
      await this.queue.add(
        PDF_JOB_NAME,
        { quotationId },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      this.logger.log(`PDF job queued for quotation ${quotationId} (jobId: ${jobId})`);
      return { queued: true, alreadyQueued: false };
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue PDF job for quotation ${quotationId}: ${err.message}`,
        err.stack,
      );
 
      await this.quotationRepo.update(
        { quotationId },
        {
          pdfStatus: PdfStatus.FAILED,
          pdfStatusMessage: 'PDF queue unavailable',
        },
      ).catch(() => {/* */});

      throw err;
    }
  }
}
