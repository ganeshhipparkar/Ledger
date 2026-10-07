import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DebitNoteEntity } from './debit.note.entity';
import { InvoiceEntity } from 'src/invoice/entity/invoice.entity';

@Entity('debit_note_attachments')
export class DebitNoteAttachmentsEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  debitNoteId!: number;

  @ManyToOne(() => DebitNoteEntity, (cn) => cn.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'debitNoteId' })
  debitNote!: DebitNoteEntity;

  @Column({ nullable: true })
  invoiceId?: number | null;

  @ManyToOne(() => InvoiceEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoiceId' })
  invoice?: InvoiceEntity | null;

  @Column({ type: 'varchar' })
  attachmentUrl!: string;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({
    type: 'enum',
    enum: ['Active', 'Inactive'],
    default: 'Active',
  })
  status!: 'Active' | 'Inactive';
}
