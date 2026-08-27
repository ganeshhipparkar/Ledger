import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { CompanyCurrencyEntity } from 'src/packages/entity/company.currency.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { getCurrencyListDto, CurrencyDto, CurrencyUpdateDto } from 'src/currency/dto/currency.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityCode } from '../activity/enums/activity-code.enum';
import { resolveAuthContext } from 'src/utilities/auth-helper';

@Injectable()
export class CurrencyService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(CurrencyEntity)
  private readonly currencyEntity!: Repository<CurrencyEntity>;

  @InjectRepository(CompanyCurrencyEntity)
  private readonly companyCurrencyEntity!: Repository<CompanyCurrencyEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  @Inject(EventEmitter2)
  private readonly eventEmitter!: EventEmitter2;

  async getCurrencies(param: getCurrencyListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.currencyEntity.createQueryBuilder('currency');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          const subQuery = this.companyCurrencyEntity
            .createQueryBuilder('cc')
            .select('cc.curId')
            .where('cc.companyId IN (:...scopedCompanyIds)', {
              scopedCompanyIds,
            });
          queryBuilder.andWhere(
            `currency.curId IN (${subQuery.getQuery()})`,
            subQuery.getParameters(),
          );
        } else {
          return {
            success: 1,
            message: 'Currencies fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'currency',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
        queryBuilder.orderBy('currency.name', 'ASC');
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.currencyEntity,
      )) as [number, number];

      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('currency.name', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      return_data = {
        success: 1,
        message: 'Currencies fetched successfully',
        total,
        data,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getCurrencyDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const currency = await this.currencyEntity.findOne({
      where: { curId: id },
    });
    if (!currency) {
      throw new NotFoundException('Currency not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (scopedCompanyIds.length > 0) {
        const mapping = await this.companyCurrencyEntity.findOne({
          where: {
            curId: id,
            companyId: In(scopedCompanyIds),
          },
        });
        if (!mapping) {
          throw new ForbiddenException(
            'Access denied: currency is not mapped to your company',
          );
        }
      } else {
        throw new ForbiddenException(
          'Access denied: currency is not mapped to your company',
        );
      }
    }

    const addedByUser = currency.addedBy
      ? await this.userEntity.findOne({
          where: { userId: currency.addedBy },
          select: ['name'],
        })
      : null;
    const updatedByUser = currency.updatedBy
      ? await this.userEntity.findOne({
          where: { userId: currency.updatedBy },
          select: ['name'],
        })
      : null;

    const baseCurrency: string = process.env.CURRENCY_CONVERSION || "";
    return {
      ...currency,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
      baseCurrency,
    };
  }
  

  async getCurrencyRate(curId: number) {
    const currency = await this.currencyEntity.findOne({ where: { curId } });
    if (!currency) {
      throw new NotFoundException('Currency not found');
    }
    return {
      curId: currency.curId,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      conversionRate: currency.conversionRate,
    };
  }

  async insertCurrency(params: CurrencyDto, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      if (!authCtx.isSuperAdmin) {
        return {
          success: 0,
          message: 'Access denied: only superAdmin can add currencies',
        };
      }

      if (params.code) {
        const existingCode = await this.currencyEntity.findOne({
          where: { code: params.code },
        });
        if (existingCode) {
          return { success: 0, message: 'Currency code already exists' };
        }
      }

      const queryParams: any = {};
      if (params.name) queryParams.name = params.name;
      if (params.code) queryParams.code = params.code;
      if (params.symbol) queryParams.symbol = params.symbol;
      if (params.conversionRate !== undefined) queryParams.conversionRate = Number(params.conversionRate);
      if (params.status) queryParams.status = params.status;

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.updatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');
      const performerUcg = performerId
        ? await this.ucgEntity.findOne({
            where: { userId: Number(performerId) },
            order: { is_parent: 'ASC' },
            relations: { group: true },
            select: { id: true, userId: true, is_parent: true, group: { groupName: true } },
          })
        : null;

      if (performerId) {
        queryParams.addedBy = performerId;
      }
      queryParams.addedDate = new Date();

      const result = await this.currencyEntity.insert(queryParams);
      const insertId = result?.raw?.insertId;
      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.CURRENCY_CREATE,
        userId: performerId,
        actorType: 'USER',
        targetType: 'CURRENCY',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: performerUcg?.group?.groupName || 'N/A',
          name: params.name,
          code: params.code,
          impersonated: !!req?.user?.isImpersonation
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Currency inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateCurrency(params: CurrencyUpdateDto, req?: any) {
    if (!params.curId) {
      return { success: 0, message: 'curId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      if (!authCtx.isSuperAdmin) {
        return {
          success: 0,
          message: 'Access denied: only superAdmin can update currencies',
        };
      }

      const existingCurrency = await this.currencyEntity.findOne({
        where: { curId: Number(params.curId) },
      });
      if (!existingCurrency) {
        return { success: 0, message: 'Currency not found' };
      }

      if (params.code && params.code !== existingCurrency.code) {
        return { success: 0, message: 'Currency code cannot be changed' };
      }

      if (params.symbol && params.symbol !== existingCurrency.symbol) {
        return { success: 0, message: 'Currency symbol cannot be changed' };
      }

      const queryParams: any = {};
      if (params.name) queryParams.name = params.name;
      if (params.conversionRate !== undefined) queryParams.conversionRate = Number(params.conversionRate);
      if (params.status) queryParams.status = params.status;

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.updatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');
      const performerUcg = performerId
        ? await this.ucgEntity.findOne({
            where: { userId: Number(performerId) },
            order: { is_parent: 'ASC' },
            relations: { group: true },
            select: { id: true, userId: true, is_parent: true, group: { groupName: true } },
          })
        : null;

      if (performerId) {
        queryParams.updatedBy = performerId;
      } 
      queryParams.updatedDate = new Date();

      await this.currencyEntity.update({ curId: Number(params.curId) }, queryParams);

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.CURRENCY_UPDATE,
        userId: performerId,
        actorType: 'USER',
        targetType: 'CURRENCY',
        targetId: String(params.curId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: performerUcg?.group?.groupName || 'N/A',
          name: params.name || '',
          code: params.code || '',
          impersonated: !!req?.user?.isImpersonation
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Currency updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async syncCurrency(body: getCurrencyListDto, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      // if (!authCtx.isSuperAdmin) {
      //   return {
      //     success: 0,
      //     message: 'Access denied: only superAdmin can sync currencies',
      //   };
      // }
      if (!process.env.EXCHANGE_API || !process.env.CURRENCY_CONVERSION) {
        return { success: 0, message: "Missing exchange API configuration in environment" };
      }

      const url = process.env.EXCHANGE_API + process.env.CURRENCY_CONVERSION;
      const response = await fetch(url);
      if (!response.ok) {
        return { success: 0, message: `Failed to fetch exchange rates: status ${response.status}` };
      }

      const data = await response.json();
      if (data.result !== 'success') {
        return { success: 0, message: data['error-type'] || 'API call was not successful' };
      }

      const conversionRates = data.conversion_rates;
      if (!conversionRates) {
        return { success: 0, message: 'Invalid API response format: missing conversion_rates' };
      }

      const existingCurrencies = await this.currencyEntity.find({
        select: ['curId', 'code'],
      });
      const updates: Promise<any>[] = [];

      for (const cur of existingCurrencies) {
        if (cur.code && conversionRates[cur.code] !== undefined) {
          const rate = Number(conversionRates[cur.code]);
          updates.push(
            this.currencyEntity.update({ curId: cur.curId }, { conversionRate: rate })
          );
          this.currencyEntity.update({ curId: cur.curId }, { lastSync: new Date() });

        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
      }

      const performerId = req?.user?.isImpersonation ? req?.user?.impersonatedBy : (req?.user?.userId ?? null);
      const performerEmail = req?.user?.isImpersonation ? req?.user?.impersonatorEmail : (req?.user?.email ?? '');
      const performerUcg = performerId
        ? await this.ucgEntity.findOne({
            where: { userId: Number(performerId) },
            order: { is_parent: 'ASC' },
            relations: { group: true },
            select: { id: true, userId: true, is_parent: true, group: { groupName: true } },
          })
        : null;

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.CURRENCY_UPDATE,
        userId: performerId,
        actorType: 'USER',
        targetType: 'CURRENCY',
        targetId: 'ALL',
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: performerUcg?.group?.groupName || 'N/A',
          name: 'All Currencies',
          code: 'ALL_SYNC',
          impersonated: !!req?.user?.isImpersonation
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Currencies synced successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}

