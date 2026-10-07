import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DebitNoteEntity } from './debit.note.entity';
import { ItemEntity } from 'src/item/entity/item.entity';
import { TaxCalculation } from 'src/invoice/entity/invoice.item.entity';

export enum DebitNoteLineType {
  INVOICE_ITEM = 'INVOICE_ITEM',
  SERVICE = 'SERVICE',
}

@Entity('debit_note_items')
export class DebitNoteItemEntity {
  @PrimaryGeneratedColumn()
  debitNoteItemId!: number;

  @Column()
  debitNoteId!: number;

  @ManyToOne(() => DebitNoteEntity, (dn) => dn.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debitNoteId' })
  debitNote!: DebitNoteEntity;

  @Column({ type: 'int', nullable: true })
  invoiceItemId?: number | null;

  @Column({ nullable: true })
  itemId?: number | null;

  @ManyToOne(() => ItemEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itemId' })
  item?: ItemEntity | null;

  @Column({ type: 'varchar', nullable: true })
  description?: string | null;

  @Column({
    type: 'enum',
    enum: DebitNoteLineType,
    default: DebitNoteLineType.INVOICE_ITEM,
  })
  lineType!: DebitNoteLineType;

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

  @Column('decimal', { precision: 18, scale: 4, default: 0 })
  taxAmount!: number;

  @Column('decimal', { precision: 18, scale: 4, default: 0 })
  taxableAmount!: number;

  @Column('decimal', { precision: 18, scale: 4, default: 0 })
  finalAmount!: number;

  @Column({ nullable: true })
  addedBy?: number;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedBy?: number;

  @Column({ nullable: true })
  updatedDate?: Date;
}
