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

@Entity('quotation_extra_charge')
export class QuotationExtraChargeEntity {
  @PrimaryGeneratedColumn()
  extraChargesId!: number;

  @Column({ nullable: true })
  quotationId?: number | null;

  @ManyToOne(() => QuotationEntity, (quotation) => quotation.extraCharges, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quotationId' })
  quotation?: QuotationEntity | null;

  @Column({ nullable: true })
  quotationItemId?: number | null;

  @ManyToOne(
    () => QuotationItemEntity,
    (quotationItem) => quotationItem.extraCharges,
    { nullable: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'quotationItemId' })
  quotationItem?: QuotationItemEntity | null;

  @Column({ nullable: true })
  manufacturerId?: number | null;

  @ManyToOne(
    () => ManufacturerEntity,
    (manufacturer) => manufacturer.quotationExtraCharges,
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
