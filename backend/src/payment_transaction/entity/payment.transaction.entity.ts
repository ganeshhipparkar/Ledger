import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { BankBookEntity } from 'src/bank_book_master/entity/bank.book.entity';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { PaymentTransactionAttachmentsEntity } from './payment.transaction.attachments';

export enum PaymentMode {
  CASH = 'Cash',
  CREDIT_CARD = 'Credit Card',
  DEBIT_CARD = 'Debit Card',
  DIGITAL_WALLET = 'Digital Wallet',
  BANK_TRANSFER = 'Bank Transfer',
  UPI = 'UPI',
  BNPL = 'Buy Now Pay Later',
}

@Entity('payment_transaction')
export class PaymentTransactionEntity {
  @PrimaryGeneratedColumn()
  paymentTransactionId!: number;

  @Column()
  customerId!: number;

  @ManyToOne(() => CustomerEntity, (customer) => customer.paymentTransactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer!: CustomerEntity;

  @Column()
  currencyId!: number;

  @ManyToOne(() => CurrencyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currencyId' })
  currency!: CurrencyEntity;

  @Column()
  bankBookId!: number;

  @ManyToOne(() => BankBookEntity, (bankBook) => bankBook.paymentTransactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'bankBookId' })
  bankBook!: BankBookEntity;

  @Column()
  companyId!: number;

  @ManyToOne(() => CompanyEntity, (company) => company.paymentTransactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity;

  @Column({ type: 'enum', enum: PaymentMode })
  paymentMode!: string;

  @Column({ type: 'date' })
  paymentDate!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  exchangeRate!: number;

  @Column({ type: 'date' })
  exchangeDate!: Date;

  @Column()
  narration!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  transactionAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  baseAmount!: number;

  @Column()
  description!: string;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;

  @OneToMany(
    () => PaymentTransactionAttachmentsEntity,
    (attachment) => attachment.paymentTransaction,
  )
  attachments?: PaymentTransactionAttachmentsEntity[];
}
