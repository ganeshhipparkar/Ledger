import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { CustomerContorller } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerEntity } from './entity/customer.entity';
import { CustomerCurrencyEntity } from './entity/customer.currency.entity';
import { CompanyCurrencyEntity } from 'src/packages/entity/company.currency.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';

import { FileTransfer } from 'src/utilities/file.transfer';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      GroupPermissionEntity,
      CustomerEntity,
      CustomerCurrencyEntity,
      CompanyCurrencyEntity,
      CurrencyEntity,
    ]),
  ],
  controllers: [CustomerContorller],
  providers: [CustomerService, Filter, FileTransfer, CodeGeneratorService],
  exports: [TypeOrmModule, CustomerService],
})
export class CustomerModule {}