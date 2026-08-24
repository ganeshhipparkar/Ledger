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
import { UomEntity } from './entity/uom.entity';
import { UomDto, UomListDto, UomUpdateDto } from './dto/uom.dto';

@Injectable()
export class UomService {
  constructor(
    @InjectRepository(UomEntity)
    private readonly uomEntity: Repository<UomEntity>,
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

  async uomList(param: UomListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.uomEntity.createQueryBuilder('uom');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere('uom.companyId IN (:...scopedCompanyIds)', {
            scopedCompanyIds,
          });
        } else {
          return {
            success: 1,
            message: 'UOMs fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'uom',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.uomEntity,
      )) as [number, number];

      queryBuilder.leftJoinAndSelect('uom.company', 'company');
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('uom.uomName', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => ({
        ...item,
        companyName: item.company?.companyName ?? null,
      }));

      return_data = {
        success: 1,
        message: 'UOMs fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getUomDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const uom = await this.uomEntity.findOne({
      where: { uomId: id },
      relations: ['company'],
    });
    if (!uom) {
      throw new NotFoundException('UOM not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(uom.companyId))) {
        throw new ForbiddenException(
          'Access denied: UOM belongs to another company',
        );
      }
    }

    const addedByUser = uom.addedBy
      ? await this.userEntity.findOne({ where: { userId: uom.addedBy } })
      : null;
    const updatedByUser = uom.updatedBy
      ? await this.userEntity.findOne({ where: { userId: uom.updatedBy } })
      : null;

    return {
      ...uom,
      companyName: uom.company?.companyName ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }

  async insertUom(params: UomDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add UOM to another company',
          };
        }
      }

      const uomCode = await this.codeGeneratorService.generateCode(
        this.uomEntity,
        params.uomName,
        params.companyId,
        'uomCode',
      );

      const performerId = req?.user?.isImpersonation
        ? req?.user?.impersonatedBy
        : (req?.user?.userId ?? params.addedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.impersonatorEmail
        : (req?.user?.email ?? '');

      const queryParams: any = {
        uomCode,
        uomName: params.uomName,
        abbreviation: params.abbreviation,
        isoCode: params.isoCode,
        companyId: Number(params.companyId),
        status: params.status,
      };
      if (performerId) queryParams.addedBy = Number(performerId);
      queryParams.addedDate = new Date();

      const result = await this.uomEntity.insert(queryParams);
      const insertId = result?.raw?.insertId;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.UOM_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'UOM',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          uomCode,
          uomName: params.uomName,
          abbreviation: params.abbreviation,
          isoCode: params.isoCode,
          companyId: params.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'UOM inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateUom(params: UomUpdateDto, req?: any) {
    if (!params.uomId) {
      return { success: 0, message: 'uomId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existingUom = await this.uomEntity.findOne({
        where: { uomId: Number(params.uomId) },
      });
      if (!existingUom) {
        return { success: 0, message: 'UOM not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingUom.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update UOM of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.uomName !== undefined)
        queryParams.uomName = params.uomName;
      if (params.abbreviation !== undefined)
        queryParams.abbreviation = params.abbreviation;
      if (params.isoCode !== undefined)
        queryParams.isoCode = params.isoCode;
      if (params.status) queryParams.status = params.status;

      const performerId = req?.user?.isImpersonation
        ? req?.user?.impersonatedBy
        : (req?.user?.userId ?? params.updatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.impersonatorEmail
        : (req?.user?.email ?? '');

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      await this.uomEntity.update(
        { uomId: Number(params.uomId) },
        queryParams,
      );

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.UOM_UPDATE,
        userId: performerId,
        companyId: existingUom.companyId,
        actorType: 'USER',
        targetType: 'UOM',
        targetId: String(params.uomId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          uomCode: existingUom.uomCode,
          uomName: params.uomName ?? existingUom.uomName,
          status: params.status ?? existingUom.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'UOM updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}