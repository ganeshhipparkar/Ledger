import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { TaxGroupController } from './tax.group.controller';
import { TaxGroupService } from './tax.group.service';
import { taxGroupEntity } from './entity/tax.group.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      taxGroupEntity,
      GroupPermissionEntity,
    ]),
  ],
  controllers: [TaxGroupController],
  providers: [TaxGroupService, Filter, CodeGeneratorService],
  exports: [TypeOrmModule],
})
export class TaxGroupModule {}