import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyEntity } from "src/company/entity/company.entity";
import { GroupPermissionEntity } from "src/group/entity/capability.entity";
import { UserCompanyGroupEntity } from "src/packages/entity/user.company.group.entity";
import { UserEntity } from "src/user/entity/user.entity";
import { Filter } from "src/utilities/filter";
import { CodeGeneratorService } from "src/utilities/code-generator.service";
import { BrandController } from "./brand.controller";
import { BrandService } from "./brand.service";
import { BrandEntity } from "./entity/brand.entity";
import { ItemEntity } from "src/item/entity/item.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      BrandEntity,
      UserCompanyGroupEntity,
      UserEntity,
      ItemEntity,
      GroupPermissionEntity,
    ]),
  ],
  controllers: [BrandController],
  providers: [BrandService, Filter, CodeGeneratorService],
  exports: [TypeOrmModule, BrandService],
})
export class BrandModule {}