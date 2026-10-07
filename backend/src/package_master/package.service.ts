import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityCode } from '../activity/enums/activity-code.enum';
import { Filter } from 'src/utilities/filter';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { PackageEntity } from './entity/package.entity';
import { PackageDto, PackageListDto, PackageUpdateDto } from './dto/package.dto';

@Injectable()
export class PackageService {
  constructor(
    @InjectRepository(PackageEntity)
    private readonly packageEntity: Repository<PackageEntity>,
    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;

  async insertPackage(params: PackageDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add package to another company',
          };
        }
      }

      const packageCode = await this.codeGeneratorService.generateCode(
        this.packageEntity,
        params.packageName,
        params.companyId,
        'packageCode',
      );

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      const queryParams: any = {
        packageCode,
        packageName: params.packageName,
        companyId: Number(params.companyId),
        status: params.status,
      };
      if (params.description !== undefined)
        queryParams.description = params.description;
      if (performerId) queryParams.addedBy = Number(performerId);
      queryParams.addedDate = new Date();

      const result = await this.packageEntity.insert(queryParams);
      const insertId = result?.raw?.insertId;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.PACKAGE_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'PACKAGE',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',  
          packageCode,
          packageName: params.packageName,
          companyId: params.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Package inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updatePackage(params: PackageUpdateDto, req?: any) {
    if (!params.packageId) {
      return { success: 0, message: 'packageId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existingPkg = await this.packageEntity.findOne({
        where: { packageId: Number(params.packageId) },
      });
      if (!existingPkg) {
        return { success: 0, message: 'Package not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingPkg.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update package of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.packageName !== undefined)
        queryParams.packageName = params.packageName;
      if (params.description !== undefined)
        queryParams.description = params.description;
      if (params.status) queryParams.status = params.status;

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      await this.packageEntity.update(
        { packageId: Number(params.packageId) },
        queryParams,
      );

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.PACKAGE_UPDATE,
        userId: performerId,
        companyId: existingPkg.companyId,
        actorType: 'USER',
        targetType: 'PACKAGE',
        targetId: String(params.packageId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          packageCode: existingPkg.packageCode,
          packageName: params.packageName ?? existingPkg.packageName,
          status: params.status ?? existingPkg.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Package updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}