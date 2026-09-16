import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { FileTransfer } from 'src/utilities/file.transfer';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { BankBookEntity } from 'src/bank_book_master/entity/bank.book.entity';
import { TermsAndConditionsEntity } from 'src/terms_conditions/entity/terms.conditions.entity';
import { ItemEntity } from 'src/item/entity/item.entity';
import { ManufacturerEntity } from 'src/manufacturer/entity/manufacturer.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { QuotationEntity } from './entity/quotation.entity';
import { QuotationItemEntity } from './entity/quotation.item.entity';
import { QuotationDiscountEntity } from './entity/quotation.discount.entity';
import { QuotationExtraChargeEntity } from './entity/quotation.extra.charge.entity';
import { QuotationAttachmentsEntity } from './entity/quotation.attachments';
import { QuotationContorller } from './quotation.controller';
import { QuotationService } from './quotation.service';
import { QuotationPdfService } from './quotation.pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Quotation-owned entities
      QuotationEntity,
      QuotationItemEntity,
      QuotationDiscountEntity,
      QuotationExtraChargeEntity,
      QuotationAttachmentsEntity,
      // Shared entities needed for service lookups / auth
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      GroupPermissionEntity,
      CustomerEntity,
      CurrencyEntity,
      BankBookEntity,
      TermsAndConditionsEntity,
      ItemEntity,
      ManufacturerEntity,
      taxGroupEntity,
    ]),
  ],
  controllers: [QuotationContorller],
  providers: [QuotationService, QuotationPdfService, Filter, FileTransfer, CodeGeneratorService],
  exports: [TypeOrmModule, QuotationService],
})
export class QuotationModule {}