import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import { OrderEntity } from 'src/order/entity/order.entity';
import { DeliveryNoteItemEntity } from './delivery.note.item.entity';
import { DeliveryNoteAttachmentEntity } from './delivery.note.attachments.entity';

@Entity('delivery_note')
export class DeliveryNoteEntity {
  @PrimaryGeneratedColumn()
  deliveryNoteId!: number;

  @Index('idx_delivery_note_code')
  @Column({ type: 'varchar' })
  deliveryNoteCode!: string;

  @Index('idx_delivery_note_company')
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

  @Column()
  orderId!: number;

  @ManyToOne(() => OrderEntity, (order) => order.deliveryNotes, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'orderId' })
  order!: OrderEntity;

  @Column({ type: 'date' })
  deliveryDate!: Date;

  @Column({ type: 'varchar' })
  receiverName!: string;

  @Column({ type: 'text' })
  billingAddress!: string;

  @Column({ type: 'varchar', nullable: true })
  receiverImage?: string | null;

  @Column({ type: 'varchar', nullable: true })
  receiverSignature?: string | null;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @OneToMany(() => DeliveryNoteItemEntity, (item) => item.deliveryNote)
  items?: DeliveryNoteItemEntity[];

  @OneToMany(() => DeliveryNoteAttachmentEntity, (att) => att.deliveryNote)
  attachments?: DeliveryNoteAttachmentEntity[];
}
