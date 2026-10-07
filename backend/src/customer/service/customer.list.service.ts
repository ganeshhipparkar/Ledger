import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerEntity } from '../entity/customer.entity';
import { CustomerCurrencyEntity } from '../entity/customer.currency.entity';
import { CompanyCurrencyEntity } from 'src/packages/entity/company.currency.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { CustomerListDto } from '../dto/customer.dto';

@Injectable()
export class CustomerListService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerEntity: Repository<CustomerEntity>,
    @InjectRepository(CustomerCurrencyEntity)
    private readonly customerCurrencyEntity: Repository<CustomerCurrencyEntity>,
    @InjectRepository(CompanyCurrencyEntity)
    private readonly companyCurrencyEntity: Repository<CompanyCurrencyEntity>,
    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
  ) {}

  @Inject()
  private readonly filter!: Filter;

  async customerList(param: CustomerListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.customerEntity.createQueryBuilder('customer');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere('customer.companyId IN (:...scopedCompanyIds)', {
            scopedCompanyIds,
          });
        } else {
          return {
            success: 1,
            message: 'Customers fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'customer',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.customerEntity,
      )) as [number, number];

      queryBuilder.leftJoinAndSelect('customer.company', 'company');
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('customer.customerName', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => ({
        ...item,
        companyName: item.company?.companyName ?? null,
      }));

      return_data = {
        success: 1,
        message: 'Customers fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async customerCurrenciesList(param: CustomerListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.customerCurrencyEntity.createQueryBuilder('customerCurrency');

      queryBuilder.leftJoinAndSelect('customerCurrency.customer', 'customer');
      queryBuilder.leftJoinAndSelect('customerCurrency.currency', 'currency');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere('customer.companyId IN (:...scopedCompanyIds)', {
            scopedCompanyIds,
          });
          queryBuilder.andWhere('customer.status=:isActive',{isActive:"Active"})
          queryBuilder.andWhere('currency.status=:isActive',{isActive:"Active"})
        } else {
          return {
            success: 1,
            message: 'Customer currencies fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'customer',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.customerCurrencyEntity,
      )) as [number, number];

      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('customer.customerName', 'ASC');
      queryBuilder.addOrderBy('currency.code', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      return_data = {
        success: 1,
        message: 'Customer currencies fetched successfully',
        total,
        data,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getCustomerDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const customer = await this.customerEntity.findOne({
      where: { customerId: id },
      relations: ['company'],
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(customer.companyId))) {
        throw new ForbiddenException(
          'Access denied: customer belongs to another company',
        );
      }
    }

    const [currencyMappings, addedByUser, updatedByUser] = await Promise.all([
      this.customerCurrencyEntity.find({
        where: { customerId: id },
        relations: ['currency'],
      }),
      customer.addedBy
        ? this.userEntity.findOne({ where: { userId: customer.addedBy } })
        : null,
      customer.updatedBy
        ? this.userEntity.findOne({ where: { userId: customer.updatedBy } })
        : null,
    ]);

    return {
      ...customer,
      companyName: customer.company?.companyName ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
      currencies: currencyMappings.map((cm) => cm.currency).filter(Boolean),
      curIds: currencyMappings.map((cm) => cm.curId).filter(Boolean),
    };
  }

  async getCompanyCurrencies(companyId: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const targetCompanyId = Number(companyId);

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(targetCompanyId)) {
        throw new ForbiddenException(
          'Access denied: cannot access currencies for another company',
        );
      }
    }

    const companyCurrencies = await this.companyCurrencyEntity.find({
      where: { companyId: targetCompanyId },
      relations: ['currency'],
    });

    const activeCurrencies = companyCurrencies
      .map((cc) => cc.currency)
      .filter((c) => c && c.status === 'Active');

    return activeCurrencies;
  }
}
