import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityCode } from '../activity/enums/activity-code.enum';
import { CustomerEntity } from './entity/customer.entity';
import { CustomerCurrencyEntity } from './entity/customer.currency.entity';
import { CompanyCurrencyEntity } from 'src/packages/entity/company.currency.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { FileTransfer } from 'src/utilities/file.transfer';
import {
  CustomerListDto,
  CustomerDto,
  CustomerUpdateDto,
} from './dto/customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerEntity: Repository<CustomerEntity>,
    @InjectRepository(CustomerCurrencyEntity)
    private readonly customerCurrencyEntity: Repository<CustomerCurrencyEntity>,
    @InjectRepository(CompanyCurrencyEntity)
    private readonly companyCurrencyEntity: Repository<CompanyCurrencyEntity>,
    @InjectRepository(CurrencyEntity)
    private readonly currencyEntity: Repository<CurrencyEntity>,
    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
    private readonly fileTransfer: FileTransfer,
  ) {}

  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;

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

  private isFutureDate(dateVal: any): boolean {
    if (!dateVal) return false;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return d > today;
  }

  async insertCustomer(params: CustomerDto, customerLogo?: Express.Multer.File, req?: any) {
    try {
      if (!params.customerIncorporationDate || String(params.customerIncorporationDate).trim() === '') {
        return {
          success: 0,
          message: 'Incorporation date is mandatory',
        };
      }
      if (this.isFutureDate(params.customerIncorporationDate)) {
        return {
          success: 0,
          message: 'Incorporation date cannot be in the future',
        };
      }
      if (!params.ownerDob || String(params.ownerDob).trim() === '') {
        return {
          success: 0,
          message: 'Owner date of birth is mandatory',
        };
      }
      if (this.isFutureDate(params.ownerDob)) {
        return {
          success: 0,
          message: 'Owner date of birth cannot be in the future',
        };
      }

      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add customer to another company',
          };
        }
      }

      const customerCode = await this.codeGeneratorService.generateCode(
        this.customerEntity,
        params.customerName,
        params.companyId,
        'customerCode',
      );

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.addedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      const queryParams: any = {
        customerCode,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        dialCode: Number(params.dialCode),
        phone: params.phone,
        companyId: Number(params.companyId),
        country: params.country,
        state: params.state,
        ownerFirstName: params.ownerFirstName,
        ownerLastName: params.ownerLastName,
        ownerEmail: params.ownerEmail,
        ownerPhone: params.ownerPhone,
        status: params.status,
        createdDate: new Date(),
        updatedDate: new Date(),
      };

      if (customerLogo?.filename) {
        queryParams.customerLogo = customerLogo.filename;
      } else if (typeof params.customerLogo === 'string' && params.customerLogo) {
        queryParams.customerLogo = params.customerLogo;
      }

      if (params.customerIncorporationDate)
        queryParams.customerIncorporationDate = params.customerIncorporationDate;
      if (params.city) queryParams.city = params.city;
      if (params.AddressLineOne) queryParams.AddressLineOne = params.AddressLineOne;
      if (params.postalCode) queryParams.postalCode = Number(params.postalCode);
      if (params.ownerDialCode)
        queryParams.ownerDialCode = Number(params.ownerDialCode);
      if (params.ownerDob) queryParams.ownerDob = params.ownerDob;
      if (performerId) queryParams.addedBy = Number(performerId);

      const result = await this.customerEntity.insert(queryParams);
      const insertId = result?.raw?.insertId;

      if (customerLogo?.filename && insertId) {
        await this.fileTransfer.fileTransfer4(customerLogo.filename, insertId, insertId);
      }

      if (params.curIds && Array.isArray(params.curIds) && insertId) {
        const currencyInsertions = params.curIds.map((curId: number) => ({
          customerId: insertId,
          curId: Number(curId),
        }));
        if (currencyInsertions.length > 0) {
          await this.customerCurrencyEntity.insert(currencyInsertions);
        }
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.CUSTOMER_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'CUSTOMER',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          customerCode,
          customerName: params.customerName,
          companyId: params.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Customer inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateCustomer(params: CustomerUpdateDto, customerLogo?: Express.Multer.File, req?: any) {
    if (!params.customerId) {
      return { success: 0, message: 'customerId is mandatory' };
    }
    try {
      if (params.customerIncorporationDate !== undefined) {
        if (!params.customerIncorporationDate || String(params.customerIncorporationDate).trim() === '') {
          return {
            success: 0,
            message: 'Incorporation date cannot be empty',
          };
        }
        if (this.isFutureDate(params.customerIncorporationDate)) {
          return {
            success: 0,
            message: 'Incorporation date cannot be in the future',
          };
        }
      }
      if (params.ownerDob !== undefined) {
        if (!params.ownerDob || String(params.ownerDob).trim() === '') {
          return {
            success: 0,
            message: 'Owner date of birth cannot be empty',
          };
        }
        if (this.isFutureDate(params.ownerDob)) {
          return {
            success: 0,
            message: 'Owner date of birth cannot be in the future',
          };
        }
      }

      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const existingCustomer = await this.customerEntity.findOne({
        where: { customerId: Number(params.customerId) },
      });
      if (!existingCustomer) {
        return { success: 0, message: 'Customer not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingCustomer.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update customer of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.customerName !== undefined)
        queryParams.customerName = params.customerName;

      if (customerLogo?.filename) {
        queryParams.customerLogo = customerLogo.filename;
      } else if (params.removeCustomerLogo === 'true') {
        queryParams.customerLogo = null;
      } else if (params.customerLogo !== undefined) {
        queryParams.customerLogo = params.customerLogo;
      }

      if (params.customerEmail !== undefined)
        queryParams.customerEmail = params.customerEmail;
      if (params.customerIncorporationDate !== undefined)
        queryParams.customerIncorporationDate = params.customerIncorporationDate;
      if (params.dialCode !== undefined)
        queryParams.dialCode = Number(params.dialCode);
      if (params.phone !== undefined) queryParams.phone = params.phone;
      if (params.country !== undefined) queryParams.country = params.country;
      if (params.state !== undefined) queryParams.state = params.state;
      if (params.city !== undefined) queryParams.city = params.city;
      if (params.AddressLineOne !== undefined)
        queryParams.AddressLineOne = params.AddressLineOne;
      if (params.postalCode !== undefined)
        queryParams.postalCode = Number(params.postalCode);
      if (params.ownerFirstName !== undefined)
        queryParams.ownerFirstName = params.ownerFirstName;
      if (params.ownerLastName !== undefined)
        queryParams.ownerLastName = params.ownerLastName;
      if (params.ownerEmail !== undefined)
        queryParams.ownerEmail = params.ownerEmail;
      if (params.ownerPhone !== undefined)
        queryParams.ownerPhone = params.ownerPhone;
      if (params.ownerDialCode !== undefined)
        queryParams.ownerDialCode = Number(params.ownerDialCode);
      if (params.ownerDob !== undefined) queryParams.ownerDob = params.ownerDob;
      if (params.status !== undefined) queryParams.status = params.status;
      
      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.updatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      await this.dataSource.transaction(async (manager) => {
        await manager.update(
          CustomerEntity,
          { customerId: Number(params.customerId) },
          queryParams,
        );

        if (params.curIds && Array.isArray(params.curIds)) {
          const existingMappings = await manager.find(CustomerCurrencyEntity, {
            where: { customerId: Number(params.customerId) },
            select: ['id', 'curId'],
          });

          const currentCurIds = new Set<number>(
            existingMappings
              .map((m) => Number(m.curId))
              .filter((id) => !isNaN(id)),
          );
          const incomingCurIds = new Set<number>(
            params.curIds.map((id: any) => Number(id)),
          );

          const toRemove = existingMappings.filter(
            (m) => !incomingCurIds.has(Number(m.curId)),
          );
          const toAdd: number[] = Array.from(incomingCurIds).filter(
            (curId: number) => !currentCurIds.has(curId),
          );

          if (toRemove.length > 0) {
            await manager.delete(CustomerCurrencyEntity, {
              id: In(toRemove.map((m) => m.id)),
            });
          }

          if (toAdd.length > 0) {
            await manager.insert(
              CustomerCurrencyEntity,
              toAdd.map((curId: number) => ({
                customerId: Number(params.customerId),
                curId,
              })),
            );
          }
        }
      });

      if (customerLogo?.filename) {
        await this.fileTransfer.fileTransfer4(
          customerLogo.filename,
          params.customerId,
          params.customerId,
        );
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.CUSTOMER_UPDATE,
        userId: performerId,
        companyId: existingCustomer.companyId,
        actorType: 'USER',
        targetType: 'CUSTOMER',
        targetId: String(params.customerId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          customerCode: existingCustomer.customerCode,
          customerName:
            params.customerName ?? existingCustomer.customerName,
          status: params.status ?? existingCustomer.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Customer updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
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