import { CompanyEntity } from "src/company/entity/company.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity('terms_conditions')
export class TermsAndConditionsEntity{
    @PrimaryGeneratedColumn()
    termsConditionsId!:number;

    @Column()
    title!:string;

    @Column()
    code!:string;

    @Column({ type: 'varchar', length: 500 })
    content!:string;

    @Column()
    companyId!:number;

    @ManyToOne(() => CompanyEntity, (company) => company.termsConditions, {
        onDelete: 'CASCADE',
      })
    @JoinColumn({ name: 'companyId' })
    company!: CompanyEntity;
    

}




