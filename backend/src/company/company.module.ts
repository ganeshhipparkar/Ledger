import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyController } from './company.controller';
import { CompanyService } from './service/company.service';

import { FileTransfer } from 'src/utilities/file.transfer';
import { Filter } from 'src/utilities/filter';
import { Mailer } from 'src/utilities/mailer';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { CompanyCurrencyEntity } from 'src/packages/entity/company.currency.entity';
import { CompanyEntity } from './entity/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      UserCompanyGroupEntity,
      GroupPermissionEntity,
      CurrencyEntity,
      CompanyCurrencyEntity,
    ]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService, Filter, Mailer, FileTransfer],
})
export class CompanyModule {}
