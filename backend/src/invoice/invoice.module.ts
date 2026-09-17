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
import { OrderEntity } from 'src/order/entity/order.entity';
import { QuotationEntity } from 'src/quotation/entity/quotation.entity';
import { InvoiceEntity } from './entity/invoice.entity';
import { InvoiceItemEntity } from './entity/invoice.item.entity';
import { InvoiceDiscountEntity } from './entity/invoice.discount.entity';
import { InvoiceExtraChargeEntity } from './entity/invoice.extra.charge.entity';
import { InvoiceAttachmentsEntity } from './entity/invoice.attachments';
import { InvoiceDueDateHistoryEntity } from './entity/invoice.due.date.history.entity';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { InvoicePdfService } from './invoice.pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceEntity,
      InvoiceItemEntity,
      InvoiceDiscountEntity,
      InvoiceExtraChargeEntity,
      InvoiceAttachmentsEntity,
      InvoiceDueDateHistoryEntity,
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
      OrderEntity,
      QuotationEntity,
    ]),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoicePdfService, Filter, FileTransfer, CodeGeneratorService],
  exports: [TypeOrmModule, InvoiceService],
})
export class InvoiceModule {}
