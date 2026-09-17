import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InvoiceEntity } from './invoice.entity';

@Entity('invoice_attachments')
export class InvoiceAttachmentsEntity {
  @PrimaryGeneratedColumn()
  invoiceAttachmentId!: number;

  @Column()
  invoiceId!: number;

  @Column()
  attachmentUrl!: string;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: InvoiceEntity;
}
