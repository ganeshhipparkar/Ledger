import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { PaymentTransactionEntity } from "./payment.transaction.entity";

@Entity('payment_transaction_attachments')
export class PaymentTransactionAttachmentsEntity {
    @PrimaryGeneratedColumn()
    paymentTransactionAttachmentId!: number;

    @Column()
    paymentTransactionId!: number;

    @Column()
    attachmentUrl!: string;

    @Column({ nullable: true })
    addedBy?: number;

    @Column({ nullable: true })
    addedDate?: Date;

    @Column({ nullable: true })
    updatedBy?: number;

    @Column({ nullable: true })
    updatedDate?: Date;

    @ManyToOne(() => PaymentTransactionEntity, (paymentTransaction) => paymentTransaction.attachments, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: 'paymentTransactionId' })
    paymentTransaction!: PaymentTransactionEntity;
}
