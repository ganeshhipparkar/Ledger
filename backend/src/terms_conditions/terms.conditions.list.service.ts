import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TermsAndConditionsEntity } from './entity/terms.conditions.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { termsConditionsListDto } from './dto/terms.conditions.dto';

@Injectable()
export class TermsConditionsListService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(TermsAndConditionsEntity)
  private readonly termsConditionsRepository!: Repository<TermsAndConditionsEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

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
}
