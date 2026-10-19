import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DeliveryNoteEntity } from './delivery.note.entity';

@Entity('delivery_note_attachments')
export class DeliveryNoteAttachmentEntity {
  @PrimaryGeneratedColumn()
  deliveryNoteAttachmentId!: number;

  @Column()
  deliveryNoteId!: number;

  @ManyToOne(() => DeliveryNoteEntity, (dn) => dn.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'deliveryNoteId' })
  deliveryNote!: DeliveryNoteEntity;

  @Column({ type: 'varchar' })
  attachmentUrl!: string;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;
}
