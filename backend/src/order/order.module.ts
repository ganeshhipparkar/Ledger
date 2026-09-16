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
import { OrderEntity } from './entity/order.entity';
import { OrderItemEntity } from './entity/order.item.entity';
import { OrderDiscountEntity } from './entity/order.discount.entity';
import { OrderExtraChargeEntity } from './entity/order.extra.charge.entity';
import { OrderAttachmentsEntity } from './entity/order.attachments';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderPdfService } from './order.pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Order-owned entities
      OrderEntity,
      OrderItemEntity,
      OrderDiscountEntity,
      OrderExtraChargeEntity,
      OrderAttachmentsEntity,
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
  controllers: [OrderController],
  providers: [OrderService, Filter, FileTransfer, CodeGeneratorService, OrderPdfService],
  exports: [TypeOrmModule, OrderService],
})
export class OrderModule {}
