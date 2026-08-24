import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyEntity } from "src/company/entity/company.entity";
import { GroupPermissionEntity } from "src/group/entity/capability.entity";
import { UserCompanyGroupEntity } from "src/packages/entity/user.company.group.entity";
import { UserEntity } from "src/user/entity/user.entity";
import { Filter } from "src/utilities/filter";
import { CodeGeneratorService } from "src/utilities/code-generator.service";
import { PackageContorller } from "./package.controller";
import { PackageService } from "./package.service";
import { PackageEntity } from "./entity/package.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      PackageEntity,
      GroupPermissionEntity,
    ]),
  ],
  controllers: [PackageContorller],
  providers: [PackageService, Filter, CodeGeneratorService],
  exports: [TypeOrmModule],
})
export class PackageModule {}