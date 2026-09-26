import { Controller, Get } from '@nestjs/common';
import { encryptResponse } from '../utilities/crypto';
import { ModSettingsService } from './service/mod.settings.service';

@Controller('mod-setting')
export class ModSettingsController {
  constructor(private readonly modSettingsService: ModSettingsService) {}

  @Get('frontend')
  async getFrontendSettings() {
    const result = await this.modSettingsService.getFrontendSettings();
    return { encrypted: encryptResponse(result) };
  }
}
