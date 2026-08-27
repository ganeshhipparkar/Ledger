import { CompanyEntity } from "src/company/entity/company.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { CustomerCurrencyEntity } from "./customer.currency.entity";
import { QuotationEntity } from "src/quotation/entity/quotation.entity";
import { PaymentTransactionEntity } from "src/payment_transaction/entity/payment.transaction.entity";

export enum Status {
    ACTIVE = "Active",
    INACTIVE = "Inactive"
}

@Entity('customer')
export class CustomerEntity {
    @PrimaryGeneratedColumn()
    customerId!: number;

    @Column()
    customerName!: string;

    @Column({ nullable: true })
    customerLogo?: string;

    @Column()
    customerCode!: string;

    @Column()
    customerEmail!: string;

    @Column({ nullable: true })
    customerIncorporationDate?: Date;

    @Column()
    dialCode!: number;

    @Column()
    phone!: string;

    @Column()
    companyId!: number;

    @ManyToOne(() => CompanyEntity, (company) => company.customers, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'companyId' })
    company?: CompanyEntity;

    @Column()
    country!: string;

    @Column()
    state!: string;

    @Column({ nullable: true })
    city?: string;

    @Column({ nullable: true })
    AddressLineOne?: string;

    @Column({ nullable: true })
    postalCode?: number;

    @Column()
    ownerFirstName!: string;

    @Column()
    ownerLastName!: string;

    @Column()
    ownerEmail!: string;

    @Column()
    ownerPhone!: string;

    @Column({ nullable: true })
    ownerDialCode?: number;

    @Column({ nullable: true })
    ownerDob?: Date;

    @Column()
    createdDate!: Date;

    @Column()
    updatedDate!: Date;

    @Column({ nullable: true })
    addedBy?: number;

    @Column({ nullable: true })
    updatedBy?: number;

    @Column({
        type: "enum",
        enum: Status,
        default: Status.ACTIVE,
    })
    status!: string;

    @OneToMany(() => CustomerCurrencyEntity, (customerCurrency) => customerCurrency.customer)
    customerCurrencies?: CustomerCurrencyEntity[];

    @OneToMany(() => QuotationEntity, (quotation) => quotation.customer)
    quotations?: QuotationEntity[];

    @OneToMany(() => PaymentTransactionEntity, (paymentTransaction) => paymentTransaction.customer)
    paymentTransactions?: PaymentTransactionEntity[];
}