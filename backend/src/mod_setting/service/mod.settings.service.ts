import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModSettings } from '../../user/entity/mod.settings';

@Injectable()
export class ModSettingsService {
  constructor(
    @InjectRepository(ModSettings)
    private modSettingsRepository: Repository<ModSettings>,
  ) {}

  async getFrontendSettings(): Promise<Record<string, string>> {
    const settings = await this.modSettingsRepository.find({
      where: {
        layer: 'FRONTEND',
        status: 'Active',
      },
    });

    return settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  }
}
