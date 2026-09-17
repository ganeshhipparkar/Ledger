import { CompanyEntity } from "src/company/entity/company.entity";
import { ItemCategoryEntity } from "src/item_category/entity/item-category.entity";
import { ManufacturerEntity } from "src/manufacturer/entity/manufacturer.entity";
import { BrandEntity } from "src/brand_master/entity/brand.entity";
import { UomEntity } from "src/item_uom/entity/uom.entity";
import { PackageEntity } from "src/package_master/entity/package.entity";
import { CurrencyEntity } from "src/currency/entity/currency.entity";
import { ItemImageEntity } from "./item.image.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { QuotationItemEntity } from 'src/quotation/entity/quotation.item.entity';
import { OrderItemEntity } from 'src/order/entity/order.item.entity';
import { InvoiceItemEntity } from 'src/invoice/entity/invoice.item.entity';

export enum Archive {
    TRUE = 'true',
    FALSE = 'false',
}

export enum ShelfLife {
    TRUE = 'true',
    FALSE = 'false',
}

export enum Status {
    ACTIVE = "Active",
    INACTIVE = "Inactive"
}

export enum ShelfLifeUnit {
    MINUTE = "minute",
    HOUR = "hour",
    DAY = "day",
    MONTH = "month",
    YEAR = "year",
}

export enum IsDecimalAllowed {
    TRUE = 'true',
    FALSE = 'false',
}

@Entity('item_master')
export class ItemEntity {
    @PrimaryGeneratedColumn()
    itemId!: number;

    @Column()
    itemName!: string;

    @Column()
    itemCode!: string;

    @Column({ nullable: true })
    shortName?: string;

    @Column({ nullable: true })
    barcode?: string;

    @Column('decimal', { precision: 10, scale: 2 })
    primitiveQuantity!: number;

    @Column()
    companyId!: number;

    @ManyToOne(() => CompanyEntity, (company) => company.items, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'companyId' })
    company!: CompanyEntity;

    @Column()
    categoryId!: number;

    @ManyToOne(() => ItemCategoryEntity, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'categoryId' })
    category?: ItemCategoryEntity;

    @Column()
    manufacturerId!: number;

    @ManyToOne(() => ManufacturerEntity, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'manufacturerId' })
    manufacturer?: ManufacturerEntity;

    @Column()
    brandId!: number;

    @ManyToOne(() => BrandEntity, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'brandId' })
    brand?: BrandEntity;

    @Column()
    itemUom!: number;

    @ManyToOne(() => UomEntity, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'itemUom' })
    itemUomRel?: UomEntity;

    @Column({ nullable: true })
    packageUom?: number;

    @ManyToOne(() => PackageEntity, { onDelete: 'RESTRICT', nullable: true })
    @JoinColumn({ name: 'packageUom' })
    packageRel?: PackageEntity;

    @Column('decimal', { precision: 10, scale: 2 })
    purchasePrice!: number;

    @Column('decimal', { precision: 10, scale: 2 })
    costPerUnit!: number;

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    convertedPurchasePrice?: number;

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    convertedCostPerUnit?: number;

    @Column({
        type: "enum",
        enum: IsDecimalAllowed,
        default: IsDecimalAllowed.FALSE,
    })
    isDecimalAllowed!: string;

    @Column({ nullable: true })
    remarks?: string;

    @Column({ type: 'int', unsigned: true })
    sourceCurrencyId!: number;

    @ManyToOne(() => CurrencyEntity, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'sourceCurrencyId' })
    currency?: CurrencyEntity;

    @Column('decimal', { precision: 10, scale: 4 })
    conversionRate!: number;

    @Column({
        type: "enum",
        enum: ShelfLife,
        default: ShelfLife.FALSE,
    })
    checkShelfLife!: string;

    @Column({
        nullable: true,
        type: "enum",
        enum: ShelfLifeUnit,
        default: ShelfLifeUnit.MONTH,
    })
    shelfLifeUnit?: string;

    @Column({ nullable: true })
    shelfLifeSpan?: number;

    @Column({
        type: "enum",
        enum: Archive,
        default: Archive.FALSE,
    })
    archive!: string;

    @Column({
        type: "enum",
        enum: Status,
        default: Status.ACTIVE,
    })
    status!: string;

    @Column({ nullable: true })
    addedBy?: number;

    @Column({ nullable: true })
    addedDate?: Date;

    @Column({ nullable: true })
    updatedBy?: number;

    @Column({ nullable: true })
    updatedDate?: Date;

    @OneToMany(() => ItemImageEntity, (img) => img.item)
    images?: ItemImageEntity[];

    @OneToMany(() => QuotationItemEntity, (qi) => qi.item)
    quotationItems?: QuotationItemEntity[];

    @OneToMany(() => OrderItemEntity, (oi) => oi.item)
    orderItems?: OrderItemEntity[];

    @OneToMany(() => InvoiceItemEntity, (ii) => ii.item)
    invoiceItems?: InvoiceItemEntity[];
}