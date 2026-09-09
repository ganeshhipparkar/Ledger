import { BrandEntity } from "src/brand_master/entity/brand.entity";
import { CompanyEntity } from "src/company/entity/company.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { QuotationDiscountEntity } from 'src/quotation/entity/quotation.discount.entity';
import { QuotationExtraChargeEntity } from 'src/quotation/entity/quotation.extra.charge.entity';
import { OrderDiscountEntity } from 'src/order/entity/order.discount.entity';
import { OrderExtraChargeEntity } from 'src/order/entity/order.extra.charge.entity';

export enum Status{
    ACTIVE="Active",
    INACTIVE="Inactive"
}

@Entity('manufacturer')
export class ManufacturerEntity{

@PrimaryGeneratedColumn()
manufacturerId! :number;

@Column()
manufacturerName! :string;

@Column()
manufacturerCode! :string;

@Column()
companyId!: number;
@ManyToOne(() => CompanyEntity, (company) => company.manufacturers, {
    onDelete: 'CASCADE',
  })
@JoinColumn({ name: 'companyId' })
company!: CompanyEntity;

@OneToMany(()=>BrandEntity,(brand)=>brand.manufacturer)
brands? :BrandEntity[];

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

@OneToMany(() => QuotationDiscountEntity, (d) => d.manufacturer)
quotationDiscounts?: QuotationDiscountEntity[];

@OneToMany(() => QuotationExtraChargeEntity, (ec) => ec.manufacturer)
quotationExtraCharges?: QuotationExtraChargeEntity[];

@OneToMany(() => OrderDiscountEntity, (d) => d.manufacturer)
orderDiscounts?: OrderDiscountEntity[];

@OneToMany(() => OrderExtraChargeEntity, (ec) => ec.manufacturer)
orderExtraCharges?: OrderExtraChargeEntity[];

}