import {
  Column,
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
import { QuotationItemEntity } from './quotation.item.entity';
import { QuotationDiscountEntity } from './quotation.discount.entity';
import { QuotationExtraChargeEntity } from './quotation.extra.charge.entity';
import { QuotationAttachmentsEntity } from './quotation.attachments';

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  CLOSED = 'CLOSED',
}

export enum VatWithheld {
  YES = 'YES',
  NO = 'NO',
}

@Entity('quotation')
export class QuotationEntity {
  @PrimaryGeneratedColumn()
  quotationId!: number;

  @Column()
  quotationCode!: string;

  @Column({ nullable: true })
  versionCode?: string;

  @Column({ nullable: true })
  parentQuotationId?: number | null;

  @ManyToOne(() => QuotationEntity, (quotation) => quotation.childQuotations, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentQuotationId' })
  parentQuotation?: QuotationEntity | null;

  @OneToMany(() => QuotationEntity, (quotation) => quotation.parentQuotation)
  childQuotations?: QuotationEntity[];

  @Column({ type: 'int', unsigned: true })
  currencyId!: number;

  @ManyToOne(() => CurrencyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currencyId' })
  currency!: CurrencyEntity;

  @Column()
  currencyCode!: string;

  @Column()
  customerId!: number;

  @ManyToOne(() => CustomerEntity, (customer) => customer.quotations, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer!: CustomerEntity;

  @Column()
  issueDate!: Date;

  @Column()
  expiryDate!: Date;

  @Column()
  companyId!: number;

  @ManyToOne(() => CompanyEntity, (company) => company.quotations, {
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
    (terms) => terms.quotations,
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

  @ManyToOne(() => BankBookEntity, (bankBook) => bankBook.quotations, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'bankBookId' })
  bankBook?: BankBookEntity | null;

  @Column({ type: 'varchar', nullable: true })
  accountNumber?: string | null;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    default: QuotationStatus.DRAFT,
  })
  status!: string;

  @Column({ type: 'number', nullable: true })
  salesPersonId?: number | null;

  @ManyToOne(() => UserEntity, (user) => user.quotationsAsSalesPerson, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'salesPersonId' })
  salesPerson?: UserEntity | null;

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

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;

  @OneToMany(() => QuotationItemEntity, (item) => item.quotation)
  quotationItems?: QuotationItemEntity[];

  @OneToMany(() => QuotationDiscountEntity, (d) => d.quotation)
  discounts?: QuotationDiscountEntity[];

  @OneToMany(() => QuotationExtraChargeEntity, (ec) => ec.quotation)
  extraCharges?: QuotationExtraChargeEntity[];

  @OneToMany(()=>QuotationAttachmentsEntity,(attachment)=>attachment.quotation)
  attachments?:QuotationAttachmentsEntity[];
}