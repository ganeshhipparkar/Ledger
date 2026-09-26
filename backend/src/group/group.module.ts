import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GroupController } from './group.controller';
import { GroupService } from './service/group.service';
import { FileTransfer } from 'src/utilities/file.transfer';
import { Filter } from 'src/utilities/filter';
import { Mailer } from 'src/utilities/mailer';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import {
  PermissionEntity,
  GroupPermissionEntity,
} from 'src/group/entity/capability.entity';
import { GroupEntity } from './entity/group.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GroupEntity,
      UserCompanyGroupEntity,
      PermissionEntity,
      GroupPermissionEntity,
    ]),
  ],
  controllers: [GroupController],
  providers: [GroupService, Filter, Mailer, FileTransfer],
  exports: [TypeOrmModule],
})
export class GroupModule {}
