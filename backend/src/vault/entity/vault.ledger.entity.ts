import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CustomerCurrencyVaultEntity } from './customer.currency.vault.entity';
import { PaymentTransactionEntity } from 'src/payment_transaction/entity/payment.transaction.entity';
import { InvoiceEntity } from 'src/invoice/entity/invoice.entity';

@Entity('vault_ledger')
export class VaultLedgerEntity {
  @PrimaryGeneratedColumn()
  vaultLedgerId!: number;

  @Column()
  vaultId!: number;

  @ManyToOne(() => CustomerCurrencyVaultEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vaultId' })
  vault!: CustomerCurrencyVaultEntity;

  @Column({ type: 'enum', enum: ['CREDIT', 'DEBIT'] })
  entryType!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  remainingAmount?: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  beforeAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  afterAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true })
  conversionRate?: number;

  @Column({ nullable: true })
  paymentTransactionId?: number;

  @ManyToOne(() => PaymentTransactionEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'paymentTransactionId' })
  paymentTransaction?: PaymentTransactionEntity;

  @Column({ nullable: true })
  invoiceId?: number;

  @ManyToOne(() => InvoiceEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice?: InvoiceEntity;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  addedDate!: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  deletedAt?: Date;
}
