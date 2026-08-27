import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransactionEntity } from './entity/payment.transaction.entity';
import { PaymentTransactionAttachmentsEntity } from './entity/payment.transaction.attachments';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { BankBookEntity } from 'src/bank_book_master/entity/bank.book.entity';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { PaymentTransactionController } from './payment.transaction.controller';
import { PaymentTransactionService } from './payment.transaction.service';
import { Filter } from 'src/utilities/filter';
import { FileTransfer } from 'src/utilities/file.transfer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransactionEntity,
      PaymentTransactionAttachmentsEntity,
      CustomerEntity,
      CurrencyEntity,
      BankBookEntity,
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      GroupPermissionEntity,
    ]),
  ],
  controllers: [PaymentTransactionController],
  providers: [PaymentTransactionService, Filter, FileTransfer],
  exports: [PaymentTransactionService],
})
export class PaymentTransactionModule {}
