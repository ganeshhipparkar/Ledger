import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyEntity } from "src/company/entity/company.entity";
import { GroupPermissionEntity } from "src/group/entity/capability.entity";
import { UserCompanyGroupEntity } from "src/packages/entity/user.company.group.entity";
import { UserEntity } from "src/user/entity/user.entity";
import { Filter } from "src/utilities/filter";
import { CodeGeneratorService } from "src/utilities/code-generator.service";
import { UomController } from "./uom.controller";
import { UomService } from "./uom.service";
import { UomEntity } from "./entity/uom.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      UomEntity,
      UserCompanyGroupEntity,
      UserEntity,
      GroupPermissionEntity,
    ]),
  ],
  controllers: [UomController],
  providers: [UomService, Filter, CodeGeneratorService],
  exports: [TypeOrmModule, UomService],
})
export class UomModule {}