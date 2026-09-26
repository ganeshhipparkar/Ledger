import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CreditNoteEntity } from './credit.note.entity';
import { InvoiceEntity } from 'src/invoice/entity/invoice.entity';

@Entity('credit_note_attachments')
export class CreditNoteAttachmentsEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  creditNoteId!: number;

  @ManyToOne(() => CreditNoteEntity, (cn) => cn.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'creditNoteId' })
  creditNote!: CreditNoteEntity;

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
