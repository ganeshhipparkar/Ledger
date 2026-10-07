import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DataSource, In } from 'typeorm';
import { Filter } from 'src/utilities/filter';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { CompanyCurrencyEntity } from 'src/packages/entity/company.currency.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { CompanyEntity } from '../entity/company.entity';

@Injectable()
export class CompanyListService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(CompanyEntity)
  protected companyEntity!: Repository<CompanyEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  protected ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(CurrencyEntity)
  protected currencyEntity!: Repository<CurrencyEntity>;

  @InjectRepository(CompanyCurrencyEntity)
  protected companyCurrencyEntity!: Repository<CompanyCurrencyEntity>;

  async getCompanies(param: any, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.companyEntity.createQueryBuilder('company');
      const alias = 'company';

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere('company.companyId IN (:...scopedCompanyIds)', {
            scopedCompanyIds,
          });
        } else {
          return {
            success: 1,
            message: 'List fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param?.filters,
        alias,
        {},
        param?.condition === 'Any' ? 'Any' : 'All',
      );

      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.companyEntity,
      )) as [number, number];

      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy(`${alias}.companyName`, 'ASC');
      const [data, total] = await queryBuilder.getManyAndCount();

      return_data = {
        success: 1,
        message: 'List fetched successfully',
        total,
        data,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }

    return return_data;
  }

  async getCompany(query: any, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const targetCompanyId = Number(query);
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!authCtx.isSuperAdmin && !scopedCompanyIds.includes(targetCompanyId)) {
        throw new ForbiddenException(
          'Access denied: cannot access another company',
        );
      }

      const company = await this.companyEntity.findOne({
        where: { companyId: targetCompanyId },
        relations: { parentCompany: true },
        select: {
          companyId: true, companyName: true, companyCode: true, companyFile: true,
          email: true, website: true, dialCode: true, phone: true, country: true,
          state: true, city: true, postalCode: true, AddressLineOne: true,
          ownerName: true, ownerEmail: true, ownerPhone: true, ownerDialCode: true,
          status: true, addedBy: true, updatedBy: true, createdAt: true,
          updatedDate: true, parentCompanyId: true,
          parentCompany: { companyName: true },
        },
      });

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      const userRepo = this.companyEntity.manager.getRepository(UserEntity);
      const [
        assignments,
        currencyMappings,
        allCurrencies,
        addedByUser,
        updatedByUser,
      ] = await Promise.all([
        this.ucgEntity.find({
          where: { companyId: targetCompanyId },
          relations: { user: true, group: true },
          select: {
            id: true, userId: true, companyId: true, groupId: true, is_parent: true,
            user: { name: true, email: true },
            group: { groupName: true },
          },
        }),
        this.companyCurrencyEntity.find({
          where: { companyId: targetCompanyId },
          relations: { currency: true },
          select: { id: true, companyId: true, curId: true, currency: true },
        }),
        this.currencyEntity.find({where:{status:"Active"}, order: { name: 'ASC' } }),
        company.addedBy
          ? userRepo.findOne({
              where: { userId: company.addedBy },
              select: ['name'],
            })
          : null,
        company.updatedBy
          ? userRepo.findOne({
              where: { userId: company.updatedBy },
              select: ['name'],
            })
          : null,
      ]);

      return {
        ...company,
        parentCompanyName: company.parentCompany?.companyName ?? null,
        addedByName: addedByUser?.name ?? null,
        updatedByName: updatedByUser?.name ?? null,
        currencies: currencyMappings.map((cm) => cm.currency),
        curIds: currencyMappings.map((cm) => cm.curId),
        allCurrencies,
        assignments: assignments.map((ucg) => ({
          userId: ucg.userId,
          userName: ucg.user?.name,
          userEmail: ucg.user?.email,
          groupId: ucg.groupId,
          groupName: ucg.group?.groupName,
          is_parent: ucg.is_parent,
        })),
      };
    } catch (err) {
      return err;
    }
  }

  async getCurrencies(req?: any) {
    return this.currencyEntity.find({ order: { name: 'ASC' } });
  }
}
