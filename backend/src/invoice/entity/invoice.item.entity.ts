import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ItemEntity } from 'src/item/entity/item.entity';
import { InvoiceEntity } from './invoice.entity';
import { InvoiceDiscountEntity } from './invoice.discount.entity';
import { InvoiceExtraChargeEntity } from './invoice.extra.charge.entity';

export enum TaxCalculation {
  NA = 'NA',
  EXCLUSIVE = 'EXCLUSIVE',
  INCLUSIVE = 'INCLUSIVE',
}

export enum ItemGL {
  SALES_REVENUE = 'SALES_REVENUE',
  COST_OF_GOODS_SOLD = 'COST_OF_GOODS_SOLD',
  INVENTORY = 'INVENTORY',
  SERVICE_REVENUE = 'SERVICE_REVENUE',
  FREIGHT_AND_LOGISTICS = 'FREIGHT_AND_LOGISTICS',
  DISCOUNTS_GIVEN = 'DISCOUNTS_GIVEN',
}

@Entity('invoice_items')
export class InvoiceItemEntity {
  @PrimaryGeneratedColumn()
  invoiceItemId!: number;

  @Column()
  invoiceId!: number;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.invoiceItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: InvoiceEntity;

  @Column({ nullable: true })
  itemId?: number;

  @ManyToOne(() => ItemEntity, (item) => item.invoiceItems, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'itemId' })
  item?: ItemEntity;

  @Column({ type: 'varchar', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', nullable: true })
  itemGL?: string | null;

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

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;

  @OneToMany(() => InvoiceDiscountEntity, (d) => d.invoiceItem)
  discounts?: InvoiceDiscountEntity[];

  @OneToMany(() => InvoiceExtraChargeEntity, (ec) => ec.invoiceItem)
  extraCharges?: InvoiceExtraChargeEntity[];
}
