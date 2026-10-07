import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityCode } from '../../activity/enums/activity-code.enum';
import { ManufacturerEntity } from '../entity/manufacturer.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import {
  manufacturerListDto,
  ManufacturerDto,
  ManufacturerUpdateDto,
} from '../dto/manufacturer.dto';

@Injectable()
export class ManufacturerService {
  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;

  @InjectRepository(ManufacturerEntity)
  private readonly manufacturerEntity!: Repository<ManufacturerEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  @Inject(EventEmitter2)
  private readonly eventEmitter!: EventEmitter2;

  async insertManufacturer(params: ManufacturerDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add manufacturer to another company',
          };
        }
      }

      const manufacturerCode = await this.codeGeneratorService.generateCode(
        this.manufacturerEntity,
        params.manufacturerName,
        params.companyId,
        'manufacturerCode',
      );

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      const queryParams: any = {
        manufacturerCode,
        manufacturerName: params.manufacturerName,
        companyId: Number(params.companyId),
        status: params.status,
      };
      if (performerId) queryParams.addedBy = Number(performerId);
      queryParams.addedDate = new Date();

      const result = await this.manufacturerEntity.insert(queryParams);
      const insertId = result?.raw?.insertId;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.MANUFACTURER_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'MANUFACTURER',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          manufacturerCode,
          manufacturerName: params.manufacturerName,
          companyId: params.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Manufacturer inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateManufacturer(params: ManufacturerUpdateDto, req?: any) {
    if (!params.manufacturerId) {
      return { success: 0, message: 'manufacturerId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existingManufacturer = await this.manufacturerEntity.findOne({
        where: { manufacturerId: Number(params.manufacturerId) },
      });
      if (!existingManufacturer) {
        return { success: 0, message: 'Manufacturer not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingManufacturer.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update manufacturer of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.manufacturerName !== undefined)
        queryParams.manufacturerName = params.manufacturerName;
      if (params.status) queryParams.status = params.status;

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      await this.manufacturerEntity.update(
        { manufacturerId: Number(params.manufacturerId) },
        queryParams,
      );

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.MANUFACTURER_UPDATE,
        userId: performerId,
        companyId: existingManufacturer.companyId,
        actorType: 'USER',
        targetType: 'MANUFACTURER',
        targetId: String(params.manufacturerId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          manufacturerCode: existingManufacturer.manufacturerCode,
          manufacturerName:
            params.manufacturerName ?? existingManufacturer.manufacturerName,
          status: params.status ?? existingManufacturer.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Manufacturer updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}