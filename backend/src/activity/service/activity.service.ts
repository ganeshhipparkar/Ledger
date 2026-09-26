import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogEntity } from 'src/activity/entity/activity-log.entity';
import { Filter } from 'src/utilities/filter';
import { GetActivityListDto } from 'src/activity/dto/activity.dto';
import { ActivityMasterEntity } from '../entity/activity-master.entity';

export interface LogPayload {
  activityCode: string;
  userId?: number;
  companyId?: number;
  actorType: string;
  targetType?: string;
  targetId?: string;
  executionStatus: string;
  severity?: string;
  parameters?: Record<string, any>;
  // metadata?: Record<string, any>;
  // correlationId?: string;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly logRepository: Repository<ActivityLogEntity>,

    @InjectRepository(ActivityMasterEntity)
    private readonly masterRepository: Repository<ActivityMasterEntity>,

    private readonly filterHelper: Filter,
  ) {}

  async log(payload: LogPayload): Promise<void> {
    try {
      const master = await this.masterRepository.findOne({
        where: { activityCode: payload.activityCode, isActive: true },
      });

      if (!master) {
        console.warn(
          `ActivityMaster definition not found or inactive for code: ${payload.activityCode}`,
        );
        return;
      }

      const severity = payload.severity || master.defaultSeverity;
      const generatedMessage = this.compileMessage(
        master.template,
        payload.parameters,
      );

      await this.logRepository.insert({
        activityMasterId: master.activityMasterId,
        userId: payload.userId ?? undefined,
        companyId: payload.companyId ?? undefined,
        actorType: payload.actorType,
        targetType: payload.targetType ?? undefined,
        targetId: payload.targetId ?? undefined,
        executionStatus: payload.executionStatus,
        severity: severity,
        // correlationId: payload.correlationId ?? undefined,
        parameters: payload.parameters ?? undefined,
        // metadata: payload.metadata ?? undefined,
        generatedMessage,
      } as any);
    } catch (error) {
      console.error('Failed to save activity log:', error);
    }
  }
  async listLogs(query: GetActivityListDto, reqContext: any): Promise<any> {
    try {
      const queryBuilder = this.logRepository
        .createQueryBuilder('activity_log')
        .leftJoinAndSelect('activity_log.activityMaster', 'activityMaster')
        .leftJoinAndSelect('activity_log.user', 'user')
        .leftJoinAndSelect('activity_log.company', 'company');

      // Multi-tenant Company Scoping
      if (!reqContext.isSuperAdmin) {
        const scopedCompanyIds =
          reqContext.scopedCompanyIds || reqContext.userCompanyIds || [];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere('activity_log.companyId IN (:...companyIds)', {
            companyIds: scopedCompanyIds,
          });
        } else {
          // Non-superAdmin with no companies has access to nothing
          return { success: 1, total: 0, data: [] };
        }
      }

      // Parse and map filters
      let profileIdFilter: any = null;
      const otherFilters: any[] = [];

      if (query.filters && Array.isArray(query.filters)) {
        for (const f of query.filters) {
          if (f.key === 'userProfileId') {
            profileIdFilter = f.value;
          } else {
            otherFilters.push(f);
          }
        }
      }

      // Only show activities performed BY this user (actor) — not activities done TO them.
      if (profileIdFilter) {
        queryBuilder.andWhere('activity_log.userId = :profileId', {
          profileId: Number(profileIdFilter),
        });
      }

      // Process other standard filters using custom filter helper
      const filterStr = await this.filterHelper.makeFilterString(
        otherFilters,
        'activity_log',
      );
      if (filterStr && filterStr.trim() !== '') {
        queryBuilder.andWhere(filterStr);
      }

      if (query.startDate) {
        const start = new Date(`${query.startDate}T00:00:00.000`);
        queryBuilder.andWhere('activity_log.createdAt >= :startDate', {
          startDate: start,
        });
      }
      if (query.endDate) {
        const end = new Date(`${query.endDate}T23:59:59.999`);
        queryBuilder.andWhere('activity_log.createdAt <= :endDate', {
          endDate: end,
        });
      }

      // Pagination calculation
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 10;
      const skip = (page - 1) * limit;

      queryBuilder.orderBy('activity_log.createdAt', 'DESC').addOrderBy('activity_log.logId', 'DESC');
      queryBuilder.skip(skip).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      // Format data for frontend display
      const formatted = data.map((log) => ({
        logId: log.logId,
        activityCode: log.activityMaster?.activityCode,
        activityName: log.activityMaster?.activityName,
        module: log.activityMaster?.module,
        actorType: log.actorType,
        targetType: log.targetType,
        targetId: log.targetId,
        executionStatus: log.executionStatus,
        severity: log.severity,
        // correlationId: log.correlationId,
        parameters: log.parameters,
        generatedMessage: log.generatedMessage,
        createdAt: log.createdAt,
        actor: log.user
          ? {
              userId: log.user.userId,
              userName: log.user.name,
              email: log.user.email,
            }
          : null,
        company: log.company
          ? {
              companyId: log.company.companyId,
              companyName: log.company.companyName,
            }
          : null,
      }));

      return {
        success: 1,
        message: 'Logs fetched successfully',
        total,
        data: formatted,
      };
    } catch (error: any) {
      return {
        success: 0,
        message:
          error.message || 'An error occurred while fetching activity logs',
      };
    }
  }

  private compileMessage(template: string, params: any): string {
    if (!template) return '';
    if (!params) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }
}
