import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ItemCategoryEntity } from '../../item_category/entity/item-category.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { ManufacturerEntity } from 'src/manufacturer/entity/manufacturer.entity';
import { BrandEntity } from 'src/brand_master/entity/brand.entity';
import { UomEntity } from 'src/item_uom/entity/uom.entity';
import { PackageEntity } from 'src/package_master/entity/package.entity';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import { ItemEntity } from 'src/item/entity/item.entity';
import { BankMasterEntity } from 'src/bank_master/entity/bank.master.entity';
import { BankBookEntity } from 'src/bank_book_master/entity/bank.book.entity';
import { TermsAndConditionsEntity } from 'src/terms_conditions/entity/terms.conditions.entity';

@Entity('company')
export class CompanyEntity {
  @PrimaryGeneratedColumn()
  companyId!: number;

  @Column()
  companyName!: string;

  @Column({ unique: true })
  companyCode!: string;

  // @Column()
  // companyLocation!: string;

  @Column({ type: 'varchar', nullable: true })
  companyFile!: string | null;

  @Column({ unique: true })
  email!: string;

  @Column()
  website!: string;

  @Column()
  dialCode!: number;

  @Column()
  phone!: string;

  @Column()
  country!: string;

  @Column()
  state!: string;

  @Column()
  status!: string;

  @Column()
  AddressLineOne!: string;

  @Column()
  ownerName!: string;

  @Column()
  ownerEmail!: string;

  @Column()
  ownerPhone!: string;

  @Column({ nullable: true })
  ownerDialCode!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedDate!: Date;

  @Column({ nullable: true })
  addedBy!: number;

  @Column({ nullable: true })
  updatedBy!: number;

  @Column({ nullable: true })
  city!: string;

  @Column({ nullable: true })
  postalCode!: number;

  @Column({ nullable: true })
  parentCompanyId!: number | null;

  @ManyToOne(() => CompanyEntity, (company) => company.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentCompanyId' })
  parentCompany!: CompanyEntity | null;

  @OneToMany(() => CompanyEntity, (company) => company.parentCompany)
  children!: CompanyEntity[];

  @OneToMany(() => UserCompanyGroupEntity, (ucg) => ucg.company)
  userCompanyGroups!: UserCompanyGroupEntity[];

  @OneToMany(() => ItemCategoryEntity, (itemCategory) => itemCategory.company)
  itemCategories!: ItemCategoryEntity[];

  @OneToMany(()=>ManufacturerEntity,(manufacturer)=>manufacturer.company)
  manufacturers!:ManufacturerEntity[];

  @OneToMany(()=>BrandEntity,(brand)=>brand.company)
  brands!:BrandEntity[];

  @OneToMany(()=>UomEntity,(uom)=>uom.company)
  uoms!:UomEntity[];

  @OneToMany(()=>PackageEntity,(pack)=>pack.company)
  packages!:PackageEntity[];

  @OneToMany(()=>CustomerEntity,(customer)=>customer.company)
  customers?:CustomerEntity[];

  @OneToMany(() => ItemEntity, (item) => item.company)
  items?: ItemEntity[];

  @OneToMany(() => BankMasterEntity, (bank) => bank.company)
  banks?: BankMasterEntity[];

  @OneToMany(()=>BankBookEntity,(bankbook)=>bankbook.company)
  bankBooks?:BankBookEntity[];

  @OneToMany(()=>TermsAndConditionsEntity,(terms)=>terms.company)
  termsConditions?:TermsAndConditionsEntity[];
  
}

