import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ManufacturerEntity } from 'src/manufacturer/entity/manufacturer.entity';
import { OrderEntity } from './order.entity';
import { OrderItemEntity } from './order.item.entity';

@Entity('order_extra_charge')
export class OrderExtraChargeEntity {
  @PrimaryGeneratedColumn()
  extraChargesId!: number;

  @Column({ nullable: true })
  orderId?: number | null;

  @ManyToOne(() => OrderEntity, (order) => order.extraCharges, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order?: OrderEntity | null;

  @Column({ nullable: true })
  orderItemId?: number | null;

  @ManyToOne(
    () => OrderItemEntity,
    (orderItem) => orderItem.extraCharges,
    { nullable: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'orderItemId' })
  orderItem?: OrderItemEntity | null;

  @Column({ nullable: true })
  manufacturerId?: number | null;

  @ManyToOne(
    () => ManufacturerEntity,
    (manufacturer) => manufacturer.orderExtraCharges,
    { nullable: true, onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'manufacturerId' })
  manufacturer?: ManufacturerEntity | null;

  @Column('decimal', { precision: 18, scale: 4 })
  extraChargesPrice!: number;

  @Column()
  extraChargesDescription!: string;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;
}
