import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { OrderEntity, OrderLifecycleStatus, OrderStatus } from './entity/order.entity';
import { OrderItemEntity } from './entity/order.item.entity';
import { OrderDiscountEntity } from './entity/order.discount.entity';
import { OrderExtraChargeEntity } from './entity/order.extra.charge.entity';
import { OrderAttachmentsEntity } from './entity/order.attachments';
import { OrderListDto } from './dto/order.dto';

@Injectable()
export class OrderListService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: Repository<OrderItemEntity>,

    @InjectRepository(OrderDiscountEntity)
    private readonly discountRepo: Repository<OrderDiscountEntity>,

    @InjectRepository(OrderExtraChargeEntity)
    private readonly extraChargeRepo: Repository<OrderExtraChargeEntity>,

    @InjectRepository(OrderAttachmentsEntity)
    private readonly attachmentRepo: Repository<OrderAttachmentsEntity>,

    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,

    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,

    @InjectRepository(CurrencyEntity)
    private readonly currencyRepo: Repository<CurrencyEntity>,

    @InjectRepository(taxGroupEntity)
    private readonly taxGroupRepo: Repository<taxGroupEntity>,

    private readonly filter: Filter,
  ) {}

  async orderList(param: OrderListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.orderRepo.createQueryBuilder('order');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds =
          req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'order.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Orders fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'order',
        {
          customerName: 'customer',
          companyName: 'company',
        },
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.orderRepo,
      )) as [number, number];

      queryBuilder
        .leftJoinAndSelect('order.customer', 'customer')
        .leftJoinAndSelect('order.currency', 'currency')
        .leftJoinAndSelect('order.company', 'company')
        .leftJoinAndSelect('order.salesPerson', 'salesPerson')
        .leftJoinAndSelect('order.bankBook', 'bankBook')
        .skip(skip)
        .take(limit)
        .orderBy('order.addedDate', 'DESC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const addedByIds = Array.from(
        new Set(data.map((o) => o.addedBy).filter(Boolean)),
      );
      const userMap = new Map<number, string>();
      if (addedByIds.length > 0) {
        const users = await this.userEntity.find({
          where: { userId: In(addedByIds) },
          select: ['userId', 'name'],
        });
        users.forEach((u) => userMap.set(u.userId, u.name));
      }

      const formattedData = data.map((o) => ({
        ...o,
        customerName: o.customer?.customerName ?? null,
        currencyCode: o.currency?.code ?? null,
        companyName: o.company?.companyName ?? null,
        salesPersonName: o.salesPerson?.name ?? null,
        bankBookName: o.bankBook?.accountNumber ?? null,
        addedByName: o.addedBy ? (userMap.get(o.addedBy) ?? null) : null,
      }));

      return_data = {
        success: 1,
        message: 'Orders fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getOrderDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);

    const order = await this.orderRepo.findOne({
      where: { orderId: id },
      relations: [
        'customer',
        'currency',
        'company',
        'bankBook',
        'salesPerson',
        'contactPerson',
        'termsConditions',
        'orderItems',
        'orderItems.item',
        'orderItems.discounts',
        'orderItems.extraCharges',
        'discounts',
        'extraCharges',
        'attachments',
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds =
        req?.scopedCompanyIds || [authCtx.activeCompanyId];
      if (!scopedCompanyIds.includes(Number(order.companyId))) {
        throw new ForbiddenException(
          'Access denied: order belongs to another company',
        );
      }
    }

    const addedByUser = order.addedBy
      ? await this.userEntity.findOne({ where: { userId: order.addedBy } })
      : null;
    const updatedByUser = order.updatedBy
      ? await this.userEntity.findOne({ where: { userId: order.updatedBy } })
      : null;

    const allTaxGroups = await this.taxGroupRepo.find({ where: { companyId: Number(order.companyId) } });
    const taxGroupMap = new Map(allTaxGroups.map(tg => [tg.taxCode, tg.taxId]));
    const orderItems = order.orderItems?.map(item => ({
      ...item,
      taxId: item.taxGroup ? (taxGroupMap.get(item.taxGroup) ?? null) : null,
    })) || [];

    return {
      ...order,
      orderItems,
      termsConditionsFileUrl: order.termsConditionsFile ?? null,
      customerName: order.customer?.customerName ?? null,
      currencyCode: order.currency?.code ?? null,
      currencySymbol: (order.currency as any)?.symbol ?? null,
      companyName: order.company?.companyName ?? null,
      salesPersonName: order.salesPerson?.name ?? null,
      contactPersonName: order.contactPerson?.name ?? null,
      bankBookName: order.bankBook?.accountNumber ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }
}
