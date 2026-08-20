import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyEntity } from "src/company/entity/company.entity";
import { GroupPermissionEntity } from "src/group/entity/capability.entity";
import { UserCompanyGroupEntity } from "src/packages/entity/user.company.group.entity";
import { UserEntity } from "src/user/entity/user.entity";
import { Filter } from "src/utilities/filter";
import { TermsAndConditionsController } from "./terms.conditions.controller";
import { TermsAndConditionsService } from "./terms.conditions.service";
import { TermsAndConditionsEntity } from "./entity/terms.conditions.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      TermsAndConditionsEntity,
      GroupPermissionEntity,
    ]),
  ],
  controllers: [TermsAndConditionsController],
  providers: [TermsAndConditionsService, Filter],
  exports: [TypeOrmModule],
})
export class TermsAndConditionsModule {}