import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerCurrencyVaultEntity } from './entity/customer.currency.vault.entity';
import { VaultLedgerEntity } from './entity/vault.ledger.entity';
import { VaultService } from './vault.service';
import { VaultController } from './vault.controller';
import { ModSettingsModule } from 'src/mod_setting/mod.settings.module';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerCurrencyVaultEntity,
      VaultLedgerEntity,
      UserCompanyGroupEntity,
      GroupPermissionEntity,
    ]),
    ModSettingsModule,
  ],
  providers: [VaultService],
  controllers: [VaultController],
  exports: [VaultService],
})
export class VaultModule {}
