import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyEntity } from "src/company/entity/company.entity";
import { GroupPermissionEntity } from "src/group/entity/capability.entity";
import { UserCompanyGroupEntity } from "src/packages/entity/user.company.group.entity";
import { UserEntity } from "src/user/entity/user.entity";
import { Filter } from "src/utilities/filter";
import { BankController } from "./bank.controller";
import { BankMasterService } from "./bank.service";
import { BankMasterEntity } from "./entity/bank.master.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      BankMasterEntity,
      GroupPermissionEntity,
    ]),
  ],
  controllers: [BankController],
  providers: [BankMasterService, Filter],
  exports: [TypeOrmModule],
})
export class BankMasterModule {}
