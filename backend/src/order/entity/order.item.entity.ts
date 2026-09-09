import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ItemEntity } from 'src/item/entity/item.entity';
import { OrderEntity } from './order.entity';
import { OrderDiscountEntity } from './order.discount.entity';
import { OrderExtraChargeEntity } from './order.extra.charge.entity';

export enum TaxCalculation {
  NA = 'NA',
  EXCLUSIVE = 'EXCLUSIVE',
  INCLUSIVE = 'INCLUSIVE',
}

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn()
  orderItemId!: number;

  @Column()
  orderId!: number;

  @ManyToOne(() => OrderEntity, (order) => order.orderItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order!: OrderEntity;

  @Column()
  itemId!: number;

  @ManyToOne(() => ItemEntity, (item) => item.orderItems, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'itemId' })
  item!: ItemEntity;

  @Column('decimal', { precision: 18, scale: 4 })
  quantity!: number;

  @Column('decimal', { precision: 18, scale: 4 })
  unitPrice!: number;

  @Column('decimal', { precision: 18, scale: 4 })
  totalAmount!: number;

  @Column({
    type: 'enum',
    enum: TaxCalculation,
    default: TaxCalculation.NA,
  })
  taxCalculation!: string;

  @Column({ type: 'varchar', nullable: true })
  taxGroup?: string | null;

  @Column('decimal', { precision: 18, scale: 4 })
  taxAmount!: number;

  @Column('decimal', { precision: 18, scale: 4 })
  taxableAmount!: number;

  @Column('decimal', { precision: 18, scale: 4 })
  finalAmount!: number;

  @Column({ type: 'varchar', nullable: true })
  itemGL?: string | null;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;

  @OneToMany(() => OrderDiscountEntity, (d) => d.orderItem)
  discounts?: OrderDiscountEntity[];

  @OneToMany(() => OrderExtraChargeEntity, (ec) => ec.orderItem)
  extraCharges?: OrderExtraChargeEntity[];
}
