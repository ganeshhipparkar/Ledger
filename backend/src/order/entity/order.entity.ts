import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { BankBookEntity } from 'src/bank_book_master/entity/bank.book.entity';
import { TermsAndConditionsEntity } from 'src/terms_conditions/entity/terms.conditions.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { OrderItemEntity } from './order.item.entity';
import { OrderDiscountEntity } from './order.discount.entity';
import { OrderExtraChargeEntity } from './order.extra.charge.entity';
import { OrderAttachmentsEntity } from './order.attachments';
import { QuotationEntity } from 'src/quotation/entity/quotation.entity';

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PLACED = 'PLACED',
  DELIVERED = 'DELIVERED',
  PARTIAL_DELIVERED = 'PARTIAL_DELIVERED',
  CLOSED = 'CLOSED',
}

export enum OrderLifecycleStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum VatWithheld {
  YES = 'YES',
  NO = 'NO',
}

export enum BusinessTerms {
  TWELVE_DAYS = 'TWELVE_DAYS',
  FIVE_DAYS = 'FIVE_DAYS',
  SEVEN_DAYS = 'SEVEN_DAYS',
  CASH_IN_ADVANCE = 'CASH_IN_ADVANCE',
  CASH_NEXT_DELIVERY = 'CASH_NEXT_DELIVERY',
}

export enum PaymentType {
  CREDIT = 'CREDIT',
  CASH = 'CASH',
}

export enum DiscountApplicable {
  ON_EACH_DELIVERY = 'ON_EACH_DELIVERY',
  ON_LAST_DELIVERY = 'ON_LAST_DELIVERY',
}

export enum DeliveryType {
  LOCAL = 'LOCAL',
  INTERSTATE = 'INTERSTATE',
  INTERNATIONAL = 'INTERNATIONAL',
}

export enum InvoiceGenerationOn {
  DELIVERY_LEVEL = 'DELIVERY_LEVEL',
  ORDER_LEVEL = 'ORDER_LEVEL',
}

export enum InvoiceAutoApproval {
  YES = 'YES',
  NO = 'NO',
}

export enum PlaceOfSupply {
  JOHN_MARTIN_LAGOS = 'John Martin - Lagos',
  STEVE_LAGOS = 'Steve - Lagos',
  MRS_OIL_GAS_BANER = 'MRS Oil Gas - Baner',
}

@Entity('order')
export class OrderEntity {
  @PrimaryGeneratedColumn()
  orderId!: number;

  @Column()
  orderCode!: string;

  @Column({ type: 'int', nullable: true })
  sourceQuotationId?: number | null;

  @ManyToOne(() => QuotationEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sourceQuotationId' })
  sourceQuotation?: QuotationEntity | null;

  @Column({ type: 'int', unsigned: true })
  currencyId!: number;

  @ManyToOne(() => CurrencyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currencyId' })
  currency!: CurrencyEntity;

  @Column()
  currencyCode!: string;

  @Column()
  customerId!: number;

  @ManyToOne(() => CustomerEntity, (customer) => customer.orders, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer!: CustomerEntity;

  @Column()
  orderDate!: Date;

  @Column({ type: 'datetime', nullable: true })
  deliveryDate?: Date | null;

  @Column()
  companyId!: number;

  @ManyToOne(() => CompanyEntity, (company) => company.orders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity;

  @Column({ nullable: true })
  remarks?: string;

  @Column({ type: 'varchar', nullable: true })
  termsConditionsFile?: string | null;

  @Column({ nullable: true })
  termsConditionsId?: number | null;

  @ManyToOne(
    () => TermsAndConditionsEntity,
    (terms) => terms.orders,
    { nullable: true, onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'termsConditionsId' })
  termsConditions?: TermsAndConditionsEntity | null;

  @Column({ type: 'text', nullable: true })
  termsConditionsText?: string | null;

  @Column('decimal', { precision: 18, scale: 4 })
  totalAmount!: number;

  @Column('decimal', { precision: 18, scale: 4, nullable: true })
  discount?: number | null;

  @Column('decimal', { precision: 18, scale: 4, nullable: true })
  extraCharge?: number | null;

  @Column('decimal', { precision: 18, scale: 4 })
  taxAmount!: number;

  @Column('decimal', { precision: 18, scale: 4 })
  taxableAmount!: number;

  @Column('decimal', { precision: 18, scale: 4 })
  finalAmount!: number;

  @Column({ type: 'number', nullable: true })
  bankBookId?: number | null;

  @ManyToOne(() => BankBookEntity, (bankBook) => bankBook.orders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'bankBookId' })
  bankBook?: BankBookEntity | null;

  @Column({ type: 'varchar', nullable: true })
  accountNumber?: string | null;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.DRAFT,
  })
  status!: string;

  @Column({
    type: 'enum',
    enum: OrderLifecycleStatus,
    default: OrderLifecycleStatus.OPEN,
  })
  orderStatus!: string;

  @Column({ type: 'number', nullable: true })
  salesPersonId?: number | null;

  @ManyToOne(() => UserEntity, (user) => user.ordersAsSalesPerson, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'salesPersonId' })
  salesPerson?: UserEntity | null;

  @Column({ type: 'number', nullable: true })
  contactPersonId?: number | null;

  @ManyToOne(() => UserEntity, (user) => user.ordersAsContactPerson, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'contactPersonId' })
  contactPerson?: UserEntity | null;

  @Column('decimal', { precision: 18, scale: 4 })
  currencyConversionRate!: number;

  @Column({
    type: 'enum',
    enum: VatWithheld,
    default: VatWithheld.NO,
  })
  vatWithheld!: string;

  @Column('decimal', { precision: 18, scale: 4, default: 0 })
  vatWithheldAmount!: number;

  @Column({
    type: 'enum',
    enum: BusinessTerms,
  })
  businessTerms!: string;

  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  paymentType!: string;

  @Column({ type: 'varchar', nullable: true })
  deliveryTerms?: string | null;

  @Column({
    type: 'enum',
    enum: DiscountApplicable,
  })
  discountApplicable!: string;

  @Column()
  shippingState!: string;

  @Column()
  billingState!: string;

  @Column()
  deliveryState!: string;

  @Column({
    type: 'enum',
    enum: DeliveryType,
  })
  deliveryType!: string;

  @Column({
    type: 'enum',
    enum: InvoiceGenerationOn,
  })
  invoiceGenerationOn!: string;

  @Column({
    type: 'enum',
    enum: InvoiceAutoApproval,
  })
  invoiceAutoApproval!: string;

  @Column({ type: 'enum', enum: PlaceOfSupply, nullable: true })
  placeOfSupply?: string;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  orderItems?: OrderItemEntity[];

  @OneToMany(() => OrderDiscountEntity, (d) => d.order)
  discounts?: OrderDiscountEntity[];

  @OneToMany(() => OrderExtraChargeEntity, (ec) => ec.order)
  extraCharges?: OrderExtraChargeEntity[];

  @OneToMany(() => OrderAttachmentsEntity, (attachment) => attachment.order)
  attachments?: OrderAttachmentsEntity[];
}
