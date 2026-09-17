import { BankMasterEntity } from "src/bank_master/entity/bank.master.entity";
import { CompanyEntity } from "src/company/entity/company.entity";
import { CurrencyEntity } from "src/currency/entity/currency.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { QuotationEntity } from 'src/quotation/entity/quotation.entity';
import { OrderEntity } from 'src/order/entity/order.entity';
import { InvoiceEntity } from 'src/invoice/entity/invoice.entity';
import { PaymentTransactionEntity } from "src/payment_transaction/entity/payment.transaction.entity";

export enum Status {
  ACTIVE = "Active",
  INACTIVE = "Inactive"
}

@Entity('bank_book_master')
export class BankBookEntity {
  @PrimaryGeneratedColumn()
  bankBookId!: number;

  @Column({ nullable: true })
  bankBookCode?: string;

  @Column()
  bankBookName!: string;

  @Column()
  bankId!: number;

  @ManyToOne(() => BankMasterEntity, (bank) => bank.bankBooks, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'bankId' })
  bank!: BankMasterEntity;

  @Column()
  companyId!: number;

  @ManyToOne(() => CompanyEntity, (company) => company.bankBooks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity;

  @Column({ type: 'int', unsigned: true })
  currencyId!: number;

  @ManyToOne(() => CurrencyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currencyId' })
  currency?: CurrencyEntity;

  @Column()
  beneficiaryName!: string;

  @Column({ nullable: true })
  accountNumber?: string;

  @Column({ nullable: true })
  branchName?: string;

  @Column({ nullable: true })
  remarks?: string;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;

  @Column({
    type: "enum",
    enum: Status,
    default: Status.ACTIVE,
  })
  status!: string;

  @OneToMany(() => QuotationEntity, (quotation) => quotation.bankBook)
  quotations?: QuotationEntity[];

  @OneToMany(() => OrderEntity, (order) => order.bankBook)
  orders?: OrderEntity[];

  @OneToMany(() => InvoiceEntity, (invoice) => invoice.bankBook)
  invoices?: InvoiceEntity[];

  @OneToMany(() => PaymentTransactionEntity, (paymentTransaction) => paymentTransaction.bankBook)
  paymentTransactions?: PaymentTransactionEntity[];
}