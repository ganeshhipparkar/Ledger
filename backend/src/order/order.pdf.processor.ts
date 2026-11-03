import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity, OrderStatus } from './entity/order.entity';
import { PdfStatus } from 'src/utilities/pdf-status.enum';
import { OrderPdfService } from './order.pdf.service';
import {
  ORDER_PDF_GENERATION_QUEUE,
  ORDER_PDF_JOB_NAME,
  OrderPdfJobData,
} from './order.pdf.queue';

@Processor(ORDER_PDF_GENERATION_QUEUE, { concurrency: 1 })
export class OrderPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderPdfProcessor.name);

  constructor(
    private readonly orderPdfService: OrderPdfService,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {
    super();
  }

  async process(job: Job<OrderPdfJobData>): Promise<void> {
    if (job.name === ORDER_PDF_JOB_NAME) {
      await this.processGenerateOrderPdf(job);
    } else {
      this.logger.warn(`Unknown job name: ${job.name} — ignoring`);
    }
  }

  private async processGenerateOrderPdf(job: Job<OrderPdfJobData>): Promise<void> {
    const { orderId } = job.data;
    this.logger.log(`[attempt ${job.attemptsMade + 1}/${job.opts.attempts}] Generating PDF for order ${orderId}`);

    const order = await this.orderRepo.findOne({
      where: { orderId },
      select: ['orderId', 'status'],
    });

    if (!order) {
      throw new UnrecoverableError(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.DELIVERED) {
      this.logger.warn(
        `Order ${orderId} is no longer DELIVERED (status: ${order.status}) — discarding job`,
      );
      throw new UnrecoverableError(
        `Order ${orderId} is no longer DELIVERED (current: ${order.status})`,
      );
    }

    await this.orderRepo.update({ orderId }, { pdfStatus: PdfStatus.PROCESSING });

    await this.orderPdfService.generateAndStoreInvoicePdf(orderId);

    await this.orderRepo.update({ orderId }, { pdfStatus: PdfStatus.READY, pdfStatusMessage: null });
    this.logger.log(`PDF successfully generated for order ${orderId}`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<OrderPdfJobData>, err: Error): Promise<void> {
    const { orderId } = job.data;
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    const isUnrecoverable = err instanceof UnrecoverableError;
    const isStalled = err?.message?.includes('stalled');

    if (isFinalAttempt || isUnrecoverable || isStalled) {
      this.logger.error(
        `PDF generation permanently failed for order ${orderId} after ${job.attemptsMade} attempt(s): ${err.message}`,
        err.stack,
      );

      await this.orderRepo.update(
        { orderId },
        {
          pdfStatus: PdfStatus.FAILED,
          pdfStatusMessage: err.message.slice(0, 499),
        },
      ).catch((updateErr) =>
        this.logger.error(`Failed to update pdfStatus to FAILED for order ${orderId}: ${updateErr.message}`),
      );
    } else {
      this.logger.warn(
        `PDF generation attempt ${job.attemptsMade} failed for order ${orderId}: ${err.message} — will retry`,
      );
    }
  }
}

