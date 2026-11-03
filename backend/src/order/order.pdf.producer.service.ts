import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from './entity/order.entity';
import { PdfStatus } from 'src/utilities/pdf-status.enum';
import {
  ORDER_PDF_GENERATION_QUEUE,
  ORDER_PDF_JOB_NAME,
  OrderPdfJobData,
  orderPdfJobId,
} from './order.pdf.queue';

export interface EnqueueResult {
  queued: boolean;
  alreadyQueued: boolean;
}

@Injectable()
export class OrderPdfProducerService {
  private readonly logger = new Logger(OrderPdfProducerService.name);

  constructor(
    @InjectQueue(ORDER_PDF_GENERATION_QUEUE)
    private readonly queue: Queue<OrderPdfJobData>,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {}

  async enqueue(orderId: number): Promise<EnqueueResult> {
    const jobId = orderPdfJobId(orderId);

    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (['waiting', 'active', 'delayed', 'prioritized'].includes(state)) {
        this.logger.log(
          `PDF job for order ${orderId} already ${state} — skipping duplicate enqueue`,
        );
        return { queued: false, alreadyQueued: true };
      }
    }

    await this.orderRepo.update(
      { orderId },
      { pdfStatus: PdfStatus.PENDING, pdfStatusMessage: null },
    );

    try {
      await this.queue.add(
        ORDER_PDF_JOB_NAME,
        { orderId },
        {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      this.logger.log(`PDF job queued for order ${orderId} (jobId: ${jobId})`);
      return { queued: true, alreadyQueued: false };
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue PDF job for order ${orderId}: ${err.message}`,
        err.stack,
      );

      await this.orderRepo
        .update(
          { orderId },
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

