import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { FileTransfer } from 'src/utilities/file.transfer';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { ActivityCode } from 'src/activity/enums/activity-code.enum';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import {
  OrderEntity,
  OrderLifecycleStatus,
  OrderStatus,
  InvoiceGenerationOn,
} from 'src/order/entity/order.entity';
import { OrderItemEntity } from 'src/order/entity/order.item.entity';
import { DeliveryNoteEntity } from '../entity/delivery.note.entity';
import { DeliveryNoteItemEntity } from '../entity/delivery.note.item.entity';
import { DeliveryNoteAttachmentEntity } from '../entity/delivery.note.attachments.entity';
import { DeliveryNoteDto } from '../dto/delivery.note.dto';
import { OrderPdfService } from 'src/order/order.pdf.service';
import { InvoiceService } from 'src/invoice/service/invoice.service';

@Injectable()
export class DeliveryNoteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly codeGeneratorService: CodeGeneratorService,
    private readonly fileTransfer: FileTransfer,
    private readonly eventEmitter: EventEmitter2,
    private readonly orderPdfService: OrderPdfService,
    private readonly invoiceService: InvoiceService,

    @InjectRepository(DeliveryNoteEntity)
    private readonly deliveryNoteRepo: Repository<DeliveryNoteEntity>,

    @InjectRepository(DeliveryNoteItemEntity)
    private readonly deliveryNoteItemRepo: Repository<DeliveryNoteItemEntity>,

    @InjectRepository(DeliveryNoteAttachmentEntity)
    private readonly attachmentRepo: Repository<DeliveryNoteAttachmentEntity>,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: Repository<OrderItemEntity>,

    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,

    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,

    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,
  ) {}

  private resolvePerformer(
    req: any,
    fallbackId?: number,
  ): { performerId?: number; performerEmail: string } {
    const performerId: number | undefined = req?.user?.isImpersonation
      ? req?.user?.userId
      : (req?.user?.userId ?? fallbackId);
    const performerEmail: string = req?.user?.isImpersonation
      ? (req?.user?.email ?? '')
      : (req?.user?.email ?? req?.user?.impersonatorEmail);
    return { performerId, performerEmail };
  }

  private cleanUploadDir(deliveryNoteId: number | string) {
    const targetDir = path.resolve(`./upload/delivery_note/${deliveryNoteId}`);
    if (fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
      } catch (err: any) {
        console.error(`Failed to clean directory ${targetDir}:`, err.message);
      }
    }
  }

  private cleanTempFile(filename?: string) {
    if (!filename) return;
    const tempPath = path.resolve('./temp-upload', filename);
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
 
      }
    }
  }

  async insertDeliveryNote(
    body: DeliveryNoteDto,
    req: any,
    files?: {
      receiverImage?: Express.Multer.File[];
      receiverAttachments?: Express.Multer.File[];
    },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!body.companyId || !body.customerId || !body.orderId) {
        return {
          success: 0,
          message: 'companyId, customerId, and orderId are required.',
        };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds =
          req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(body.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot create delivery note for another company',
          };
        }
      }

      const customer = await this.customerRepo.findOne({
        where: { customerId: Number(body.customerId) },
      });
      if (!customer) {
        return { success: 0, message: 'Customer not found' };
      }
      if (Number(customer.companyId) !== Number(body.companyId)) {
        return {
          success: 0,
          message: 'Selected customer does not belong to the selected company',
        };
      }

      if (!body.deliveryNoteItems || body.deliveryNoteItems.length === 0) {
        return {
          success: 0,
          message: 'At least one delivery item line is required',
        };
      }

       const inputItemIds = body.deliveryNoteItems.map((i) => Number(i.orderItemId));
      const uniqueItemIds = new Set(inputItemIds);
      if (uniqueItemIds.size !== inputItemIds.length) {
        return {
          success: 0,
          message: 'Duplicate order items found in request',
        };
      }

       for (let i = 0; i < body.deliveryNoteItems.length; i++) {
        const item = body.deliveryNoteItems[i];
        const qty = Number(item.deliverQuantity);
        if (isNaN(qty) || qty <= 0) {
          return {
            success: 0,
            message: `Row ${i + 1}: Deliver quantity must be greater than 0`,
          };
        }
      }

       const imageFile = files?.receiverImage?.[0];
      if (imageFile) {
        const allowedImageTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (!allowedImageTypes.includes(imageFile.mimetype)) {
          this.cleanTempFile(imageFile.filename);
          return {
            success: 0,
            message: 'Receiver image must be an image file (JPG, PNG, WEBP, GIF)',
          };
        }
      }

       let signatureBuffer: Buffer | null = null;
      if (body.receiverSignature && body.receiverSignature.trim() !== '') {
        const sig = body.receiverSignature.trim();
        const prefixRegex = /^data:image\/png;base64,/i;
        if (!prefixRegex.test(sig)) {
          return {
            success: 0,
            message: 'Receiver signature must be a base64 PNG data URL (data:image/png;base64,...)',
          };
        }

        const base64Data = sig.replace(prefixRegex, '');
         if (base64Data.length > 1500000) {
          return {
            success: 0,
            message: 'Receiver signature exceeds maximum size limit (1MB)',
          };
        }

        try {
          signatureBuffer = Buffer.from(base64Data, 'base64');
          if (signatureBuffer.length > 1024 * 1024) {
            return {
              success: 0,
              message: 'Receiver signature exceeds maximum size limit (1MB)',
            };
          }
        } catch {
          return {
            success: 0,
            message: 'Invalid base64 encoding for receiver signature',
          };
        }
      }

       await queryRunner.connect();
      await queryRunner.startTransaction();

       const lockedOrder = await queryRunner.manager
        .createQueryBuilder(OrderEntity, 'ord')
        .setLock('pessimistic_write')
        .where('ord.orderId = :orderId', { orderId: Number(body.orderId) })
        .getOne();

      if (!lockedOrder) {
        await queryRunner.rollbackTransaction();
        return { success: 0, message: 'Order not found' };
      }

      if (Number(lockedOrder.companyId) !== Number(body.companyId)) {
        await queryRunner.rollbackTransaction();
        return {
          success: 0,
          message: 'Order does not belong to the selected company',
        };
      }

      if (Number(lockedOrder.customerId) !== Number(body.customerId)) {
        await queryRunner.rollbackTransaction();
        return {
          success: 0,
          message: 'Order does not belong to the selected customer',
        };
      }

      const validOrderStatuses = [
        OrderStatus.PLACED,
        OrderStatus.PARTIAL_DELIVERED,
      ];
      if (
        !validOrderStatuses.includes(lockedOrder.status as OrderStatus) ||
        lockedOrder.orderStatus !== OrderLifecycleStatus.OPEN
      ) {
        await queryRunner.rollbackTransaction();
        return {
          success: 0,
          message:
            'A delivery note can only be created for orders with status PLACED or PARTIAL_DELIVERED and lifecycle OPEN.',
        };
      }

       const sortedItemIds = [...inputItemIds].sort((a, b) => a - b);

      const lockedOrderItems = await queryRunner.manager
        .createQueryBuilder(OrderItemEntity, 'oi')
        .setLock('pessimistic_write')
        .where('oi.orderItemId IN (:...ids)', { ids: sortedItemIds })
        .andWhere('oi.orderId = :orderId', { orderId: Number(body.orderId) })
        .getMany();

      if (lockedOrderItems.length !== sortedItemIds.length) {
        await queryRunner.rollbackTransaction();
        return {
          success: 0,
          message: 'One or more items do not belong to the selected order',
        };
      }

      const lockedItemMap = new Map<number, OrderItemEntity>();
      lockedOrderItems.forEach((it) => lockedItemMap.set(it.orderItemId, it));

       for (let i = 0; i < body.deliveryNoteItems.length; i++) {
        const itemInput = body.deliveryNoteItems[i];
        const lockedItem = lockedItemMap.get(Number(itemInput.orderItemId))!;

        const requestedQuantity = Number(lockedItem.quantity);
        const currentDelivered = Number(lockedItem.deliveredQuantity || 0);
        const pendingQuantity = Math.max(0, requestedQuantity - currentDelivered);
        const deliverQty = Number(itemInput.deliverQuantity);

        if (deliverQty > pendingQuantity) {
          await queryRunner.rollbackTransaction();
          return {
            success: 0,
            message: `Row ${i + 1}: Deliver quantity (${deliverQty}) cannot exceed pending quantity (${pendingQuantity}).`,
          };
        }
      }

      const { performerId, performerEmail } = this.resolvePerformer(req);

       const deliveryNoteCode = await this.codeGeneratorService.generateCode(
        this.deliveryNoteRepo,
        `DN${body.customerId}`,
        Number(body.companyId),
        'deliveryNoteCode',
        'DN',
      );

       const dnInsert = await queryRunner.manager.insert(DeliveryNoteEntity, {
        deliveryNoteCode,
        companyId: Number(body.companyId),
        customerId: Number(body.customerId),
        orderId: Number(body.orderId),
        deliveryDate: new Date(body.deliveryDate),
        receiverName: body.receiverName.trim(),
        billingAddress: body.billingAddress.trim(),
        receiverImage: null,
        receiverSignature: null,
        addedBy: performerId,
        addedDate: new Date(),
      });
      const deliveryNoteId = dnInsert.raw.insertId;

       let signatureUrl: string | null = null;
      if (signatureBuffer) {
        const signatureFilename = `signature-${Date.now()}.png`;
        const signatureDir = path.resolve(
          `./upload/delivery_note/${deliveryNoteId}/signature`,
        );
        if (!fs.existsSync(signatureDir)) {
          fs.mkdirSync(signatureDir, { recursive: true });
        }
        const signaturePath = path.join(signatureDir, signatureFilename);
        await fs.promises.writeFile(signaturePath, signatureBuffer);
        signatureUrl = `/upload/delivery_note/${deliveryNoteId}/signature/${signatureFilename}`;
      }

       let imageUrl: string | null = null;
      if (imageFile) {
        const transferRes = await this.fileTransfer.fileTransfer(
          imageFile.filename,
          deliveryNoteId,
          'delivery_note',
          { subfolder: 'image' },
        );
        if (transferRes instanceof Error) {
          throw new BadRequestException(
            `Failed to transfer receiver image: ${transferRes.message}`,
          );
        }
        imageUrl = `/upload/delivery_note/${deliveryNoteId}/image/${imageFile.filename}`;
      }

       if (signatureUrl || imageUrl) {
        await queryRunner.manager.update(
          DeliveryNoteEntity,
          { deliveryNoteId },
          {
            receiverSignature: signatureUrl,
            receiverImage: imageUrl,
          },
        );
      }

       const attachmentFiles = files?.receiverAttachments || [];
      for (const att of attachmentFiles) {
        const transferRes = await this.fileTransfer.fileTransfer(
          att.filename,
          deliveryNoteId,
          'delivery_note',
          { subfolder: 'attachments' },
        );
        if (transferRes instanceof Error) {
          throw new BadRequestException(
            `Failed to transfer attachment: ${transferRes.message}`,
          );
        }
        const attachmentUrl = `/upload/delivery_note/${deliveryNoteId}/attachments/${att.filename}`;
        await queryRunner.manager.insert(DeliveryNoteAttachmentEntity, {
          deliveryNoteId,
          attachmentUrl,
          addedBy: performerId,
          addedDate: new Date(),
        });
      }

       for (const itemInput of body.deliveryNoteItems) {
        const lockedItem = lockedItemMap.get(Number(itemInput.orderItemId))!;
        const requestedQuantity = Number(lockedItem.quantity);
        const currentDelivered = Number(lockedItem.deliveredQuantity || 0);
        const pendingQuantity = Math.max(0, requestedQuantity - currentDelivered);
        const deliverQuantity = Number(itemInput.deliverQuantity);  

        await queryRunner.manager.insert(DeliveryNoteItemEntity, {
          deliveryNoteId,
          orderItemId: lockedItem.orderItemId,
          itemId: lockedItem.itemId ?? undefined,
          requestedQuantity,
          pendingQuantity,
          deliverQuantity,
          addedBy: performerId,
          addedDate: new Date(),
        });

        const newDeliveredQuantity = currentDelivered + deliverQuantity;
        await queryRunner.manager.update(
          OrderItemEntity,
          { orderItemId: lockedItem.orderItemId },
          {
            deliveredQuantity: newDeliveredQuantity,
            updatedDate: new Date(),
            updatedBy: performerId,
          },
        );
      }

       const allOrderItems = await queryRunner.manager.find(OrderItemEntity, {
        where: { orderId: Number(body.orderId) },
        select: ['orderItemId', 'quantity', 'deliveredQuantity'],
      });

      const isFullyDelivered = allOrderItems.every(
        (it) => Number(it.deliveredQuantity) >= Number(it.quantity),
      );
      const nextOrderStatus = isFullyDelivered
        ? OrderStatus.DELIVERED
        : OrderStatus.PARTIAL_DELIVERED;

      await queryRunner.manager.update(
        OrderEntity,
        { orderId: Number(body.orderId) },
        {
          status: nextOrderStatus,
          updatedDate: new Date(),
          updatedBy: performerId,
        },
      );

      await queryRunner.commitTransaction();

      if (lockedOrder.status !== nextOrderStatus) {
        this.eventEmitter.emit('activity.log', {
          activityCode: ActivityCode.ORDER_UPDATE,
          userId: performerId,
          companyId: Number(body.companyId),
          actorType: 'USER',
          targetType: 'ORDER',
          targetId: String(body.orderId),
          executionStatus: 'SUCCESS',
          severity: 'INFO',
          parameters: {
            userEmail: performerEmail,
            userGroup: authCtx.activeGroupName || 'N/A',
            orderCode: lockedOrder.orderCode,
            action: 'deliveryNoteCreated',
            status: nextOrderStatus,
            deliveryNoteCode,
            impersonated: !!req?.user?.isImpersonation,
          },
          metadata: {},
        });
      }

      if (nextOrderStatus === OrderStatus.DELIVERED) {
        this.orderPdfService
          .generateAndStoreInvoicePdf(Number(body.orderId))
          .catch((err: Error) =>
            console.error(
              `[PDF] Failed to generate invoice for order ${body.orderId}:`,
              err.message,
            ),
          );
      }

      let autoInvoiceResult: any = null;
      if (
        nextOrderStatus === OrderStatus.DELIVERED &&
        (lockedOrder.invoiceGenerationOn === InvoiceGenerationOn.DELIVERY_LEVEL ||
          (lockedOrder.invoiceGenerationOn as any) === 'DELIVERY_LEVEL')
      ) {
        try {
          autoInvoiceResult = await this.invoiceService.autoGenerateInvoiceFromOrder(
            Number(body.orderId),
            req,
            body.deliveryDate,
          );
          if (autoInvoiceResult && autoInvoiceResult.success === 1) {
            console.log(
              `[insertDeliveryNote] Auto-generated invoice ${autoInvoiceResult.invoiceCode} (status: ${autoInvoiceResult.invoiceStatus}) for order ${body.orderId}`,
            );
          } else if (autoInvoiceResult) {
            console.warn(
              `[insertDeliveryNote] Auto-generate invoice for order ${body.orderId} returned: ${autoInvoiceResult.message}`,
            );
          }
        } catch (invoiceErr: any) {
          console.error(
            `[insertDeliveryNote] Failed to auto-generate invoice for order ${body.orderId}:`,
            invoiceErr,
          );
        }
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.DELIVERY_NOTE_CREATE,
        userId: performerId,
        companyId: Number(body.companyId),
        actorType: 'USER',
        targetType: 'DELIVERY_NOTE',
        targetId: String(deliveryNoteId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          deliveryNoteCode,
          orderCode: lockedOrder.orderCode,
          customerId: body.customerId,
          companyId: body.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Delivery note created successfully',
        deliveryNoteId,
        deliveryNoteCode,
        ...(autoInvoiceResult && autoInvoiceResult.success === 1
          ? {
              invoiceId: autoInvoiceResult.invoiceId,
              invoiceCode: autoInvoiceResult.invoiceCode,
              invoiceStatus: autoInvoiceResult.invoiceStatus,
              autoApproved: autoInvoiceResult.autoApproved,
            }
          : {}),
      };
    } catch (err: any) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      return { success: 0, message: err.message };
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }
}
