import { Module } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './packages/config/typeorm.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GroupModule } from './group/group.module';
import { CompanyModule } from './company/company.module';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UserModule } from './user/user.module';
import { CurrencyModule } from './currency/currency.module';
import { ItemCategoryModule } from './item_category/item.category.module';
import { ManufacturerModule } from './manufacturer/manufacturer.module';
import { BankMasterModule } from './bank_master/bank.module';
import { BankBookModule } from './bank_book_master/bank.book.module';
import { BrandModule } from './brand_master/brand.module';
import { UomModule } from './item_uom/uom.module';
import { PackageModule } from './package_master/package.module';
import { CustomerModule } from './customer/customer.module';
import { ItemModule } from './item/item.module';
import { PermissionEntity } from './group/entity/capability.entity';
import { ActivityMasterEntity } from './activity/entity/activity-master.entity';
import { ItemEntity } from './item/entity/item.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig),
    TypeOrmModule.forFeature([PermissionEntity, ActivityMasterEntity]),
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'upload'),
      serveRoot: '/upload',
    }),
    EventEmitterModule.forRoot(),
    UserModule,
    GroupModule,
    CompanyModule,
    ActivityModule,
    CurrencyModule,
    ItemCategoryModule,
    ManufacturerModule,
    BankMasterModule,
    BankBookModule,
    BrandModule,
    UomModule,
    PackageModule,
    CustomerModule,
    ItemModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
