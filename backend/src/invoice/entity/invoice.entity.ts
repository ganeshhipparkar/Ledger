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
import { OrderEntity } from 'src/order/entity/order.entity';
import { QuotationEntity } from 'src/quotation/entity/quotation.entity';
import { InvoiceItemEntity } from './invoice.item.entity';
import { InvoiceDiscountEntity } from './invoice.discount.entity';
import { InvoiceExtraChargeEntity } from './invoice.extra.charge.entity';
import { InvoiceAttachmentsEntity } from './invoice.attachments';
import { InvoiceDueDateHistoryEntity } from './invoice.due.date.history.entity';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
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

export enum InvoiceFor {
  ORDER = 'ORDER',
  QUOTATION = 'QUOTATION',
}

@Entity('invoice')
export class InvoiceEntity {
  @PrimaryGeneratedColumn()
  invoiceId!: number;

  @Column()
  invoiceCode!: string;

  @Column({ type: 'int', unsigned: true })
  currencyId!: number;

  @ManyToOne(() => CurrencyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currencyId' })
  currency!: CurrencyEntity;

  @Column()
  currencyCode!: string;

  @Column()
  customerId!: number;

  @ManyToOne(() => CustomerEntity, (customer) => customer.invoices, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer!: CustomerEntity;

  @Column()
  invoiceDate!: Date;

  @Column()
  deliveryDate!: Date;

  @Column()
  companyId!: number;

  @ManyToOne(() => CompanyEntity, (company) => company.invoices, {
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
    (terms) => terms.invoices,
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

  @Column({ type: 'int', nullable: true })
  bankBookId?: number | null;

  @ManyToOne(() => BankBookEntity, (bankBook) => bankBook.invoices, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'bankBookId' })
  bankBook?: BankBookEntity | null;

  @Column({ type: 'varchar', nullable: true })
  accountNumber?: string | null;

  @Column({ type: 'varchar', nullable: true })
  invoicePdfPath?: string | null;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status!: string;

  @Column({ type: 'int', nullable: true })
  salesPersonId?: number | null;

  @ManyToOne(() => UserEntity, (user) => user.invoicesAsSalesPerson, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'salesPersonId' })
  salesPerson?: UserEntity | null;

  @Column({ type: 'int', nullable: true })
  contactPersonId?: number | null;

  @ManyToOne(() => UserEntity, (user) => user.invoicesAsContactPerson, {
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

  @Column({ type: 'enum', enum: InvoiceFor, nullable: true })
  invoiceFor?: string | null;

  @Column({ type: 'int', nullable: true })
  sourceOrderId?: number | null;

  @ManyToOne(() => OrderEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sourceOrderId' })
  sourceOrder?: OrderEntity | null;

  @Column({ type: 'int', nullable: true })
  sourceQuotationId?: number | null;

  @ManyToOne(() => QuotationEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sourceQuotationId' })
  sourceQuotation?: QuotationEntity | null;

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

  @OneToMany(() => InvoiceItemEntity, (item) => item.invoice)
  invoiceItems?: InvoiceItemEntity[];

  @OneToMany(() => InvoiceDiscountEntity, (d) => d.invoice)
  discounts?: InvoiceDiscountEntity[];

  @OneToMany(() => InvoiceExtraChargeEntity, (ec) => ec.invoice)
  extraCharges?: InvoiceExtraChargeEntity[];

  @OneToMany(() => InvoiceAttachmentsEntity, (att) => att.invoice)
  attachments?: InvoiceAttachmentsEntity[];

  @OneToMany(() => InvoiceDueDateHistoryEntity, (h) => h.invoice)
  dueDateHistory?: InvoiceDueDateHistoryEntity[];
}
