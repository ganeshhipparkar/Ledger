import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemCategoryController } from './item.category.controller';
import { ItemCategoryService } from './item.category.service';
import { ItemCategoryEntity } from 'src/item_category/entity/item-category.entity';
import { UserCompanyGroupEntity } from '../packages/entity/user.company.group.entity';
import { UserEntity } from '../user/entity/user.entity';
import { GroupPermissionEntity } from '../group/entity/capability.entity';
import { Filter } from 'src/utilities/filter';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { ItemEntity } from 'src/item/entity/item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ItemCategoryEntity,
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      GroupPermissionEntity,
      ItemEntity,
    ]),
  ],
  controllers: [ItemCategoryController],
  providers: [ItemCategoryService, Filter, CodeGeneratorService],
  exports: [TypeOrmModule],
})
export class ItemCategoryModule {}
