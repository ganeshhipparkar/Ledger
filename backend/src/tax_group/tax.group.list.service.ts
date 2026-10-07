import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { taxGroupEntity } from './entity/tax.group.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { taxGroupListDto } from './dto/tax.group.dto';

@Injectable()
export class TaxGroupListService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(taxGroupEntity)
  private readonly taxGroupRepository!: Repository<taxGroupEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  async taxGroupList(param: taxGroupListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder =
        this.taxGroupRepository.createQueryBuilder('taxGroup');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'taxGroup.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Tax groups fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'taxGroup',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.taxGroupRepository,
      )) as [number, number];

      queryBuilder.leftJoinAndSelect('taxGroup.company', 'company');
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('taxGroup.taxCode', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => ({
        ...item,
        companyName: item.company?.companyName ?? null,
      }));

      return_data = {
        success: 1,
        message: 'Tax groups fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getTaxGroupDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const taxGroup = await this.taxGroupRepository.findOne({
      where: { taxId: id },
      relations: ['company'],
    });
    if (!taxGroup) {
      throw new NotFoundException('Tax group not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(taxGroup.companyId))) {
        throw new ForbiddenException(
          'Access denied: tax group belongs to another company',
        );
      }
    }

    const addedByUser = taxGroup.addedBy
      ? await this.userEntity.findOne({ where: { userId: taxGroup.addedBy } })
      : null;
    const updatedByUser = taxGroup.updatedBy
      ? await this.userEntity.findOne({
          where: { userId: taxGroup.updatedBy },
        })
      : null;

    return {
      ...taxGroup,
      companyName: taxGroup.company?.companyName ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }

  async taxGroupDetails(id: number, req?: any) {
    return this.getTaxGroupDetails(id, req);
  }
}
