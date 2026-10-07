import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import { ActivityCode } from '../activity/enums/activity-code.enum';
import {
  PaymentTransactionEntity,
  PaymentTransactionStatus,
} from './entity/payment.transaction.entity';
import { PaymentTransactionAttachmentsEntity } from './entity/payment.transaction.attachments';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { FileTransfer } from 'src/utilities/file.transfer';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import {
  PaymentTransactionListDto,
  PaymentTransactionDto,
  PaymentTransactionUpdateDto,
  PaymentTransactionStatusDto,
} from './dto/payment.transaction.dto';
import { VaultService } from 'src/vault/vault.service';

@Injectable()
export class PaymentTransactionService {
  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly fileTransfer!: FileTransfer;

  @Inject(DataSource)
  private readonly dataSource!: DataSource;

  @InjectRepository(PaymentTransactionEntity)
  private readonly paymentTransactionRepo!: Repository<PaymentTransactionEntity>;

  @InjectRepository(PaymentTransactionAttachmentsEntity)
  private readonly attachmentRepo!: Repository<PaymentTransactionAttachmentsEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  @Inject(EventEmitter2)
  private readonly eventEmitter!: EventEmitter2;

  @Inject()
  private readonly vaultService!: VaultService;

  private validateExchangeDate(exchangeDate?: string): string | null {
    if (!exchangeDate) return null;
    const ex = new Date(exchangeDate);
    if (isNaN(ex.getTime())) return 'Invalid exchangeDate';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    if (ex < oneMonthAgo) return 'exchangeDate cannot be more than 1 month in the past';
    return null;
  }

  async insertPaymentTransaction(
    params: PaymentTransactionDto,
    req?: any,
    files?: { attachments?: Express.Multer.File[] },
  ) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message:
              'Access denied: cannot add payment transaction to another company',
          };
        }
      }

      const exchangeDateError = this.validateExchangeDate(params.exchangeDate);
      if (exchangeDateError) return { success: 0, message: exchangeDateError };

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      const baseAmount = Number(
        (
          Number(params.transactionAmount) * Number(params.exchangeRate)
        ).toFixed(4),
      );

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      let insertId: number;
      try {
        const paymentCode = await this.generatePaymentCode(queryRunner);

        const queryParams: any = {
          paymentCode,
          customerId: Number(params.customerId),
          currencyId: Number(params.currencyId),
          bankBookId: Number(params.bankBookId),
          companyId: Number(params.companyId),
          paymentMode: params.paymentMode,
          paymentDate: new Date(params.paymentDate),
          exchangeRate: Number(params.exchangeRate),
          exchangeDate: new Date(params.exchangeDate),
          narration: params.narration,
          transactionAmount: Number(params.transactionAmount),
          baseAmount,
          description: params.description,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        };

        const result = await queryRunner.manager
          .getRepository(PaymentTransactionEntity)
          .insert(queryParams);
        insertId = result?.raw?.insertId;

        await queryRunner.commitTransaction();
      } catch (err: any) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }

      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransferPaymentTransaction(
          filename,
          insertId,
          { subfolder: 'attachments' },
        );
        await this.attachmentRepo.insert({
          paymentTransactionId: insertId,
          attachmentUrl: `/upload/payment_transaction/${insertId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.PAYMENT_TRANSACTION_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'PAYMENT_TRANSACTION',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          companyId: params.companyId,
          customerId: params.customerId,
          transactionAmount: params.transactionAmount,
          baseAmount,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Payment transaction inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updatePaymentTransaction(
    params: PaymentTransactionUpdateDto,
    req?: any,
    files?: { attachments?: Express.Multer.File[] },
  ) {
    if (!params.paymentTransactionId) {
      return { success: 0, message: 'paymentTransactionId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existing = await this.paymentTransactionRepo.findOne({
        where: { paymentTransactionId: Number(params.paymentTransactionId) },
      });
      if (!existing) {
        return { success: 0, message: 'Payment transaction not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existing.companyId))) {
          return {
            success: 0,
            message:
              'Access denied: cannot update payment transaction of another company',
          };
        }
      }

      if (params.exchangeDate !== undefined) {
        const exchangeDateError = this.validateExchangeDate(params.exchangeDate);
        if (exchangeDateError) return { success: 0, message: exchangeDateError };
      }

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      const queryParams: any = {};
      if (params.customerId !== undefined)
        queryParams.customerId = Number(params.customerId);
      if (params.currencyId !== undefined)
        queryParams.currencyId = Number(params.currencyId);
      if (params.bankBookId !== undefined)
        queryParams.bankBookId = Number(params.bankBookId);
      if (params.companyId !== undefined)
        queryParams.companyId = Number(params.companyId);
      if (params.paymentMode !== undefined)
        queryParams.paymentMode = params.paymentMode;
      if (params.paymentDate !== undefined)
        queryParams.paymentDate = new Date(params.paymentDate);
      if (params.exchangeRate !== undefined)
        queryParams.exchangeRate = Number(params.exchangeRate);
      if (params.exchangeDate !== undefined)
        queryParams.exchangeDate = new Date(params.exchangeDate);
      if (params.narration !== undefined)
        queryParams.narration = params.narration;
      if (params.transactionAmount !== undefined)
        queryParams.transactionAmount = Number(params.transactionAmount);
      if (params.description !== undefined)
        queryParams.description = params.description;

      const effectiveTransactionAmount =
        queryParams.transactionAmount !== undefined
          ? queryParams.transactionAmount
          : Number(existing.transactionAmount);
      const effectiveExchangeRate =
        queryParams.exchangeRate !== undefined
          ? queryParams.exchangeRate
          : Number(existing.exchangeRate);

      queryParams.baseAmount = Number(
        (effectiveTransactionAmount * effectiveExchangeRate).toFixed(4),
      );

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await queryRunner.manager
          .getRepository(PaymentTransactionEntity)
          .update(
            { paymentTransactionId: Number(params.paymentTransactionId) },
            queryParams,
          );
        await queryRunner.commitTransaction();
      } catch (err: any) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }

      // Attachments deletion outside transaction
      if (params.deletedAttachmentIds?.length) {
        const toDelete = await this.attachmentRepo.findBy({
          paymentTransactionAttachmentId: In(params.deletedAttachmentIds),
        });
        for (const att of toDelete) {
          const relativePath = att.attachmentUrl.startsWith('/')
            ? att.attachmentUrl.substring(1)
            : att.attachmentUrl;
          if (fs.existsSync(relativePath)) {
            try {
              fs.unlinkSync(relativePath);
            } catch {}
          }
        }
        await this.attachmentRepo.delete({
          paymentTransactionAttachmentId: In(params.deletedAttachmentIds),
        });
      }

      // Attachments addition outside transaction
      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransferPaymentTransaction(
          filename,
          params.paymentTransactionId,
          { subfolder: 'attachments' },
        );
        await this.attachmentRepo.insert({
          paymentTransactionId: Number(params.paymentTransactionId),
          attachmentUrl: `/upload/payment_transaction/${params.paymentTransactionId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.PAYMENT_TRANSACTION_UPDATE,
        userId: performerId,
        companyId: existing.companyId,
        actorType: 'USER',
        targetType: 'PAYMENT_TRANSACTION',
        targetId: String(params.paymentTransactionId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          companyId: existing.companyId,
          paymentTransactionId: params.paymentTransactionId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Payment transaction updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async approvePaymentTransaction(dto: PaymentTransactionStatusDto, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existing = await this.paymentTransactionRepo.findOne({
        where: { paymentTransactionId: dto.paymentTransactionId },
      });
      if (!existing) {
        throw new NotFoundException('Payment transaction not found');
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(existing.companyId)) {
          throw new ForbiddenException('Access denied to this payment transaction');
        }
      }

      if (existing.status !== PaymentTransactionStatus.PENDING) {
        throw new BadRequestException(
          `Payment transaction is no longer Pending (current status: ${existing.status})`,
        );
      }

      if (!dto.remarks || dto.remarks.trim() === '') {
        throw new BadRequestException('Remarks are required for approval');
      }

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      existing.status = PaymentTransactionStatus.APPROVED;
      existing.statusRemarks = dto.remarks.trim();
      existing.updatedBy = performerId ? Number(performerId) : undefined;
      existing.updatedDate = new Date();

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await queryRunner.manager.save(existing);
        
        await this.vaultService.credit(
          existing.customerId,
          existing.currencyId,
          existing.companyId,
          existing.paymentTransactionId,
          Number(existing.transactionAmount),
          queryRunner
        );

        if ((process.env.INVOICE_PAYMENT_MODE || 'AUTOMATIC').toUpperCase() === 'AUTOMATIC') {
          await this.vaultService.payOutstandingInvoices(
            existing.customerId,
            existing.currencyId,
            existing.companyId,
            (process.env.INVOICE_PAYMENT_STRATEGY as 'FIFO' | 'LIFO') || 'FIFO',
            queryRunner,
          );
        }

        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.PAYMENT_TRANSACTION_APPROVE,
        userId: performerId,
        companyId: existing.companyId,
        actorType: 'USER',
        targetType: 'PAYMENT_TRANSACTION',
        targetId: String(dto.paymentTransactionId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          companyId: existing.companyId,
          paymentTransactionId: dto.paymentTransactionId,
          remarks: dto.remarks,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Payment transaction approved successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async cancelPaymentTransaction(dto: PaymentTransactionStatusDto, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existing = await this.paymentTransactionRepo.findOne({
        where: { paymentTransactionId: dto.paymentTransactionId },
      });
      if (!existing) {
        throw new NotFoundException('Payment transaction not found');
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(existing.companyId)) {
          throw new ForbiddenException('Access denied to this payment transaction');
        }
      }

      if (existing.status !== PaymentTransactionStatus.PENDING) {
        throw new BadRequestException(
          `Payment transaction is no longer Pending (current status: ${existing.status})`,
        );
      }

      if (!dto.remarks || dto.remarks.trim() === '') {
        throw new BadRequestException('Remarks are required for cancellation');
      }

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      existing.status = PaymentTransactionStatus.CANCELLED;
      existing.statusRemarks = dto.remarks.trim();
      existing.updatedBy = performerId ? Number(performerId) : undefined;
      existing.updatedDate = new Date();

      await this.paymentTransactionRepo.save(existing);

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.PAYMENT_TRANSACTION_CANCEL,
        userId: performerId,
        companyId: existing.companyId,
        actorType: 'USER',
        targetType: 'PAYMENT_TRANSACTION',
        targetId: String(dto.paymentTransactionId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          companyId: existing.companyId,
          paymentTransactionId: dto.paymentTransactionId,
          remarks: dto.remarks,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Payment transaction cancelled successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async cancelApprovedPaymentTransaction(dto: PaymentTransactionStatusDto, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existing = await this.paymentTransactionRepo.findOne({
        where: { paymentTransactionId: dto.paymentTransactionId },
      });
      if (!existing) {
        throw new NotFoundException('Payment transaction not found');
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(existing.companyId)) {
          throw new ForbiddenException('Access denied to this payment transaction');
        }
      }

      if (existing.status !== PaymentTransactionStatus.APPROVED) {
        throw new BadRequestException(
          `Payment transaction must be Approved to cancel it (current status: ${existing.status})`,
        );
      }

      if (!dto.remarks || dto.remarks.trim() === '') {
        throw new BadRequestException('Remarks are required for cancellation');
      }

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        existing.status = PaymentTransactionStatus.CANCELLED;
        existing.statusRemarks = dto.remarks.trim();
        existing.updatedBy = performerId ? Number(performerId) : undefined;
        existing.updatedDate = new Date();
        await queryRunner.manager.save(existing);

        const { customerId, currencyId, companyId } =
          await this.vaultService.reverseCredit(
            existing.paymentTransactionId,
            queryRunner,
          );

        if ((process.env.INVOICE_PAYMENT_MODE || 'AUTOMATIC').toUpperCase() === 'AUTOMATIC') {
          await this.vaultService.payOutstandingInvoices(
            customerId,
            currencyId,
            companyId,
            ((process.env.INVOICE_PAYMENT_STRATEGY as 'FIFO' | 'LIFO') || 'FIFO'),
            queryRunner,
          );
        }

        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.PAYMENT_TRANSACTION_CANCEL_APPROVED,
        userId: performerId,
        companyId: existing.companyId,
        actorType: 'USER',
        targetType: 'PAYMENT_TRANSACTION',
        targetId: String(dto.paymentTransactionId),
        executionStatus: 'SUCCESS',
        severity: 'WARN',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          companyId: existing.companyId,
          paymentTransactionId: dto.paymentTransactionId,
          remarks: dto.remarks,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Approved payment transaction cancelled and vault reversed successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  private async generatePaymentCode(queryRunner: any): Promise<string> {
    const count = await queryRunner.manager
      .getRepository(PaymentTransactionEntity)
      .count();
    return `PAY${String(count + 1).padStart(3, '0')}`;
  }
}
