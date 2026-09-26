import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModSettings } from '../user/entity/mod.settings';
import { ModSettingsController } from './mod.settings.controller';
import { ModSettingsService } from './service/mod.settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([ModSettings])],
  controllers: [ModSettingsController],
  providers: [ModSettingsService],
  exports: [TypeOrmModule],
})
export class ModSettingsModule {}
