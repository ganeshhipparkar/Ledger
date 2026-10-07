import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankMasterEntity } from '../entity/bank.master.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { bankListDto } from '../dto/bank.dto';

@Injectable()
export class BankMasterListService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(BankMasterEntity)
  private readonly bankRepository!: Repository<BankMasterEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  async bankList(param: bankListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder =
        this.bankRepository.createQueryBuilder('bank');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'bank.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Banks fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'bank',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.bankRepository,
      )) as [number, number];

      queryBuilder
        .select([
          'bank.bankId',
          'bank.bankName',
          'bank.bankCode',
          'bank.companyId',
          'bank.status',
          'company.companyName',
        ])
        .leftJoin('bank.company', 'company');
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('bank.bankName', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => ({
        ...item,
        companyName: item.company?.companyName ?? null,
      }));

      return_data = {
        success: 1,
        message: 'Banks fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getBankDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const bank = await this.bankRepository.findOne({
      where: { bankId: id },
      relations: ['company'],
    });
    if (!bank) {
      throw new NotFoundException('Bank not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(bank.companyId))) {
        throw new ForbiddenException(
          'Access denied: bank belongs to another company',
        );
      }
    }

    const addedByUser = bank.addedBy
      ? await this.userEntity.findOne({ where: { userId: bank.addedBy } })
      : null;
    const updatedByUser = bank.updatedBy
      ? await this.userEntity.findOne({
          where: { userId: bank.updatedBy },
        })
      : null;

    return {
      ...bank,
      companyName: bank.company?.companyName ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }
}
