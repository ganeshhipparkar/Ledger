import { CompanyEntity } from "src/company/entity/company.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

export enum layerEnum{
    FRONTEND='FRONTEND',
    BACKEND='BACKEND',
}

export enum Status {
    ACTIVE = "Active",
    INACTIVE = "Inactive"
}

@Entity('mod_setting')
export class ModSettings{

    @PrimaryGeneratedColumn()
    modSettingsId!:number;

    @Column({nullable:true})
    companyId?:number;

    @Column({
        type:'enum',
        enum:layerEnum
    })
    layer!:string; 

    @Column()
    key!:string;

    @Column()
    value!:string;
    
    @Column({nullable:true})
    addedDate?:Date;

    @Column({nullable:true})
    updatedDate?:Date;

    @Column({
        type: "enum",
        enum: Status,
        default: Status.ACTIVE,
       })
    status!:string;

    @ManyToOne(() => CompanyEntity, (company) => company.modsettings, {
        onDelete: 'CASCADE',
      })
    @JoinColumn({ name: 'companyId' })
    company!: CompanyEntity;


}