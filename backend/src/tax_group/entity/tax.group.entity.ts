import { CompanyEntity } from "src/company/entity/company.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity('tax_group')
export class taxGroupEntity{
    @PrimaryGeneratedColumn()
    taxId!:number;

    @Column()
    taxName!:string;

    @Column()
    taxCode!:string;

    @Column()
    taxValue!:number;

    @Column()
    companyId!:number;

    @ManyToOne(()=>CompanyEntity,(company)=>company.taxGroups,{
        onDelete:'CASCADE',
    })
    @JoinColumn({name:'companyId'})
    company!:CompanyEntity;

    @Column()
    addedBy!:number;

    @Column()
    addedDate!:Date;

    @Column({nullable:true})
    updatedBy?:number;

    @Column({nullable:true})
    updatedDate?:Date;
}
