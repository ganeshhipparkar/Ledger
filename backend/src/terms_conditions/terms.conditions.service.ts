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
import { TermsAndConditionsEntity } from './entity/terms.conditions.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import {
  termsConditionsListDto,
  TermsAndConditionsDto,
  TermsAndConditionsUpdateDto,
} from './dto/terms.conditions.dto';

@Injectable()
export class TermsAndConditionsService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(TermsAndConditionsEntity)
  private readonly termsConditionsRepository!: Repository<TermsAndConditionsEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  @Inject(EventEmitter2)
  private readonly eventEmitter!: EventEmitter2;

  private async generateCode(
    title: string,
    companyId: number,
  ): Promise<string> {
    const prefix = title.trim().replace(/\s/g, '').substring(0, 8).toUpperCase();
    let counter = 1;
    let code: string;
    do {
      code = `${prefix}${String(counter).padStart(3, '0')}`;
      const existing = await this.termsConditionsRepository.findOne({
        where: { code: code, companyId: Number(companyId) },
      });
      if (!existing) break;
      counter++;
    } while (true);
    return code;
  }

  async termsConditionsList(param: termsConditionsListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder =
        this.termsConditionsRepository.createQueryBuilder('terms_conditions');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'terms_conditions.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Terms and conditions fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'terms_conditions',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.termsConditionsRepository,
      )) as [number, number];

      queryBuilder.leftJoinAndSelect('terms_conditions.company', 'company');
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('terms_conditions.title', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => ({
        ...item,
        companyName: item.company?.companyName ?? null,
      }));

      return_data = {
        success: 1,
        message: 'Terms and conditions fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getTermsConditionsDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const termsCondition = await this.termsConditionsRepository.findOne({
      where: { termsConditionsId: id },
      relations: ['company'],
    });
    if (!termsCondition) {
      throw new NotFoundException('Terms and conditions not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(termsCondition.companyId))) {
        throw new ForbiddenException(
          'Access denied: terms and conditions belong to another company',
        );
      }
    }

    return {
      ...termsCondition,
      companyName: termsCondition.company?.companyName ?? null,
    };
  }

  async insertTermsConditions(params: TermsAndConditionsDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add terms and conditions to another company',
          };
        }
      }

      const code = await this.generateCode(
        params.title,
        Number(params.companyId),
      );

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      const queryParams: any = {
        code,
        title: params.title,
        content: params.content,
        companyId: Number(params.companyId),
      };

      const result = await this.termsConditionsRepository.insert(queryParams);
      const insertId = result?.raw?.insertId;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.TERMS_CONDITIONS_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'TERMS_CONDITIONS',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          code,
          title: params.title,
          companyId: params.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Terms and conditions inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateTermsConditions(params: TermsAndConditionsUpdateDto, req?: any) {
    if (!params.termsConditionsId) {
      return { success: 0, message: 'termsConditionsId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existingTc = await this.termsConditionsRepository.findOne({
        where: { termsConditionsId: Number(params.termsConditionsId) },
      });
      if (!existingTc) {
        return { success: 0, message: 'Terms and conditions not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingTc.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update terms and conditions of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.title !== undefined)
        queryParams.title = params.title;
      if (params.content !== undefined)
        queryParams.content = params.content;

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      await this.termsConditionsRepository.update(
        { termsConditionsId: Number(params.termsConditionsId) },
        queryParams,
      );

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.TERMS_CONDITIONS_UPDATE,
        userId: performerId,
        companyId: existingTc.companyId,
        actorType: 'USER',
        targetType: 'TERMS_CONDITIONS',
        targetId: String(params.termsConditionsId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          code: existingTc.code,
          title: params.title ?? existingTc.title,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Terms and conditions updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}