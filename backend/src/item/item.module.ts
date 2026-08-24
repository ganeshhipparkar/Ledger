import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ItemEntity } from "./entity/item.entity";
import { ItemImageEntity } from "./entity/item.image.entity";
import { CurrencyEntity } from "src/currency/entity/currency.entity";
import { BrandEntity } from "src/brand_master/entity/brand.entity";
import { CompanyEntity } from "src/company/entity/company.entity";
import { GroupPermissionEntity } from "src/group/entity/capability.entity";
import { ItemCategoryEntity } from "src/item_category/entity/item-category.entity";
import { UomEntity } from "src/item_uom/entity/uom.entity";
import { ManufacturerEntity } from "src/manufacturer/entity/manufacturer.entity";
import { PackageEntity } from "src/package_master/entity/package.entity";
import { UserCompanyGroupEntity } from "src/packages/entity/user.company.group.entity";
import { UserEntity } from "src/user/entity/user.entity";
import { Filter } from "src/utilities/filter";
import { FileTransfer } from "src/utilities/file.transfer";
import { CodeGeneratorService } from "src/utilities/code-generator.service";
import { ItemController } from "./item.controller";
import { ItemService } from "./item.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ItemEntity,
      ItemImageEntity,
      CurrencyEntity,
      ItemCategoryEntity,
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      GroupPermissionEntity,
      BrandEntity,
      ManufacturerEntity,
      UomEntity,
      PackageEntity,
    ]),
  ],
  controllers: [ItemController],
  providers: [ItemService, Filter, FileTransfer, CodeGeneratorService],
  exports: [TypeOrmModule],
})
export class ItemModule {}
