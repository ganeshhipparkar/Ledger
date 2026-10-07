import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Filter } from 'src/utilities/filter';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { UomEntity } from '../entity/uom.entity';
import { UomListDto } from '../dto/uom.dto';

@Injectable()
export class UomListService {
  constructor(
    @InjectRepository(UomEntity)
    private readonly uomEntity: Repository<UomEntity>,
    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
  ) {}

  @Inject()
  private readonly filter!: Filter;

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
}
