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
import { InvoiceEntity } from 'src/invoice/entity/invoice.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { TaxCalculation } from 'src/invoice/entity/invoice.item.entity';
import { CreditNoteAttachmentsEntity } from './credit.note.attachments.entity';

export enum CustomerCharges {
  INVOICE_CHARGES = 'INVOICE_CHARGES',
  GLOBAL_CUSTOMER_CHARGES = 'GLOBAL_CUSTOMER_CHARGES',
  DEMO_TEST_CHARGES = 'DEMO_TEST_CHARGES',
}

export enum CreditNoteStatus {
  SUBMITTED = 'SUBMITTED',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
}

@Entity('credit_note')
export class CreditNoteEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  creditNoteCode!: string;

  @Column()
  companyId!: number;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity;

  @Column()
  customerId!: number;

  @ManyToOne(() => CustomerEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer!: CustomerEntity;

  @Column({ type: 'int', unsigned: true })
  currencyId!: number;

  @ManyToOne(() => CurrencyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currencyId' })
  currency!: CurrencyEntity;

  @Column()
  invoiceId!: number;

  @ManyToOne(() => InvoiceEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: InvoiceEntity;

  @Column({ type: 'enum', enum: CustomerCharges })
  customerCharges!: string;

  @Column({ type: 'varchar', nullable: true })
  narration?: string | null;

  @Column({ type: 'enum', enum: TaxCalculation, default: TaxCalculation.NA })
  taxCalculation!: string;

  @Column({ type: 'int', nullable: true })
  taxGroupId?: number | null;

  @ManyToOne(() => taxGroupEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'taxGroupId' })
  taxGroup?: taxGroupEntity | null;

  @Column('decimal', { precision: 18, scale: 4 })
  totalAmount!: number;

  @Column('decimal', { precision: 18, scale: 4, default: 0 })
  taxAmount!: number;

  @Column('decimal', { precision: 18, scale: 4 })
  finalAmount!: number;

  @Column({ type: 'enum', enum: CreditNoteStatus, default: CreditNoteStatus.SUBMITTED })
  status!: string;

  @Column({ type: 'enum', enum: ApprovalStatus, nullable: true })
  approvalStatus?: string | null;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;

  @OneToMany(() => CreditNoteAttachmentsEntity, (att) => att.creditNote)
  attachments?: CreditNoteAttachmentsEntity[];
}
