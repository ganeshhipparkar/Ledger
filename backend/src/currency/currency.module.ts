import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { CompanyCurrencyEntity } from 'src/packages/entity/company.currency.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CurrencyEntity,
      CompanyCurrencyEntity,
      UserCompanyGroupEntity,
      GroupPermissionEntity,
      UserEntity,
    ]),
  ],
  controllers: [CurrencyController],
  providers: [CurrencyService, Filter],
  exports: [CurrencyService],
})
export class CurrencyModule {}
