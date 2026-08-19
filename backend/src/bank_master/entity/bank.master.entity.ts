import { BankBookEntity } from "src/bank_book_master/entity/bank.book.entity";
import { CompanyEntity } from "src/company/entity/company.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";

export enum Status{
    ACTIVE="Active",
    INACTIVE="Inactive"
}

@Entity('bank_master')
export class BankMasterEntity{
    @PrimaryGeneratedColumn()
    bankId!:number;

    @Column()
    bankName!:string;

    @Column()
    bankCode!:string;

    @Column()
    companyId!:number;

    @ManyToOne(() => CompanyEntity, (company) => company.banks, {
        onDelete: 'CASCADE',
      })
    @JoinColumn({ name: 'companyId' })
    company!: CompanyEntity;    

    @Column({nullable:true})
    remarks?:string;

    @Column({ nullable: true })
    addedBy?: number;

    @Column({ nullable: true })
    addedDate?: Date;

    @Column({ nullable: true })
    updatedBy?: number;

    @Column({ nullable: true })
    updatedDate?: Date;

    @Column({
        type:"enum",
        enum :Status,
        default :Status.ACTIVE,
    })
    status!: string;

    @OneToMany(()=>BankBookEntity,(bankbook)=>bankbook.bank)
    bankBooks?:BankBookEntity[];
    
}
