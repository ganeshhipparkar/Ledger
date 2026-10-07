import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CreditNoteEntity } from './credit.note.entity';
import { ItemEntity } from 'src/item/entity/item.entity';
import { TaxCalculation } from 'src/invoice/entity/invoice.item.entity';

export enum CreditNoteLineType {
  INVOICE_ITEM = 'INVOICE_ITEM',
  SERVICE = 'SERVICE',
}

@Entity('credit_note_items')
export class CreditNoteItemEntity {
  @PrimaryGeneratedColumn()
  creditNoteItemId!: number;

  @Column()
  creditNoteId!: number;

  @ManyToOne(() => CreditNoteEntity, (cn) => cn.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creditNoteId' })
  creditNote!: CreditNoteEntity;

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
    enum: CreditNoteLineType,
    default: CreditNoteLineType.INVOICE_ITEM,
  })
  lineType!: CreditNoteLineType;

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
