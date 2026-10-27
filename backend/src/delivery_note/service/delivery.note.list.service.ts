import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import {
  OrderEntity,
  OrderLifecycleStatus,
  OrderStatus,
} from 'src/order/entity/order.entity';
import { DeliveryNoteEntity } from '../entity/delivery.note.entity';
import { DeliveryNoteItemEntity } from '../entity/delivery.note.item.entity';
import { DeliveryNoteAttachmentEntity } from '../entity/delivery.note.attachments.entity';
import { DeliveryNoteListDto } from '../dto/delivery.note.dto';

@Injectable()
export class DeliveryNoteListService {
  constructor(
    @InjectRepository(DeliveryNoteEntity)
    private readonly deliveryNoteRepo: Repository<DeliveryNoteEntity>,

    @InjectRepository(DeliveryNoteItemEntity)
    private readonly deliveryNoteItemRepo: Repository<DeliveryNoteItemEntity>,

    @InjectRepository(DeliveryNoteAttachmentEntity)
    private readonly attachmentRepo: Repository<DeliveryNoteAttachmentEntity>,

    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,

    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,

    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,

    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,

    private readonly filter: Filter,
  ) {}

  async deliveryNoteList(param: DeliveryNoteListDto , req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.deliveryNoteRepo.createQueryBuilder('delivery_note');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds =
          req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'delivery_note.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Delivery notes fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'delivery_note',
        {
          customerName: 'customer',
          companyName: 'company',
          orderCode: 'order',
          orderId: 'delivery_note',
          customerId: 'delivery_note',
        },
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.deliveryNoteRepo,
      )) as [number, number];

      queryBuilder
        .leftJoinAndSelect('delivery_note.customer', 'customer')
        .leftJoinAndSelect('delivery_note.company', 'company')
        .leftJoinAndSelect('delivery_note.order', 'order')
        .skip(skip)
        .take(limit)
        .orderBy('delivery_note.addedDate', 'DESC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const addedByIds = Array.from(
        new Set(data.map((dn) => dn.addedBy).filter(Boolean)),
      ) as number[];
      const userMap = new Map<number, string>();
      if (addedByIds.length > 0) {
        const users = await this.userEntity.find({
          where: { userId: In(addedByIds) },
          select: ['userId', 'name'],
        });
        users.forEach((u) => userMap.set(u.userId, u.name));
      }

      const formattedData = data.map((dn) => ({
        ...dn,
        orderCode: dn.order?.orderCode ?? null,
        customerName: dn.customer?.customerName ?? null,
        companyName: dn.company?.companyName ?? null,
        addedByName: dn.addedBy ? (userMap.get(dn.addedBy) ?? null) : null,
      }));

      return {
        success: 1,
        message: 'Delivery notes fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async getDeliveryNoteDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);

    const dn = await this.deliveryNoteRepo.findOne({
      where: { deliveryNoteId: id },
      relations: [
        'customer',
        'company',
        'order',
        'items',
        'items.item',
        'items.orderItem',
        'attachments',
      ],
    });

    if (!dn) {
      throw new NotFoundException('Delivery note not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds =
        req?.scopedCompanyIds || [authCtx.activeCompanyId];
      if (!scopedCompanyIds.includes(Number(dn.companyId))) {
        throw new ForbiddenException(
          'Access denied: delivery note belongs to another company',
        );
      }
    }

    const addedByUser = dn.addedBy
      ? await this.userEntity.findOne({ where: { userId: dn.addedBy } })
      : null;

    const items = (dn.items || [])
      .slice()
      .sort((a, b) => (a.deliveryNoteItemId ?? 0) - (b.deliveryNoteItemId ?? 0))
      .map((it) => ({
        deliveryNoteItemId: it.deliveryNoteItemId,
        orderItemId: it.orderItemId,
        itemId: it.itemId ?? null,
        itemName: it.item?.itemName ?? (it.orderItem?.description ?? ''),
        itemCode: it.item?.itemCode ?? null,
        description: it.orderItem?.description ?? null,
        requestedQuantity: Number(it.requestedQuantity),
        pendingQuantity: Number(it.pendingQuantity),
        deliverQuantity: Number(it.deliverQuantity),
      }));

    return {
      ...dn,
      orderCode: dn.order?.orderCode ?? null,
      customerName: dn.customer?.customerName ?? null,
      companyName: dn.company?.companyName ?? null,
      addedByName: addedByUser?.name ?? null,
      items,
      attachments: dn.attachments || [],
    };
  }

  async getDeliverableOrderItems(orderId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      const order = await this.orderRepo.findOne({
        where: { orderId },
        relations: ['orderItems', 'orderItems.item', 'customer'],
      });

      if (!order) {
        return { success: 0, message: 'Order not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds =
          req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(order.companyId))) {
          return {
            success: 0,
            message: 'Access denied: order belongs to another company',
          };
        }
      }

      const deliverableStatuses = [
        OrderStatus.PLACED,
        OrderStatus.PARTIAL_DELIVERED,
      ];
      if (
        !deliverableStatuses.includes(order.status as OrderStatus) ||
        order.orderStatus !== OrderLifecycleStatus.OPEN
      ) {
        return {
          success: 0,
          message:
            'Order is not in a deliverable status. Only orders with status PLACED or PARTIAL_DELIVERED and lifecycle OPEN can be delivered.',
        };
      }

      const deliverableItems = (order.orderItems || [])
        .map((it) => {
          const requestedQuantity = Number(it.quantity);
          const deliveredQuantity = Number(it.deliveredQuantity || 0);
          const pendingQuantity = Math.max(0, requestedQuantity - deliveredQuantity);

          return {
            orderItemId: it.orderItemId,
            itemId: it.itemId ?? null,
            itemName: it.item?.itemName ?? (it.description ?? ''),
            itemCode: it.item?.itemCode ?? null,
            description: it.description ?? null,
            requestedQuantity,
            deliveredQuantity,
            pendingQuantity,
          };
        })
        .filter((it) => it.pendingQuantity > 0);

      return {
        success: 1,
        orderId: order.orderId,
        orderCode: order.orderCode,
        orderDate: order.orderDate,
        customerId: order.customerId,
        customerName: order.customer?.customerName ?? null,
        items: deliverableItems,
        data: deliverableItems,
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async getDeliverableOrdersForCustomer(customerId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      const customer = await this.customerRepo.findOne({
        where: { customerId },
      });

      if (!customer) {
        return { success: 0, message: 'Customer not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds =
          req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(customer.companyId))) {
          return {
            success: 0,
            message: 'Access denied: customer belongs to another company',
          };
        }
      }

      const scopedCompanyIds = authCtx.isSuperAdmin
        ? [Number(customer.companyId)]
        : req?.scopedCompanyIds || [authCtx.activeCompanyId];

      const orders = await this.orderRepo.find({
        where: {
          customerId,
          companyId: In(scopedCompanyIds),
          status: In([OrderStatus.PLACED, OrderStatus.PARTIAL_DELIVERED]),
          orderStatus: OrderLifecycleStatus.OPEN,
        },
        select: ['orderId', 'orderCode', 'orderDate', 'status'],
        order: { orderDate: 'DESC' },
      });

      return {
        success: 1,
        data: orders,
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}
