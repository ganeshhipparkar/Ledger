import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { ActivityCode } from '../activity/enums/activity-code.enum';
import { Filter } from 'src/utilities/filter';
import { FileTransfer } from 'src/utilities/file.transfer';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import {
  OrderEntity,
  OrderLifecycleStatus,
  OrderStatus,
} from './entity/order.entity';
import { OrderItemEntity } from './entity/order.item.entity';
import { OrderDiscountEntity } from './entity/order.discount.entity';
import { OrderExtraChargeEntity } from './entity/order.extra.charge.entity';
import { OrderAttachmentsEntity } from './entity/order.attachments';
import {
  OrderDiscountInputDto,
  OrderDto,
  OrderExtraChargeInputDto,
  OrderItemInputDto,
  OrderListDto,
  OrderUpdateDto,
  OrderUpdatePriceDto,
} from './dto/order.dto';
import { TaxCalculation } from './entity/order.item.entity';

interface ComputedItemAmounts {
  totalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  finalAmount: number;
}

interface ComputedOrderTotals {
  totalAmount: number;
  taxableAmount: number;
  taxAmount: number;
  discount: number;
  extraCharge: number;
  vatWithheldAmount: number;
  finalAmount: number;
}

type TaxValidationResult =
  | { valid: true; rateMap: Map<string, number> }
  | { valid: false; message: string };

@Injectable()
export class OrderService {
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

    private readonly eventEmitter: EventEmitter2,
    private readonly fileTransfer: FileTransfer,
    private readonly dataSource: DataSource,
  ) { }

  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;


  private resolvePerformer(req: any, fallbackId?: number) {
    const performerId: number | undefined = req?.user?.isImpersonation
      ? req?.user?.userId
      : (req?.user?.impersonatedBy ?? fallbackId);
    const performerEmail: string = req?.user?.isImpersonation
      ? (req?.user?.email ?? '')
      : (req?.user?.impersonatorEmail ?? '');
    return { performerId, performerEmail };
  }


  private toValidNumber(val: any, fallback: number = 0): number {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  }

  private toOptionalNumber(val: any): number | undefined {
    if (
      val === undefined ||
      val === null ||
      val === '' ||
      val === 'undefined' ||
      val === 'null'
    )
      return undefined;
    const n = Number(val);
    return isNaN(n) ? undefined : n;
  }


  private async validateTaxGroups(
    items: OrderItemInputDto[],
    companyId: number,
  ): Promise<TaxValidationResult> {
    const invalidCodes: string[] = [];
    const rateMap = new Map<string, number>();

    for (const item of items) {
      if (item.taxCalculation === TaxCalculation.NA || !item.taxGroup)
        continue;
      if (rateMap.has(item.taxGroup)) continue;

      const rec = await this.taxGroupRepo.findOne({
        where: { taxCode: item.taxGroup, companyId },
      });

      if (!rec) {
        invalidCodes.push(item.taxGroup);
      } else {
        rateMap.set(item.taxGroup, Number(rec.taxValue));
      }
    }

    if (invalidCodes.length > 0) {
      return {
        valid: false,
        message: `Invalid tax group code(s) for this company: ${invalidCodes.join(', ')}`,
      };
    }
    return { valid: true, rateMap };
  }


  private computeItemAmounts(
    item: OrderItemInputDto,
    taxRate: number,
  ): ComputedItemAmounts {
    const qty = this.toValidNumber(item.quantity, 0);
    const up = this.toValidNumber(item.unitPrice, 0);
    const rawAmount = qty * up;
    const itemDiscount = (item.discounts ?? []).reduce(
      (s, d) => s + this.toValidNumber(d.discountPrice, 0),
      0,
    );
    const itemExtraCharge = (item.extraCharges ?? []).reduce(
      (s, ec) => s + this.toValidNumber(ec.extraChargesPrice, 0),
      0,
    );
    const totalAmount = Math.max(0, rawAmount - itemDiscount + itemExtraCharge);
    const validRate = this.toValidNumber(taxRate, 0);
    let taxableAmount = 0;
    let taxAmount = 0;
    let finalAmount = totalAmount;

    if (item.taxCalculation === TaxCalculation.INCLUSIVE) {
      taxableAmount = validRate > 0 ? totalAmount / (1 + validRate / 100) : totalAmount;
      taxAmount = totalAmount - taxableAmount;
      taxAmount = Math.round(taxAmount * 10000) / 10000;
      taxableAmount = Math.round(taxableAmount * 10000) / 10000;
      finalAmount = totalAmount;
    } else if (item.taxCalculation === TaxCalculation.EXCLUSIVE) {
      taxableAmount = totalAmount;
      taxAmount = Math.round(((taxableAmount * validRate) / 100) * 10000) / 10000;
      finalAmount = totalAmount + (isNaN(taxAmount) ? 0 : taxAmount);
    } else {
      taxableAmount = 0;
      taxAmount = 0;
      finalAmount = totalAmount;
    }
    return {
      totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
      taxableAmount: isNaN(taxableAmount) ? 0 : taxableAmount,
      taxAmount: isNaN(taxAmount) ? 0 : taxAmount,
      finalAmount: isNaN(finalAmount) ? 0 : finalAmount,
    };
  }

  private computeOrderTotals(
    computedItems: ComputedItemAmounts[],
    orderDiscounts: OrderDiscountInputDto[] | undefined,
    orderExtraCharges: OrderExtraChargeInputDto[] | undefined,
    vatWithheld: string,
  ): ComputedOrderTotals {
    const totalAmount = computedItems.reduce(
      (s, i) => s + this.toValidNumber(i.totalAmount, 0),
      0,
    );
    const taxableAmount = computedItems.reduce(
      (s, i) => s + this.toValidNumber(i.taxableAmount, 0),
      0,
    );
    const taxAmount = computedItems.reduce(
      (s, i) => s + this.toValidNumber(i.taxAmount, 0),
      0,
    );
    const discount = (orderDiscounts ?? []).reduce(
      (s, d) => s + this.toValidNumber(d.discountPrice, 0),
      0,
    );
    const extraCharge = (orderExtraCharges ?? []).reduce(
      (s, ec) => s + this.toValidNumber(ec.extraChargesPrice, 0),
      0,
    );
    const vatWithheldAmount = vatWithheld === 'YES' ? taxAmount : 0;
    const finalAmount = totalAmount + taxAmount + extraCharge - discount - vatWithheldAmount;
    return {
      totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
      taxableAmount: isNaN(taxableAmount) ? 0 : taxableAmount,
      taxAmount: isNaN(taxAmount) ? 0 : taxAmount,
      discount: isNaN(discount) ? 0 : discount,
      extraCharge: isNaN(extraCharge) ? 0 : extraCharge,
      vatWithheldAmount: isNaN(vatWithheldAmount) ? 0 : vatWithheldAmount,
      finalAmount: isNaN(finalAmount) ? 0 : finalAmount,
    };
  }


  private validateDates(orderDate?: string, deliveryDate?: string): string | null {
    if (orderDate) {
      const order = new Date(orderDate);
      if (isNaN(order.getTime())) return 'Invalid orderDate';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (order < today) return 'orderDate must not be in the past';
    }
    if (deliveryDate) {
      const delivery = new Date(deliveryDate);
      if (isNaN(delivery.getTime())) return 'Invalid deliveryDate';
    }
    return null;
  }

  // ─── Status / lifecycle gate ─────────────────────────────────────────────
  // Returns an error message if the action is not permitted, or null if OK.

  private assertOrderActionable(
    order: OrderEntity,
    allowedStatuses: string[],
    operation: string,
  ): string | null {
    if (order.orderStatus === OrderLifecycleStatus.CLOSED)
      return `Closed orders cannot be ${operation}`;
    if (!allowedStatuses.includes(order.status))
      return `Cannot ${operation} an order with status: ${order.status}`;
    return null;
  }


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
        {},
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
        .orderBy('order.orderCode', 'ASC');

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

    return {
      ...order,
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


  async insertOrder(
    body: OrderDto,
    req?: any,
    files?: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds =
          req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(body.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add order to another company',
          };
        }
      }

      const dateError = this.validateDates(body.orderDate, body.deliveryDate);
      if (dateError) return { success: 0, message: dateError };

      const taxResult = await this.validateTaxGroups(
        body.orderItems,
        Number(body.companyId),
      );
      if (!taxResult.valid) return { success: 0, message: taxResult.message };
      const { rateMap } = taxResult;

      const orderCode = await this.codeGeneratorService.generateCode(
        this.orderRepo,
        body.customerId.toString(),
        Number(body.companyId),
        'orderCode',
        'ORD',
      );

      const currency = await this.currencyRepo.findOne({
        where: { curId: Number(body.currencyId) },
      });
      const currencyCode = (currency as any)?.code ?? '';

      const computedItems = body.orderItems.map((item) =>
        this.computeItemAmounts(
          item,
          (item.taxCalculation === TaxCalculation.EXCLUSIVE || item.taxCalculation === TaxCalculation.INCLUSIVE) && item.taxGroup
            ? (rateMap.get(item.taxGroup) ?? 0)
            : 0,
        ),
      );
      const totals = this.computeOrderTotals(
        computedItems,
        body.orderDiscounts,
        body.orderExtraCharges,
        body.vatWithheld,
      );

      const { performerId, performerEmail } = this.resolvePerformer(
        req,
        body.addedBy,
      );

      await queryRunner.connect();
      await queryRunner.startTransaction();

      const orderInsert = await queryRunner.manager.insert(OrderEntity, {
        orderCode,
        currencyId: this.toValidNumber(body.currencyId),
        currencyCode,
        customerId: this.toValidNumber(body.customerId),
        orderDate: new Date(body.orderDate),
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : undefined,
        companyId: this.toValidNumber(body.companyId),
        remarks: body.remarks ?? undefined,
        termsConditionsId: this.toOptionalNumber(body.termsConditionsId) ?? null,
        termsConditionsText: body.termsConditionsText ?? undefined,
        bankBookId: this.toOptionalNumber(body.bankBookId) ?? null,
        accountNumber: body.accountNumber ?? undefined,
        sourceQuotationId: this.toOptionalNumber(body.sourceQuotationId) ?? null,
        salesPersonId: this.toOptionalNumber(body.salesPersonId) ?? null,
        contactPersonId: this.toOptionalNumber(body.contactPersonId) ?? null,
        currencyConversionRate: this.toValidNumber(body.currencyConversionRate, 1),
        vatWithheld: body.vatWithheld,
        businessTerms: body.businessTerms,
        paymentType: body.paymentType,
        deliveryTerms: body.deliveryTerms ?? null,
        discountApplicable: body.discountApplicable,
        shippingState: body.shippingState,
        billingState: body.billingState,
        deliveryState: body.deliveryState,
        deliveryType: body.deliveryType,
        invoiceGenerationOn: body.invoiceGenerationOn,
        invoiceAutoApproval: body.invoiceAutoApproval,
        placeOfSupply: body.placeOfSupply ?? undefined,
        totalAmount: this.toValidNumber(totals.totalAmount, 0),
        taxableAmount: this.toValidNumber(totals.taxableAmount, 0),
        taxAmount: this.toValidNumber(totals.taxAmount, 0),
        discount: this.toValidNumber(totals.discount, 0) || null,
        extraCharge: this.toValidNumber(totals.extraCharge, 0) || null,
        vatWithheldAmount: this.toValidNumber(totals.vatWithheldAmount, 0),
        finalAmount: this.toValidNumber(totals.finalAmount, 0),
        status: OrderStatus.DRAFT,
        orderStatus: OrderLifecycleStatus.OPEN,
        addedBy: this.toOptionalNumber(performerId),
        addedDate: new Date(),
      });
      const insertId: number = orderInsert.raw?.insertId;

      for (let i = 0; i < body.orderItems.length; i++) {
        const item = body.orderItems[i];
        const computed = computedItems[i];

        const validItemId = this.toOptionalNumber(item.itemId);
        if (!validItemId || validItemId <= 0) {
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          return {
            success: 0,
            message: `Row ${i + 1}: Valid item selection is required.`,
          };
        }

        const itemInsert = await queryRunner.manager.insert(OrderItemEntity, {
          orderId: insertId,
          itemId: validItemId,
          quantity: this.toValidNumber(item.quantity, 0),
          unitPrice: this.toValidNumber(item.unitPrice, 0),
          taxCalculation: item.taxCalculation,
          taxGroup: item.taxGroup ?? null,
          itemGL: item.itemGL ?? null,
          totalAmount: this.toValidNumber(computed.totalAmount, 0),
          taxableAmount: this.toValidNumber(computed.taxableAmount, 0),
          taxAmount: this.toValidNumber(computed.taxAmount, 0),
          finalAmount: this.toValidNumber(computed.finalAmount, 0),
          addedBy: this.toOptionalNumber(performerId),
          addedDate: new Date(),
        });
        const itemInsertId: number = itemInsert.raw?.insertId;

        for (const d of item.discounts ?? []) {
          await queryRunner.manager.insert(OrderDiscountEntity, {
            orderItemId: itemInsertId,
            orderId: null,
            manufacturerId: this.toOptionalNumber(d.manufacturerId) ?? null,
            discountPrice: this.toValidNumber(d.discountPrice, 0),
            discountDescription: d.discountDescription,
            addedBy: this.toOptionalNumber(performerId),
            addedDate: new Date(),
          });
        }

        for (const ec of item.extraCharges ?? []) {
          await queryRunner.manager.insert(OrderExtraChargeEntity, {
            orderItemId: itemInsertId,
            orderId: null,
            manufacturerId: this.toOptionalNumber(ec.manufacturerId) ?? null,
            extraChargesPrice: this.toValidNumber(ec.extraChargesPrice, 0),
            extraChargesDescription: ec.extraChargesDescription,
            addedBy: this.toOptionalNumber(performerId),
            addedDate: new Date(),
          });
        }
      }

      for (const d of body.orderDiscounts ?? []) {
        await queryRunner.manager.insert(OrderDiscountEntity, {
          orderId: insertId,
          orderItemId: null,
          manufacturerId: this.toOptionalNumber(d.manufacturerId) ?? null,
          discountPrice: this.toValidNumber(d.discountPrice, 0),
          discountDescription: d.discountDescription,
          addedBy: this.toOptionalNumber(performerId),
          addedDate: new Date(),
        });
      }

      for (const ec of body.orderExtraCharges ?? []) {
        await queryRunner.manager.insert(OrderExtraChargeEntity, {
          orderId: insertId,
          orderItemId: null,
          manufacturerId: this.toOptionalNumber(ec.manufacturerId) ?? null,
          extraChargesPrice: this.toValidNumber(ec.extraChargesPrice, 0),
          extraChargesDescription: ec.extraChargesDescription,
          addedBy: this.toOptionalNumber(performerId),
          addedDate: new Date(),
        });
      }

      await queryRunner.commitTransaction();

      const termsFile = files?.termsConditionsFile?.[0];
      if (termsFile) {
        const termsFilename = termsFile.filename || termsFile.originalname;
        await this.fileTransfer.fileTransfer(termsFilename, insertId, 'order', {
          subfolder: 'terms',
        });
        const termsUrl = `/upload/order/${insertId}/terms/${termsFilename}`;
        await this.orderRepo.update({ orderId: insertId }, { termsConditionsFile: termsUrl });
      }

      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransfer(filename, insertId, 'order', {
          subfolder: 'attachments',
        });
        await this.attachmentRepo.insert({
          orderId: insertId,
          attachmentUrl: `/upload/order/${insertId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.ORDER_CREATE,
        userId: performerId,
        companyId: Number(body.companyId),
        actorType: 'USER',
        targetType: 'ORDER',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          orderCode,
          customerId: body.customerId,
          companyId: body.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Order created successfully',
        data: { insertData: insertId },
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


  async updateOrder(
    body: OrderUpdateDto & { updatedBy?: number },
    req?: any,
    files?: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
  ) {
    if (!body.orderId) {
      return { success: 0, message: 'orderId is mandatory' };
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const orderId = Number(body.orderId);

      const existing = await this.orderRepo.findOne({ where: { orderId } });
      if (!existing) return { success: 0, message: 'Order not found' };

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds =
          req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(existing.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update order of another company',
          };
        }
      }

      if (existing.orderStatus === OrderLifecycleStatus.CLOSED) {
        return { success: 0, message: 'Closed orders cannot be modified' };
      }

      if ((body as any).customerId !== undefined) {
        return {
          success: 0,
          message: 'customerId cannot be changed after order creation',
        };
      }
      if ((body as any).currencyId !== undefined) {
        return {
          success: 0,
          message: 'currencyId cannot be changed after order creation',
        };
      }

      if (existing.status !== OrderStatus.DRAFT) {
        const isContentUpdate =
          body.orderItems !== undefined ||
          body.orderDate !== undefined ||
          body.deliveryDate !== undefined ||
          body.bankBookId !== undefined ||
          body.salesPersonId !== undefined ||
          body.contactPersonId !== undefined ||
          body.remarks !== undefined ||
          body.termsConditionsId !== undefined ||
          body.vatWithheld !== undefined ||
          body.businessTerms !== undefined ||
          body.paymentType !== undefined ||
          body.deliveryTerms !== undefined ||
          body.discountApplicable !== undefined ||
          body.shippingState !== undefined ||
          body.billingState !== undefined ||
          body.deliveryState !== undefined ||
          body.deliveryType !== undefined ||
          body.invoiceGenerationOn !== undefined ||
          body.invoiceAutoApproval !== undefined ||
          body.placeOfSupply !== undefined;

        if (isContentUpdate) {
          return {
            success: 0,
            message: 'Only draft orders can be fully edited.',
          };
        }
      }

      if (body.orderDate || body.deliveryDate) {
        const effectiveOrder = body.orderDate ?? String(existing.orderDate);
        const effectiveDelivery =
          body.deliveryDate ?? String(existing.deliveryDate);
        const dateError = this.validateDates(effectiveOrder, effectiveDelivery);
        if (dateError) return { success: 0, message: dateError };
      }

      const effectiveCompanyId = body.companyId
        ? Number(body.companyId)
        : Number(existing.companyId);

      let computedItems: ComputedItemAmounts[] | null = null;
      let totals: ComputedOrderTotals | null = null;
      let rateMap: Map<string, number> = new Map();

      if (body.orderItems && body.orderItems.length > 0) {
        const taxResult = await this.validateTaxGroups(
          body.orderItems,
          effectiveCompanyId,
        );
        if (!taxResult.valid) return { success: 0, message: taxResult.message };
        rateMap = taxResult.rateMap;

        computedItems = body.orderItems.map((item) =>
          this.computeItemAmounts(
            item,
            (item.taxCalculation === TaxCalculation.EXCLUSIVE || item.taxCalculation === TaxCalculation.INCLUSIVE) && item.taxGroup
              ? (rateMap.get(item.taxGroup) ?? 0)
              : 0,
          ),
        );
        totals = this.computeOrderTotals(
          computedItems,
          body.orderDiscounts,
          body.orderExtraCharges,
          body.vatWithheld ?? existing.vatWithheld,
        );
      }

      const { performerId, performerEmail } = this.resolvePerformer(
        req,
        body.updatedBy,
      );

      const patch: any = {};
      if (body.orderDate !== undefined) patch.orderDate = new Date(body.orderDate);
      if (body.deliveryDate !== undefined) patch.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
      if (body.companyId !== undefined)
        patch.companyId = this.toValidNumber(body.companyId, existing.companyId);
      if (body.remarks !== undefined) patch.remarks = body.remarks;
      if (body.termsConditionsId !== undefined)
        patch.termsConditionsId = this.toOptionalNumber(body.termsConditionsId) ?? null;
      if (body.termsConditionsText !== undefined)
        patch.termsConditionsText = body.termsConditionsText ?? null;
      if (body.bankBookId !== undefined)
        patch.bankBookId = this.toOptionalNumber(body.bankBookId) ?? null;
      if (body.accountNumber !== undefined)
        patch.accountNumber = body.accountNumber ?? null;
      if (body.salesPersonId !== undefined)
        patch.salesPersonId = this.toOptionalNumber(body.salesPersonId) ?? null;
      if (body.contactPersonId !== undefined)
        patch.contactPersonId = this.toOptionalNumber(body.contactPersonId) ?? null;
      if (body.currencyConversionRate !== undefined)
        patch.currencyConversionRate = this.toValidNumber(
          body.currencyConversionRate,
          existing.currencyConversionRate || 1,
        );
      if (body.vatWithheld !== undefined) patch.vatWithheld = body.vatWithheld;
      if (body.businessTerms !== undefined) patch.businessTerms = body.businessTerms;
      if (body.paymentType !== undefined) patch.paymentType = body.paymentType;
      if (body.deliveryTerms !== undefined)
        patch.deliveryTerms = body.deliveryTerms ?? null;
      if (body.discountApplicable !== undefined)
        patch.discountApplicable = body.discountApplicable;
      if (body.shippingState !== undefined) patch.shippingState = body.shippingState;
      if (body.billingState !== undefined) patch.billingState = body.billingState;
      if (body.deliveryState !== undefined) patch.deliveryState = body.deliveryState;
      if (body.deliveryType !== undefined) patch.deliveryType = body.deliveryType;
      if (body.invoiceGenerationOn !== undefined)
        patch.invoiceGenerationOn = body.invoiceGenerationOn;
      if (body.invoiceAutoApproval !== undefined)
        patch.invoiceAutoApproval = body.invoiceAutoApproval;
      if (body.placeOfSupply !== undefined)
        patch.placeOfSupply = body.placeOfSupply ?? undefined;
      if (body.status !== undefined) patch.status = body.status;

      if (totals) {
        patch.totalAmount = this.toValidNumber(totals.totalAmount, 0);
        patch.taxableAmount = this.toValidNumber(totals.taxableAmount, 0);
        patch.taxAmount = this.toValidNumber(totals.taxAmount, 0);
        patch.discount = this.toValidNumber(totals.discount, 0) || null;
        patch.extraCharge = this.toValidNumber(totals.extraCharge, 0) || null;
        patch.vatWithheldAmount = this.toValidNumber(totals.vatWithheldAmount, 0);
        patch.finalAmount = this.toValidNumber(totals.finalAmount, 0);
      }

      const pId = this.toOptionalNumber(performerId);
      if (pId) patch.updatedBy = pId;
      patch.updatedDate = new Date();

      await queryRunner.connect();
      await queryRunner.startTransaction();

      if (Object.keys(patch).length > 0) {
        await queryRunner.manager.update(OrderEntity, { orderId }, patch);
      }

      if (body.orderItems && body.orderItems.length > 0 && computedItems) {
        const existingItems = await queryRunner.manager.find(OrderItemEntity, {
          where: { orderId },
          select: ['orderItemId'],
        });
        const existingItemIds = existingItems.map((i) => i.orderItemId);

        if (existingItemIds.length > 0) {
          await queryRunner.manager.delete(OrderDiscountEntity, {
            orderItemId: In(existingItemIds),
          });
          await queryRunner.manager.delete(OrderExtraChargeEntity, {
            orderItemId: In(existingItemIds),
          });
        }
        await queryRunner.manager.delete(OrderItemEntity, { orderId });

        for (let i = 0; i < body.orderItems.length; i++) {
          const item = body.orderItems[i];
          const computed = computedItems[i];

          const validItemId = this.toOptionalNumber(item.itemId);
          if (!validItemId || validItemId <= 0) {
            if (queryRunner.isTransactionActive) {
              await queryRunner.rollbackTransaction();
            }
            return {
              success: 0,
              message: `Row ${i + 1}: Valid item selection is required.`,
            };
          }

          const itemInsert = await queryRunner.manager.insert(OrderItemEntity, {
            orderId,
            itemId: validItemId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            taxCalculation: item.taxCalculation,
            taxGroup: item.taxGroup ?? null,
            itemGL: item.itemGL ?? null,
            totalAmount: computed.totalAmount,
            taxableAmount: computed.taxableAmount,
            taxAmount: computed.taxAmount,
            finalAmount: computed.finalAmount,
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
          const itemInsertId: number = itemInsert.raw?.insertId;

          for (const d of item.discounts ?? []) {
            await queryRunner.manager.insert(OrderDiscountEntity, {
              orderItemId: itemInsertId,
              orderId: null,
              manufacturerId: d.manufacturerId ?? null,
              discountPrice: Number(d.discountPrice),
              discountDescription: d.discountDescription,
              addedBy: performerId ? Number(performerId) : undefined,
              addedDate: new Date(),
            });
          }

          for (const ec of item.extraCharges ?? []) {
            await queryRunner.manager.insert(OrderExtraChargeEntity, {
              orderItemId: itemInsertId,
              orderId: null,
              manufacturerId: ec.manufacturerId ?? null,
              extraChargesPrice: Number(ec.extraChargesPrice),
              extraChargesDescription: ec.extraChargesDescription,
              addedBy: performerId ? Number(performerId) : undefined,
              addedDate: new Date(),
            });
          }
        }
      }

      if (body.orderDiscounts !== undefined) {
        await queryRunner.manager.delete(OrderDiscountEntity, {
          orderId,
          orderItemId: null,
        });
        for (const d of body.orderDiscounts) {
          await queryRunner.manager.insert(OrderDiscountEntity, {
            orderId,
            orderItemId: null,
            manufacturerId: d.manufacturerId ?? null,
            discountPrice: Number(d.discountPrice),
            discountDescription: d.discountDescription,
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
        }
      }

      if (body.orderExtraCharges !== undefined) {
        await queryRunner.manager.delete(OrderExtraChargeEntity, {
          orderId,
          orderItemId: null,
        });
        for (const ec of body.orderExtraCharges) {
          await queryRunner.manager.insert(OrderExtraChargeEntity, {
            orderId,
            orderItemId: null,
            manufacturerId: ec.manufacturerId ?? null,
            extraChargesPrice: Number(ec.extraChargesPrice),
            extraChargesDescription: ec.extraChargesDescription,
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
        }
      }

      await queryRunner.commitTransaction();

      for (const file of files?.attachments ?? []) {
        const filename = file.filename || file.originalname;
        await this.fileTransfer.fileTransfer(filename, orderId, 'order', {
          subfolder: 'attachments',
        });
        await this.attachmentRepo.insert({
          orderId,
          attachmentUrl: `/upload/order/${orderId}/attachments/${filename}`,
          addedBy: performerId ? Number(performerId) : undefined,
          addedDate: new Date(),
        });
      }

      const termsFile = files?.termsConditionsFile?.[0];
      if (termsFile) {
        const termsFilename = termsFile.filename || termsFile.originalname;
        await this.fileTransfer.fileTransfer(termsFilename, orderId, 'order', {
          subfolder: 'terms',
        });
        await this.orderRepo.update(
          { orderId },
          {
            termsConditionsFile: `/upload/order/${orderId}/terms/${termsFilename}`,
          },
        );
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.ORDER_UPDATE,
        userId: performerId,
        companyId: existing.companyId,
        actorType: 'USER',
        targetType: 'ORDER',
        targetId: String(orderId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          orderCode: existing.orderCode,
          status: body.status ?? existing.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return { success: 1, message: 'Order updated successfully' };
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


  async submitOrder(orderId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      const order = await this.orderRepo.findOne({ where: { orderId } });
      if (!order) return { success: 0, message: 'Order not found' };

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

      if (order.status !== OrderStatus.DRAFT) {
        return { success: 0, message: 'Only draft orders can be submitted' };
      }

      await this.orderRepo.update({ orderId }, { status: OrderStatus.PLACED });

      const { performerId, performerEmail } = this.resolvePerformer(req);
      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.ORDER_UPDATE,
        userId: performerId,
        companyId: order.companyId,
        actorType: 'USER',
        targetType: 'ORDER',
        targetId: String(orderId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          orderCode: order.orderCode,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return { success: 1, message: 'Order submitted successfully' };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async cancelOrder(orderId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      const order = await this.orderRepo.findOne({ where: { orderId } });
      if (!order) return { success: 0, message: 'Order not found' };

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

      const error = this.assertOrderActionable(
        order,
        [OrderStatus.PLACED, OrderStatus.DELIVERED, OrderStatus.PARTIAL_DELIVERED],
        'cancelled',
      );
      if (error) return { success: 0, message: error };

      // Cancel only flips orderStatus to CLOSED — does not touch the delivery status
      await this.orderRepo.update({ orderId }, { orderStatus: OrderLifecycleStatus.CLOSED });

      const { performerId, performerEmail } = this.resolvePerformer(req);
      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.ORDER_CANCEL,
        userId: performerId,
        companyId: order.companyId,
        actorType: 'USER',
        targetType: 'ORDER',
        targetId: String(orderId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          orderCode: order.orderCode,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return { success: 1, message: 'Order cancelled successfully' };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }


  async closeOrder(orderId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      const order = await this.orderRepo.findOne({ where: { orderId } });
      if (!order) return { success: 0, message: 'Order not found' };

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

      const error = this.assertOrderActionable(
        order,
        [OrderStatus.PLACED, OrderStatus.PARTIAL_DELIVERED, OrderStatus.DELIVERED],
        'closed',
      );
      if (error) return { success: 0, message: error };

      await this.orderRepo.update({ orderId }, { status: OrderStatus.CLOSED });

      const { performerId, performerEmail } = this.resolvePerformer(req);
      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.ORDER_CLOSE,
        userId: performerId,
        companyId: order.companyId,
        actorType: 'USER',
        targetType: 'ORDER',
        targetId: String(orderId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          orderCode: order.orderCode,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return { success: 1, message: 'Order closed successfully' };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }


  async updateOrderPrice(body: OrderUpdatePriceDto, req?: any) {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const orderId = Number(body.orderId);

      const order = await this.orderRepo.findOne({
        where: { orderId },
        relations: [
          'orderItems',
          'orderItems.discounts',
          'orderItems.extraCharges',
          'discounts',
          'extraCharges',
        ],
      });
      if (!order) return { success: 0, message: 'Order not found' };

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

      const error = this.assertOrderActionable(
        order,
        [OrderStatus.PLACED, OrderStatus.DELIVERED, OrderStatus.PARTIAL_DELIVERED],
        'price-updated',
      );
      if (error) return { success: 0, message: error };

      const orderItemIds = (order.orderItems ?? []).map((i) => i.orderItemId);
      for (const { orderItemId } of body.items) {
        if (!orderItemIds.includes(Number(orderItemId))) {
          return {
            success: 0,
            message: `orderItemId ${orderItemId} does not belong to order ${orderId}`,
          };
        }
      }

      const taxRateMap = new Map<string, number>();
      for (const item of order.orderItems ?? []) {
        if ((item.taxCalculation === TaxCalculation.EXCLUSIVE || item.taxCalculation === TaxCalculation.INCLUSIVE) && item.taxGroup) {
          if (!taxRateMap.has(item.taxGroup)) {
            const rec = await this.taxGroupRepo.findOne({
              where: { taxCode: item.taxGroup, companyId: order.companyId },
            });
            if (rec) taxRateMap.set(item.taxGroup, Number(rec.taxValue));
          }
        }
      }

      await queryRunner.connect();
      await queryRunner.startTransaction();

      const updatedComputedMap = new Map<number, ComputedItemAmounts>();

      for (const { orderItemId, newUnitPrice } of body.items) {
        const itemEntity = (order.orderItems ?? []).find(
          (i) => i.orderItemId === Number(orderItemId),
        );
        if (!itemEntity) continue;

        const syntheticItem: OrderItemInputDto = {
          itemId: itemEntity.itemId,
          quantity: itemEntity.quantity,
          unitPrice: newUnitPrice,
          taxCalculation: itemEntity.taxCalculation as TaxCalculation,
          taxGroup: itemEntity.taxGroup ?? undefined,
          discounts: (itemEntity.discounts ?? []).map((d) => ({
            manufacturerId: d.manufacturerId ?? undefined,
            discountPrice: Number(d.discountPrice),
            discountDescription: d.discountDescription,
          })),
          extraCharges: (itemEntity.extraCharges ?? []).map((ec) => ({
            manufacturerId: ec.manufacturerId ?? undefined,
            extraChargesPrice: Number(ec.extraChargesPrice),
            extraChargesDescription: ec.extraChargesDescription,
          })),
        };

        const taxRate =
          (itemEntity.taxCalculation === TaxCalculation.EXCLUSIVE ||
            itemEntity.taxCalculation === TaxCalculation.INCLUSIVE) &&
            itemEntity.taxGroup
            ? (taxRateMap.get(itemEntity.taxGroup) ?? 0)
            : 0;

        const computed = this.computeItemAmounts(syntheticItem, taxRate);
        updatedComputedMap.set(Number(orderItemId), computed);

        await queryRunner.manager.update(
          OrderItemEntity,
          { orderItemId: Number(orderItemId) },
          {
            unitPrice: this.toValidNumber(newUnitPrice, 0),
            totalAmount: computed.totalAmount,
            taxableAmount: computed.taxableAmount,
            taxAmount: computed.taxAmount,
            finalAmount: computed.finalAmount,
          },
        );
      }

      const allComputedItems: ComputedItemAmounts[] = (order.orderItems ?? []).map(
        (item) => {
          const updated = updatedComputedMap.get(item.orderItemId);
          if (updated) return updated;
          return {
            totalAmount: Number(item.totalAmount),
            taxableAmount: Number(item.taxableAmount),
            taxAmount: Number(item.taxAmount),
            finalAmount: Number(item.finalAmount),
          };
        },
      );

      const orderLevelDiscounts: OrderDiscountInputDto[] = (order.discounts ?? [])
        .filter((d) => d.orderItemId === null || d.orderItemId === undefined)
        .map((d) => ({
          manufacturerId: d.manufacturerId ?? undefined,
          discountPrice: Number(d.discountPrice),
          discountDescription: d.discountDescription,
        }));
      const orderLevelExtraCharges: OrderExtraChargeInputDto[] = (
        order.extraCharges ?? []
      )
        .filter((ec) => ec.orderItemId === null || ec.orderItemId === undefined)
        .map((ec) => ({
          manufacturerId: ec.manufacturerId ?? undefined,
          extraChargesPrice: Number(ec.extraChargesPrice),
          extraChargesDescription: ec.extraChargesDescription,
        }));

      const newTotals = this.computeOrderTotals(
        allComputedItems,
        orderLevelDiscounts,
        orderLevelExtraCharges,
        order.vatWithheld,
      );

      await queryRunner.manager.update(
        OrderEntity,
        { orderId },
        {
          totalAmount: newTotals.totalAmount,
          taxableAmount: newTotals.taxableAmount,
          taxAmount: newTotals.taxAmount,
          discount: newTotals.discount || null,
          extraCharge: newTotals.extraCharge || null,
          vatWithheldAmount: newTotals.vatWithheldAmount,
          finalAmount: newTotals.finalAmount,
          updatedDate: new Date(),
        },
      );

      await queryRunner.commitTransaction();

      const { performerId, performerEmail } = this.resolvePerformer(req);
      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.ORDER_UPDATE,
        userId: performerId,
        companyId: order.companyId,
        actorType: 'USER',
        targetType: 'ORDER',
        targetId: String(orderId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          orderCode: order.orderCode,
          updatedItems: body.items.length,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return { success: 1, message: 'Order prices updated successfully' };
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

  async deleteOrder(orderId: number, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      const order = await this.orderRepo.findOne({ where: { orderId } });
      if (!order) return { success: 0, message: 'Order not found' };

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

      if (order.status !== OrderStatus.DRAFT) {
        return { success: 0, message: 'Only draft orders can be deleted' };
      }

      await this.orderRepo.softDelete({ orderId });

      const { performerId, performerEmail } = this.resolvePerformer(req);
      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.ORDER_DELETE,
        userId: performerId,
        companyId: order.companyId,
        actorType: 'USER',
        targetType: 'ORDER',
        targetId: String(orderId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          orderCode: order.orderCode,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return { success: 1, message: 'Order deleted successfully' };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async deleteOrderAttachment(attachmentId: number, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const att = await this.attachmentRepo.findOne({
        where: { orderAttachmentId: attachmentId },
      });
      if (!att) {
        throw new NotFoundException('Order attachment not found');
      }

      const order = await this.orderRepo.findOne({
        where: { orderId: att.orderId },
      });
      if (!order) {
        throw new NotFoundException('Associated order not found');
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds =
          req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(order.companyId))) {
          throw new ForbiddenException(
            'Access denied: order attachment belongs to another company',
          );
        }
      }

      const relativePath = att.attachmentUrl.startsWith('/')
        ? att.attachmentUrl.substring(1)
        : att.attachmentUrl;
      const fullPath = path.resolve('.', relativePath);
      if (fs.existsSync(fullPath)) {
        try {
          await fs.promises.unlink(fullPath);
        } catch {

        }
      }

      await this.attachmentRepo.delete({ orderAttachmentId: attachmentId });

      return { success: 1, message: 'Order attachment deleted successfully' };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }


  async deleteOrderTermsFile(orderId: number, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const order = await this.orderRepo.findOne({ where: { orderId } });
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

      if (order.termsConditionsFile) {
        const relativePath = order.termsConditionsFile.startsWith('/')
          ? order.termsConditionsFile.substring(1)
          : order.termsConditionsFile;
        const fullPath = path.resolve('.', relativePath);
        if (fs.existsSync(fullPath)) {
          try {
            await fs.promises.unlink(fullPath);
          } catch {
          }
        }

        await this.orderRepo.update({ orderId }, { termsConditionsFile: null });
      }

      return {
        success: 1,
        message: 'Terms & Conditions file deleted successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}
