import { CompanyEntity } from "src/company/entity/company.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { QuotationEntity } from 'src/quotation/entity/quotation.entity';
import { OrderEntity } from 'src/order/entity/order.entity';

@Entity('terms_conditions')
export class TermsAndConditionsEntity{
    @PrimaryGeneratedColumn()
    termsConditionsId!:number;

    @Column()
    title!:string;

    @Column()
    code!:string;

    @Column({ type: 'text' })
    content!:string;

    @Column()
    companyId!:number;

    @ManyToOne(() => CompanyEntity, (company) => company.termsConditions, {
        onDelete: 'CASCADE',
      })
    @JoinColumn({ name: 'companyId' })
    company!: CompanyEntity;

    @OneToMany(() => QuotationEntity, (quotation) => quotation.termsConditions)
    quotations?: QuotationEntity[];

    @OneToMany(() => OrderEntity, (order) => order.termsConditions)
    orders?: OrderEntity[];

    
}




