import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankBookEntity } from '../entity/bank.book.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { bankBookListDto } from '../dto/bank.book.dto';

@Injectable()
export class BankBookListService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(BankBookEntity)
  private readonly bankBookRepository!: Repository<BankBookEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  async bankBookList(param: bankBookListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder =
        this.bankBookRepository.createQueryBuilder('bankBook');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'bankBook.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Bank books fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'bankBook',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.bankBookRepository,
      )) as [number, number];

      queryBuilder.leftJoinAndSelect('bankBook.bank', 'bank');
      queryBuilder.leftJoinAndSelect('bankBook.company', 'company');
      queryBuilder.leftJoinAndSelect('bankBook.currency', 'currency');
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('bankBook.bankBookName', 'ASC');
      

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => ({
        ...item,
        bankName: item.bank?.bankName ?? null,
        companyName: item.company?.companyName ?? null,
        currencyCode: item.currency?.code ?? null,
        currencySymbol: item.currency?.symbol ?? null,
      }));

      return_data = {
        success: 1,
        message: 'Bank books fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getBankBookDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const bankBook = await this.bankBookRepository.findOne({
      where: { bankBookId: id },
      relations: ['bank', 'company', 'currency'],
    });
    if (!bankBook) {
      throw new NotFoundException('Bank book not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(bankBook.companyId))) {
        throw new ForbiddenException(
          'Access denied: bank book belongs to another company',
        );
      }
    }

    const addedByUser = bankBook.addedBy
      ? await this.userEntity.findOne({ where: { userId: bankBook.addedBy } })
      : null;
    const updatedByUser = bankBook.updatedBy
      ? await this.userEntity.findOne({
          where: { userId: bankBook.updatedBy },
        })
      : null;

    return {
      ...bankBook,
      bankName: bankBook.bank?.bankName ?? null,
      companyName: bankBook.company?.companyName ?? null,
      currencyCode: bankBook.currency?.code ?? null,
      currencySymbol: bankBook.currency?.symbol ?? null,
      beneficiaryName: bankBook.beneficiaryName,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }
}
