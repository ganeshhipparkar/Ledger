import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { QuotationEntity } from "./quotation.entity";

@Entity('Quotation attachments')
export class QuotationAttachmentsEntity{
    @PrimaryGeneratedColumn()
    quotationAttachmentId!:number;

    @Column()
    quotationId!:number;

    @Column()
    attachmentUrl!:string;

    @Column({nullable:true})
    addedBy?:number;

    @Column({nullable:true})
    addedDate?:Date;

    @Column({nullable:true})
    updatedBy?:number;

    @Column({nullable:true})
    updatedDate?:Date;

    @ManyToOne(()=>QuotationEntity,(quotation)=>quotation.attachments,{
        onDelete:"CASCADE",
    })
    @JoinColumn({name:'quotationId'})
    quotation!:QuotationEntity;

}