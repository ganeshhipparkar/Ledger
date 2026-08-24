import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ManufacturerEntity } from 'src/manufacturer/entity/manufacturer.entity';
import { QuotationEntity } from './quotation.entity';
import { QuotationItemEntity } from './quotation.item.entity';

@Entity('quotation_discount')
export class QuotationDiscountEntity {
  @PrimaryGeneratedColumn()
  discountId!: number;

  @Column({ nullable: true })
  quotationId?: number | null;

  @ManyToOne(() => QuotationEntity, (quotation) => quotation.discounts, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quotationId' })
  quotation?: QuotationEntity | null;

  @Column({ nullable: true })
  quotationItemId?: number | null;

  @ManyToOne(
    () => QuotationItemEntity,
    (quotationItem) => quotationItem.discounts,
    { nullable: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'quotationItemId' })
  quotationItem?: QuotationItemEntity | null;

  @Column({ nullable: true })
  manufacturerId?: number | null;

  @ManyToOne(
    () => ManufacturerEntity,
    (manufacturer) => manufacturer.quotationDiscounts,
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
