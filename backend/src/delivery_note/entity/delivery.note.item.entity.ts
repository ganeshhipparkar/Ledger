import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DeliveryNoteEntity } from './delivery.note.entity';
import { OrderItemEntity } from 'src/order/entity/order.item.entity';
import { ItemEntity } from 'src/item/entity/item.entity';

@Entity('delivery_note_items')
export class DeliveryNoteItemEntity {
  @PrimaryGeneratedColumn()
  deliveryNoteItemId!: number;

  @Column()
  deliveryNoteId!: number;

  @ManyToOne(() => DeliveryNoteEntity, (dn) => dn.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'deliveryNoteId' })
  deliveryNote!: DeliveryNoteEntity;

  @Column()
  orderItemId!: number;

  @ManyToOne(() => OrderItemEntity, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'orderItemId' })
  orderItem!: OrderItemEntity;

  @Column({ nullable: true })
  itemId?: number;

  @ManyToOne(() => ItemEntity, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'itemId' })
  item?: ItemEntity;

  @Column('decimal', { precision: 18, scale: 4 })
  requestedQuantity!: number;

  @Column('decimal', { precision: 18, scale: 4 })
  pendingQuantity!: number;

  @Column('decimal', { precision: 18, scale: 4 })
  deliverQuantity!: number;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;
}
