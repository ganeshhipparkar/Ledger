import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Filter } from 'src/utilities/filter';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { BrandEntity } from '../entity/brand.entity';
import { BrandListDto } from '../dto/brand.dto';

@Injectable()
export class BrandListService {
  constructor(
    @InjectRepository(BrandEntity)
    private readonly brandEntity: Repository<BrandEntity>,
    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
  ) {}

  @Inject()
  private readonly filter!: Filter;

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
}
