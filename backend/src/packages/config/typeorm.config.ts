import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import 'dotenv/config';
import { UserEntity } from 'src/user/entity/user.entity';
import { UserCompanyGroupEntity } from '../entity/user.company.group.entity';
import {
  PermissionEntity,
  GroupPermissionEntity,
} from '../../group/entity/capability.entity';
import { CurrencyEntity } from '../../currency/entity/currency.entity';
import { CompanyCurrencyEntity } from '../entity/company.currency.entity';
import { ActivityLogEntity } from '../../activity/entity/activity-log.entity';
import { ItemCategoryEntity } from '../../item_category/entity/item-category.entity';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { GroupEntity } from 'src/group/entity/group.entity';
import { ActivityMasterEntity } from 'src/activity/entity/activity-master.entity';
import { ManufacturerEntity } from 'src/manufacturer/entity/manufacturer.entity';
import { BrandEntity } from 'src/brand_master/entity/brand.entity';
import { UomEntity } from 'src/item_uom/entity/uom.entity';
import { PackageEntity } from 'src/package_master/entity/package.entity';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import { CustomerCurrencyEntity } from 'src/customer/entity/customer.currency.entity';
import { ItemEntity } from 'src/item/entity/item.entity';
import { ItemImageEntity } from 'src/item/entity/item.image.entity';
import { BankMasterEntity } from 'src/bank_master/entity/bank.master.entity';
import { BankBookEntity } from 'src/bank_book_master/entity/bank.book.entity';
import { TermsAndConditionsEntity } from 'src/terms_conditions/entity/terms.conditions.entity';
import { QuotationEntity } from 'src/quotation/entity/quotation.entity';
import { QuotationItemEntity } from 'src/quotation/entity/quotation.item.entity';
import { QuotationDiscountEntity } from 'src/quotation/entity/quotation.discount.entity';
import { QuotationExtraChargeEntity } from 'src/quotation/entity/quotation.extra.charge.entity';
import { QuotationAttachmentsEntity } from 'src/quotation/entity/quotation.attachments';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { PaymentTransactionEntity } from 'src/payment_transaction/entity/payment.transaction.entity';
import { PaymentTransactionAttachmentsEntity } from 'src/payment_transaction/entity/payment.transaction.attachments';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: (process.env.DB_CLIENT as 'mysql') ?? 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT) ?? 3306,
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASS ?? 'root',
  database: process.env.DB_NAME ?? 'project',
  entities: [
    UserEntity,
    GroupEntity,
    CompanyEntity,
    UserCompanyGroupEntity,
    PermissionEntity,
    GroupPermissionEntity,
    CurrencyEntity,
    CompanyCurrencyEntity,
    ActivityMasterEntity,
    ActivityLogEntity,
    ItemCategoryEntity,
    ManufacturerEntity,
    BrandEntity,
    UomEntity,
    PackageEntity,
    CustomerEntity,
    CustomerCurrencyEntity,
    ItemEntity,
    ItemImageEntity,
    BankMasterEntity,
    BankBookEntity,
    TermsAndConditionsEntity,
    QuotationEntity,
    QuotationItemEntity,
    QuotationDiscountEntity,
    QuotationExtraChargeEntity,
    QuotationAttachmentsEntity,
    taxGroupEntity,
    PaymentTransactionEntity,
    PaymentTransactionAttachmentsEntity,
  ],
  synchronize: false, 
  migrationsRun: true,
  logging: false,
  migrations: [__dirname + '/../../migration/*{.ts,.js}'],
};

