import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserController } from './user.controller';
import { UserService } from './services/user.service';
import { UserListService } from './services/user.list.service';

import { UserEntity } from 'src/user/entity/user.entity';
import { FileTransfer } from 'src/utilities/file.transfer';
import { Filter } from 'src/utilities/filter';
import { Mailer } from 'src/utilities/mailer';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';

import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from 'src/utilities/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { RolesGuard } from 'src/utilities/roles.guard';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { GroupEntity } from 'src/group/entity/group.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      GroupEntity,
      CompanyEntity,
      UserCompanyGroupEntity,
      GroupPermissionEntity,
    ]),

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.register({
      secret: process.env.JWT_SECRET || 'hiddenbrainsinfotechpune',
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],

  controllers: [UserController],
  providers: [
    UserService,
    UserListService,
    FileTransfer,
    Filter,
    Mailer,
    JwtStrategy,
    RolesGuard,
  ],
})
export class UserModule {}
