import { CompanyEntity } from "src/company/entity/company.entity";
import { ManufacturerEntity } from "src/manufacturer/entity/manufacturer.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

export enum Status{
    ACTIVE="Active",
    INACTIVE="Inactive"
}

@Entity('brand_master')
export class BrandEntity{

@PrimaryGeneratedColumn()
brandId! :number;

@Column()
brandName! :string;

@Column()
brandCode! :string;

@Column()
companyId!: number;
@ManyToOne(() => CompanyEntity, (company) => company.brands, {
    onDelete: 'CASCADE',
  })
@JoinColumn({ name: 'companyId' })
company!: CompanyEntity;

@Column({nullable:true})
manufacturerId!:number;
@ManyToOne(()=>ManufacturerEntity,(manufacturer)=>manufacturer.brands,{
  onDelete : 'SET NULL',
})
@JoinColumn({name :'manufacturerId'})
manufacturer?:ManufacturerEntity;

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

}