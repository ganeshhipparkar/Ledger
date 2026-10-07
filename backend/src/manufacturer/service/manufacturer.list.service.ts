import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ManufacturerEntity } from '../entity/manufacturer.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { manufacturerListDto } from '../dto/manufacturer.dto';

@Injectable()
export class ManufacturerListService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(ManufacturerEntity)
  private readonly manufacturerEntity!: Repository<ManufacturerEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  async manufacturerList(param: manufacturerListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder =
        this.manufacturerEntity.createQueryBuilder('manufacturer');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'manufacturer.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Manufacturers fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'manufacturer',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.manufacturerEntity,
      )) as [number, number];

      queryBuilder.leftJoinAndSelect('manufacturer.company', 'company');
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('manufacturer.manufacturerName', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => ({
        ...item,
        companyName: item.company?.companyName ?? null,
      }));

      return_data = {
        success: 1,
        message: 'Manufacturers fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getManufacturerDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const manufacturer = await this.manufacturerEntity.findOne({
      where: { manufacturerId: id },
      relations: ['company'],
    });
    if (!manufacturer) {
      throw new NotFoundException('Manufacturer not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(manufacturer.companyId))) {
        throw new ForbiddenException(
          'Access denied: manufacturer belongs to another company',
        );
      }
    }

    const addedByUser = manufacturer.addedBy
      ? await this.userEntity.findOne({ where: { userId: manufacturer.addedBy } })
      : null;
    const updatedByUser = manufacturer.updatedBy
      ? await this.userEntity.findOne({
          where: { userId: manufacturer.updatedBy },
        })
      : null;

    return {
      ...manufacturer,
      companyName: manufacturer.company?.companyName ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }
}
