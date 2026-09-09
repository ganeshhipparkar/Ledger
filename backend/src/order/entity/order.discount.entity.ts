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

@Entity('order_discount')
export class OrderDiscountEntity {
  @PrimaryGeneratedColumn()
  discountId!: number;

  @Column({ nullable: true })
  orderId?: number | null;

  @ManyToOne(() => OrderEntity, (order) => order.discounts, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order?: OrderEntity | null;

  @Column({ nullable: true })
  orderItemId?: number | null;

  @ManyToOne(
    () => OrderItemEntity,
    (orderItem) => orderItem.discounts,
    { nullable: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'orderItemId' })
  orderItem?: OrderItemEntity | null;

  @Column({ nullable: true })
  manufacturerId?: number | null;

  @ManyToOne(
    () => ManufacturerEntity,
    (manufacturer) => manufacturer.orderDiscounts,
    { nullable: true, onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'manufacturerId' })
  manufacturer?: ManufacturerEntity | null;

  @Column('decimal', { precision: 18, scale: 4 })
  discountPrice!: number;

  @Column()
  discountDescription!: string;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;
}
