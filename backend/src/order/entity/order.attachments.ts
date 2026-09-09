import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrderEntity } from './order.entity';

@Entity('order_attachments')
export class OrderAttachmentsEntity {
  @PrimaryGeneratedColumn()
  orderAttachmentId!: number;

  @Column()
  orderId!: number;

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

  @ManyToOne(() => OrderEntity, (order) => order.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order!: OrderEntity;
}
