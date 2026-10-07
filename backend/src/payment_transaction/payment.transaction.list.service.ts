import { Inject, Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PaymentTransactionEntity, PaymentTransactionStatus } from './entity/payment.transaction.entity';
import { PaymentTransactionAttachmentsEntity } from './entity/payment.transaction.attachments';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { PaymentTransactionListDto } from './dto/payment.transaction.dto';
import { VaultService } from 'src/vault/vault.service';

@Injectable()
export class PaymentTransactionListService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(PaymentTransactionEntity)
  private readonly paymentTransactionRepo!: Repository<PaymentTransactionEntity>;

  @InjectRepository(PaymentTransactionAttachmentsEntity)
  private readonly attachmentRepo!: Repository<PaymentTransactionAttachmentsEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  @Inject()
  private readonly vaultService!: VaultService;

  async paymentTransactionList(param: PaymentTransactionListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder =
        this.paymentTransactionRepo.createQueryBuilder('paymentTransaction');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'paymentTransaction.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Payment transactions fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'paymentTransaction',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.paymentTransactionRepo,
      )) as [number, number];

      queryBuilder.leftJoinAndSelect('paymentTransaction.customer', 'customer');
      queryBuilder.leftJoinAndSelect('paymentTransaction.currency', 'currency');
      queryBuilder.leftJoinAndSelect('paymentTransaction.bankBook', 'bankBook');
      queryBuilder.leftJoinAndSelect('paymentTransaction.company', 'company');
      queryBuilder.leftJoinAndSelect(
        'paymentTransaction.attachments',
        'attachments',
      );
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('paymentTransaction.paymentTransactionId', 'DESC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => ({
        ...item,
        customerName: item.customer?.customerName ?? null,
        currencyCode: item.currency?.code ?? null,
        currencySymbol: item.currency?.symbol ?? null,
        bankBookName: item.bankBook?.bankBookName ?? null,
        companyName: item.company?.companyName ?? null,
      }));

      return_data = {
        success: 1,
        message: 'Payment transactions fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getPaymentTransactionDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const paymentTransaction = await this.paymentTransactionRepo.findOne({
      where: { paymentTransactionId: id },
      relations: ['customer', 'currency', 'bankBook', 'company', 'attachments'],
    });
    if (!paymentTransaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(paymentTransaction.companyId))) {
        throw new ForbiddenException(
          'Access denied: payment transaction belongs to another company',
        );
      }
    }

    const addedByUser = paymentTransaction.addedBy
      ? await this.userEntity.findOne({
          where: { userId: paymentTransaction.addedBy },
        })
      : null;
    const updatedByUser = paymentTransaction.updatedBy
      ? await this.userEntity.findOne({
          where: { userId: paymentTransaction.updatedBy },
        })
      : null;

    return {
      ...paymentTransaction,
      customerName: paymentTransaction.customer?.customerName ?? null,
      currencyCode: paymentTransaction.currency?.code ?? null,
      currencySymbol: paymentTransaction.currency?.symbol ?? null,
      bankBookName: paymentTransaction.bankBook?.bankBookName ?? null,
      companyName: paymentTransaction.company?.companyName ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }

  async getPaymentTransactionInvoices(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const paymentTransaction = await this.paymentTransactionRepo.findOne({
      where: { paymentTransactionId: id },
      relations: ['currency', 'company'],
    });
    if (!paymentTransaction) {
      throw new NotFoundException('Payment transaction not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(paymentTransaction.companyId))) {
        throw new ForbiddenException(
          'Access denied: payment transaction belongs to another company',
        );
      }
    }

    const { data, totalApplied } = await this.vaultService.getInvoicesForPayment(id);
    return {
      success: 1,
      currencyCode: paymentTransaction.currency?.code ?? null,
      currencySymbol: paymentTransaction.currency?.symbol ?? null,
      transactionAmount: Number(paymentTransaction.transactionAmount),
      totalApplied,
      data,
    };
  }
}
