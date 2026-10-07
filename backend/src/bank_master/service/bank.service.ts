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
import { BankMasterEntity } from '../entity/bank.master.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import {
  bankListDto,
  BankMasterDto,
  BankMasterUpdateDto,
} from '../dto/bank.dto';

@Injectable()
export class BankMasterService {
  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;

  @InjectRepository(BankMasterEntity)
  private readonly bankRepository!: Repository<BankMasterEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  @Inject(EventEmitter2)
  private readonly eventEmitter!: EventEmitter2;

  async insertBank(params: BankMasterDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add bank to another company',
          };
        }
      }

      const bankCode = await this.codeGeneratorService.generateCode(
        this.bankRepository,
        params.bankName,
        params.companyId,
        'bankCode',
      );

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      const queryParams: any = {
        bankCode,
        bankName: params.bankName,
        companyId: Number(params.companyId),
        status: params.status,
      };
      if (params.remarks !== undefined) queryParams.remarks = params.remarks;
      if (performerId) queryParams.addedBy = Number(performerId);
      queryParams.addedDate = new Date();

      const result = await this.bankRepository.insert(queryParams);
      const insertId = result?.raw?.insertId;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.BANK_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'BANK',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          bankCode,
          bankName: params.bankName,
          companyId: params.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Bank inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateBank(params: BankMasterUpdateDto, req?: any) {
    if (!params.bankId) {
      return { success: 0, message: 'bankId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existingBank = await this.bankRepository.findOne({
        where: { bankId: Number(params.bankId) },
      });
      if (!existingBank) {
        return { success: 0, message: 'Bank not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingBank.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update bank of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.bankName !== undefined)
        queryParams.bankName = params.bankName;
      if (params.remarks !== undefined)
        queryParams.remarks = params.remarks;
      if (params.status) queryParams.status = params.status;

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.userId ?? req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.email ?? req?.user?.impersonatorEmail);

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      await this.bankRepository.update(
        { bankId: Number(params.bankId) },
        queryParams,
      );

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.BANK_UPDATE,
        userId: performerId,
        companyId: existingBank.companyId,
        actorType: 'USER',
        targetType: 'BANK',
        targetId: String(params.bankId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          bankCode: existingBank.bankCode,
          bankName: params.bankName ?? existingBank.bankName,
          status: params.status ?? existingBank.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Bank updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}
