import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InvoiceEntity } from './invoice.entity';

@Entity('invoice_due_date_history')
export class InvoiceDueDateHistoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  invoiceId!: number;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.dueDateHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: InvoiceEntity;

  @Column({ type: 'date' })
  previousDueDate!: Date;

  @Column({ type: 'date' })
  newDueDate!: Date;

  @Column({ type: 'varchar', nullable: true })
  remarks?: string | null;

  @Column()
  changedBy!: number;

  @Column()
  changedAt!: Date;
}
