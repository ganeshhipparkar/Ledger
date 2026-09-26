import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { CompanyEntity } from 'src/company/entity/company.entity';

@Entity('customer_currency_vault')
@Unique('uq_vault', ['customerId', 'currencyId', 'companyId'])
export class CustomerCurrencyVaultEntity {
  @PrimaryGeneratedColumn()
  vaultId!: number;

  @Column()
  customerId!: number;

  @ManyToOne(() => CustomerEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer!: CustomerEntity;

  @Column({ type: 'int', unsigned: true })
  currencyId!: number;

  @ManyToOne(() => CurrencyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'currencyId' })
  currency!: CurrencyEntity;

  @Column()
  companyId!: number;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: CompanyEntity;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalAmount!: number;

  @Column({ type: 'enum', enum: ['Active', 'Inactive'], default: 'Active' })
  status!: string;

  @Column({ nullable: true })
  addedDate?: Date;

  @Column({ nullable: true })
  updatedDate?: Date;
}
