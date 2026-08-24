import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyEntity } from "src/company/entity/company.entity";
import { GroupPermissionEntity } from "src/group/entity/capability.entity";
import { UserCompanyGroupEntity } from "src/packages/entity/user.company.group.entity";
import { UserEntity } from "src/user/entity/user.entity";
import { Filter } from "src/utilities/filter";
import { CodeGeneratorService } from "src/utilities/code-generator.service";
import { ManufacturerContorller } from "./manufacturer.controller";
import { ManufacturerService } from "./manufacturer.service";
import { ManufacturerEntity } from "./entity/manufacturer.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      ManufacturerEntity,
      GroupPermissionEntity,
    ]),
  ],
  controllers: [ManufacturerContorller],
  providers: [ManufacturerService, Filter, CodeGeneratorService],
  exports: [TypeOrmModule],
})
export class ManufacturerModule {}