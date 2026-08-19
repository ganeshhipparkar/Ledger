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
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { BrandEntity } from './entity/brand.entity';
import { BrandDto, BrandListDto, BrandUpdateDto } from './dto/brand.dto';

@Injectable()
export class BrandService {
  constructor(
    @InjectRepository(BrandEntity)
    private readonly brandEntity: Repository<BrandEntity>,
    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Inject()
  private readonly filter!: Filter;

  private async generateBrandCode(
    brandName: string,
    companyId: number,
  ): Promise<string> {
    const prefix = brandName.trim().replace(/\s/g, '').substring(0, 8).toUpperCase();
    let counter = 1;
    let code: string;
    do {
      code = `${prefix}${String(counter).padStart(3, '0')}`;
      const existing = await this.brandEntity.findOne({
        where: { brandCode: code, companyId: Number(companyId) },
      });
      if (!existing) break;
      counter++;
    } while (true);
    return code;
  }

  async brandList(param: BrandListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.brandEntity.createQueryBuilder('brand');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere('brand.companyId IN (:...scopedCompanyIds)', {
            scopedCompanyIds,
          });
        } else {
          return {
            success: 1,
            message: 'Brands fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'brand',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.brandEntity,
      )) as [number, number];

      queryBuilder.leftJoinAndSelect('brand.company', 'company');
      queryBuilder.leftJoinAndSelect('brand.manufacturer', 'manufacturer');
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('brand.brandName', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => ({
        ...item,
        companyName: item.company?.companyName ?? null,
        manufacturerName: item.manufacturer?.manufacturerName ?? null,
      }));

      return_data = {
        success: 1,
        message: 'Brands fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getBrandDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const brand = await this.brandEntity.findOne({
      where: { brandId: id },
      relations: ['company', 'manufacturer'],
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(brand.companyId))) {
        throw new ForbiddenException(
          'Access denied: brand belongs to another company',
        );
      }
    }

    const addedByUser = brand.addedBy
      ? await this.userEntity.findOne({ where: { userId: brand.addedBy } })
      : null;
    const updatedByUser = brand.updatedBy
      ? await this.userEntity.findOne({ where: { userId: brand.updatedBy } })
      : null;

    return {
      ...brand,
      companyName: brand.company?.companyName ?? null,
      manufacturerName: brand.manufacturer?.manufacturerName ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }

  async insertBrand(params: BrandDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add brand to another company',
          };
        }
      }

      const brandCode = await this.generateBrandCode(
        params.brandName,
        Number(params.companyId),
      );

      const performerId = req?.user?.isImpersonation
        ? req?.user?.impersonatedBy
        : (req?.user?.userId ?? params.addedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.impersonatorEmail
        : (req?.user?.email ?? '');

      const queryParams: any = {
        brandCode,
        brandName: params.brandName,
        companyId: Number(params.companyId),
        manufacturerId: params.manufacturerId ? Number(params.manufacturerId) : null,
        status: params.status,
      };
      if (performerId) queryParams.addedBy = Number(performerId);
      queryParams.addedDate = new Date();

      const result = await this.brandEntity.insert(queryParams);
      const insertId = result?.raw?.insertId;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.BRAND_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'BRAND',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          brandCode,
          brandName: params.brandName,
          companyId: params.companyId,
          manufacturerId: params.manufacturerId ?? null,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Brand inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateBrand(params: BrandUpdateDto, req?: any) {
    if (!params.brandId) {
      return { success: 0, message: 'brandId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existingBrand = await this.brandEntity.findOne({
        where: { brandId: Number(params.brandId) },
      });
      if (!existingBrand) {
        return { success: 0, message: 'Brand not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingBrand.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update brand of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.brandName !== undefined)
        queryParams.brandName = params.brandName;
      if (params.manufacturerId !== undefined)
        queryParams.manufacturerId = params.manufacturerId ? Number(params.manufacturerId) : null;
      if (params.status) queryParams.status = params.status;

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.updatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      await this.brandEntity.update(
        { brandId: Number(params.brandId) },
        queryParams,
      );

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.BRAND_UPDATE,
        userId: performerId,
        companyId: existingBrand.companyId,
        actorType: 'USER',
        targetType: 'BRAND',
        targetId: String(params.brandId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          brandCode: existingBrand.brandCode,
          brandName: params.brandName ?? existingBrand.brandName,
          status: params.status ?? existingBrand.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Brand updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}