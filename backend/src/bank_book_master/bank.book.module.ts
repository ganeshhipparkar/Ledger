import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BankMasterEntity } from "src/bank_master/entity/bank.master.entity";
import { CompanyEntity } from "src/company/entity/company.entity";
import { CurrencyEntity } from "src/currency/entity/currency.entity";
import { GroupPermissionEntity } from "src/group/entity/capability.entity";
import { UserCompanyGroupEntity } from "src/packages/entity/user.company.group.entity";
import { UserEntity } from "src/user/entity/user.entity";
import { Filter } from "src/utilities/filter";
import { BankBookController } from "./bank.book.controller";
import { BankBookService } from "./bank.book.service";
import { BankBookEntity } from "./entity/bank.book.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      BankMasterEntity,
      CurrencyEntity,
      GroupPermissionEntity,
      BankBookEntity,
    ]),
  ],
  controllers: [BankBookController],
  providers: [BankBookService, Filter],
  exports: [TypeOrmModule, BankBookService],
})
export class BankBookModule {}