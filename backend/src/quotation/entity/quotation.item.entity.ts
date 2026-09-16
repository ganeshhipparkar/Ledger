import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ItemEntity } from 'src/item/entity/item.entity';
import { QuotationEntity } from './quotation.entity';
import { QuotationDiscountEntity } from './quotation.discount.entity';
import { QuotationExtraChargeEntity } from './quotation.extra.charge.entity';

export enum TaxCalculation {
  NA = 'NA',
  EXCLUSIVE = 'EXCLUSIVE',
  INCLUSIVE = 'INCLUSIVE',
}

@Entity('quotation_items')
export class QuotationItemEntity {
  @PrimaryGeneratedColumn()
  quotationItemId!: number;

  @Column()
  quotationId!: number;

  @ManyToOne(() => QuotationEntity, (quotation) => quotation.quotationItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quotationId' })
  quotation!: QuotationEntity;

  @Column({ nullable: true })
  itemId?: number;

  @ManyToOne(() => ItemEntity, (item) => item.quotationItems, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'itemId' })
  item?: ItemEntity;

  @Column({ type: 'varchar', nullable: true })
  description?: string | null;

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

  @OneToMany(() => QuotationDiscountEntity, (d) => d.quotationItem)
  discounts?: QuotationDiscountEntity[];

  @OneToMany(() => QuotationExtraChargeEntity, (ec) => ec.quotationItem)
  extraCharges?: QuotationExtraChargeEntity[];
}
