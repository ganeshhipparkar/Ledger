import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityCode } from '../activity/enums/activity-code.enum';
import { BankBookEntity } from './entity/bank.book.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import {
  bankBookListDto,
  BankBookDto,
  BankBookUpdateDto,
} from './dto/bank.book.dto';

@Injectable()
export class BankBookService {
  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;

  @InjectRepository(BankBookEntity)
  private readonly bankBookRepository!: Repository<BankBookEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  @Inject(EventEmitter2)
  private readonly eventEmitter!: EventEmitter2;

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

  async insertBankBook(params: BankBookDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add bank book to another company',
          };
        }
      }

      const bankBookCode = await this.codeGeneratorService.generateCode(
        this.bankBookRepository,
        params.bankBookName,
        params.companyId,
        'bankBookCode',
      );

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.addedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      const queryParams: any = {
        bankBookCode,
        bankBookName: params.bankBookName,
        bankId: Number(params.bankId),
        companyId: Number(params.companyId),
        currencyId: Number(params.currencyId),
        beneficiaryName: params.beneficiaryName,
        status: params.status,
      };

      if (params.accountNumber !== undefined) queryParams.accountNumber = params.accountNumber;
      if (params.branchName !== undefined) queryParams.branchName = params.branchName;
      if (params.remarks !== undefined) queryParams.remarks = params.remarks;
      if (performerId) queryParams.addedBy = Number(performerId);
      queryParams.addedDate = new Date();

      const result = await this.bankBookRepository.insert(queryParams);
      const insertId = result?.raw?.insertId;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.BANK_BOOK_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'BANK_BOOK',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          bankBookCode,
          bankBookName: params.bankBookName,
          companyId: params.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Bank book inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateBankBook(params: BankBookUpdateDto, req?: any) {
    if (!params.bankBookId) {
      return { success: 0, message: 'bankBookId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existingBankBook = await this.bankBookRepository.findOne({
        where: { bankBookId: Number(params.bankBookId) },
      });
      if (!existingBankBook) {
        return { success: 0, message: 'Bank book not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingBankBook.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update bank book of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.bankBookName !== undefined) queryParams.bankBookName = params.bankBookName;
      if (params.bankId !== undefined) queryParams.bankId = Number(params.bankId);
      if (params.companyId !== undefined) queryParams.companyId = Number(params.companyId);
      if (params.currencyId !== undefined) queryParams.currencyId = Number(params.currencyId);
      if (params.beneficiaryName !== undefined) queryParams.beneficiaryName = params.beneficiaryName;
      if (params.accountNumber !== undefined) queryParams.accountNumber = params.accountNumber;
      if (params.branchName !== undefined) queryParams.branchName = params.branchName;
      if (params.remarks !== undefined) queryParams.remarks = params.remarks;
      if (params.status) queryParams.status = params.status;

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.updatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      await this.bankBookRepository.update(
        { bankBookId: Number(params.bankBookId) },
        queryParams,
      );

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.BANK_BOOK_UPDATE,
        userId: performerId,
        companyId: existingBankBook.companyId,
        actorType: 'USER',
        targetType: 'BANK_BOOK',
        targetId: String(params.bankBookId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          bankBookCode: existingBankBook.bankBookCode,
          bankBookName: params.bankBookName ?? existingBankBook.bankBookName,
          status: params.status ?? existingBankBook.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Bank book updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}