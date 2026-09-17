import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ManufacturerEntity } from 'src/manufacturer/entity/manufacturer.entity';
import { InvoiceEntity } from './invoice.entity';
import { InvoiceItemEntity } from './invoice.item.entity';

@Entity('invoice_extra_charge')
export class InvoiceExtraChargeEntity {
  @PrimaryGeneratedColumn()
  extraChargesId!: number;

  @Column({ nullable: true })
  invoiceId?: number | null;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.extraCharges, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice?: InvoiceEntity | null;

  @Column({ nullable: true })
  invoiceItemId?: number | null;

  @ManyToOne(
    () => InvoiceItemEntity,
    (invoiceItem) => invoiceItem.extraCharges,
    { nullable: true, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'invoiceItemId' })
  invoiceItem?: InvoiceItemEntity | null;

  @Column({ nullable: true })
  manufacturerId?: number | null;

  @ManyToOne(
    () => ManufacturerEntity,
    (manufacturer) => manufacturer.invoiceExtraCharges,
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
