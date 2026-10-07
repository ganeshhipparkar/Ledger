import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityCode } from '../activity/enums/activity-code.enum';
import { taxGroupEntity } from './entity/tax.group.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import {
  taxGroupListDto,
  taxGroupAddDto,
  taxGroupUpdateDto,
} from './dto/tax.group.dto';

@Injectable()
export class TaxGroupService {
  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;

  @InjectRepository(taxGroupEntity)
  private readonly taxGroupRepository!: Repository<taxGroupEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  @Inject(EventEmitter2)
  private readonly eventEmitter!: EventEmitter2;

  async insertTaxGroup(params: taxGroupAddDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add tax group to another company',
          };
        }
      }

      const taxCode = await this.codeGeneratorService.generateCode(
        this.taxGroupRepository,
        params.taxName,
        params.companyId,
        'taxCode',
      );

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? params.addedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      const queryParams: any = {
        taxName: params.taxName,
        taxCode,
        taxValue: Number(params.taxValue),
        companyId: Number(params.companyId),
      };
      if (performerId) queryParams.addedBy = Number(performerId);
      queryParams.addedDate = new Date();

      const result = await this.taxGroupRepository.insert(queryParams);
      const insertId = result?.raw?.insertId;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.TAX_GROUP_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'TAX_GROUP',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          taxName: params.taxName,
          taxCode,
          taxValue: params.taxValue,
          companyId: params.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Tax group inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateTaxGroup(params: taxGroupUpdateDto, req?: any) {
    if (!params.taxId) {
      return { success: 0, message: 'taxId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existingTaxGroup = await this.taxGroupRepository.findOne({
        where: { taxId: Number(params.taxId) },
      });
      if (!existingTaxGroup) {
        return { success: 0, message: 'Tax group not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingTaxGroup.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update tax group of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.taxName !== undefined) queryParams.taxName = params.taxName;
      if (params.taxValue !== undefined)
        queryParams.taxValue = Number(params.taxValue);

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.updatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      await this.taxGroupRepository.update(
        { taxId: Number(params.taxId) },
        queryParams,
      );

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.TAX_GROUP_UPDATE,
        userId: performerId,
        companyId: existingTaxGroup.companyId,
        actorType: 'USER',
        targetType: 'TAX_GROUP',
        targetId: String(params.taxId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          taxCode: existingTaxGroup.taxCode,
          taxValue: params.taxValue ?? existingTaxGroup.taxValue,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Tax group updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async taxGroupUpdate(params: taxGroupUpdateDto, req?: any) {
    return this.updateTaxGroup(params, req);
  }
}