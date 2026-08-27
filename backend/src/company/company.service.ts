import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityCode } from '../activity/enums/activity-code.enum';
import { FileTransfer } from 'src/utilities/file.transfer';
import { Filter } from 'src/utilities/filter';
import { Mailer } from 'src/utilities/mailer';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { CompanyCurrencyEntity } from 'src/packages/entity/company.currency.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { CompanyEntity } from './entity/company.entity';

@Injectable()
export class CompanyService {
  constructor(
    private readonly fileTransfer: FileTransfer,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly mailer!: Mailer;

  @InjectRepository(CompanyEntity)
  protected companyEntity!: Repository<CompanyEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  protected ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(CurrencyEntity)
  protected currencyEntity!: Repository<CurrencyEntity>;

  @InjectRepository(CompanyCurrencyEntity)
  protected companyCurrencyEntity!: Repository<CompanyCurrencyEntity>;

  async startInsertCompany(params: any, companyFile: any, req?: any) {
    const res = await this.insertCompany(params, companyFile, req);
    if (res.success === 1) {
      return this.finishSuccess(res, params, companyFile);
    }
    return this.finishFailure(res);
  }

  async insertCompany(params: any, companyFile: any, req?: any) {
    try {
      let codeExists = false;
      let emailExists = false;
      if (params.companyCode) {
        const existingCode = await this.companyEntity.findOne({
          where: { companyCode: params.companyCode },
        });
        if (existingCode) codeExists = true;
      }
      if (params.email) {
        const existingEmail = await this.companyEntity.findOne({
          where: { email: params.email },
        });
        if (existingEmail) emailExists = true;
      }

      if (codeExists && emailExists) {
        return { success: 0, message: 'Company code and Email already exist' };
      } else if (codeExists) {
        return { success: 0, message: 'Company code already exists' };
      } else if (emailExists) {
        return { success: 0, message: 'Email already exists' };
      }

      const queryParams: any = {};
      if (params.companyName) queryParams.companyName = params.companyName;
      if (params.companyCode) queryParams.companyCode = params.companyCode;
      if (params.status) queryParams.status = params.status;
      if (params.email) queryParams.email = params.email;
      if (params.website) queryParams.website = params.website;
      if (params.dialCode) queryParams.dialCode = Number(params.dialCode);
      if (params.phone) queryParams.phone = params.phone;
      if (params.country) queryParams.country = params.country;
      if (params.state) queryParams.state = params.state;
      if (params.city) queryParams.city = params.city;
      if (params.postalCode) queryParams.postalCode = Number(params.postalCode);
      if (params.AddressLineOne)
        queryParams.AddressLineOne = params.AddressLineOne;
      if (params.ownerName) queryParams.ownerName = params.ownerName;
      if (params.ownerEmail) queryParams.ownerEmail = params.ownerEmail;
      if (params.ownerPhone) queryParams.ownerPhone = params.ownerPhone;
      if (params.ownerDialCode) {
        queryParams.ownerDialCode = Number(params.ownerDialCode);
      } 
      if (companyFile) queryParams.companyFile = companyFile.filename;
      if (params.addedBy) queryParams.addedBy = Number(params.addedBy);

      if (params.parentCompanyId !== undefined && params.parentCompanyId !== null && params.parentCompanyId !== '') {
        const parentId = Number(params.parentCompanyId);
        const parentComp = await this.companyEntity.findOne({
          where: { companyId: parentId },
        });
        if (!parentComp) {
          return { success: 0, message: 'Parent company not found' };
        }
        queryParams.parentCompanyId = parentId;
      }

      const result = await this.companyEntity.insert(queryParams);
      const insertId = result?.raw?.insertId;

      if (params.curIds && Array.isArray(params.curIds) && insertId) {
        const currencyInsertions = params.curIds.map((curId: number) => ({
          companyId: insertId,
          curId: Number(curId),
        }));
        if (currencyInsertions.length > 0) {
          await this.companyCurrencyEntity.insert(currencyInsertions);
        }
      }

      const performerId = req?.user?.isImpersonation ? req?.user?.impersonatedBy : (req?.user?.userId ?? params.addedBy);
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
        activityCode: ActivityCode.COMPANY_CREATE,
        userId: performerId,
        companyId: insertId,
        actorType: 'USER',
        targetType: 'COMPANY',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: { 
          userEmail: performerEmail,
          userGroup: performerUcg?.group?.groupName || 'N/A',
          companyName: params.companyName, 
          companyCode: params.companyCode, 
          email: params.email,
          impersonated: !!req?.user?.isImpersonation
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      const errMsg = err?.message || '';
      const driverMsg = err?.driverError?.message || '';
      if (
        err?.code === 'ER_DUP_ENTRY' ||
        errMsg.includes('Duplicate entry') ||
        driverMsg.includes('Duplicate entry')
      ) {
        if (
          errMsg.includes('companyCode') ||
          driverMsg.includes('companyCode')
        ) {
          return { success: 0, message: 'Company code already exists' };
        }
        if (errMsg.includes('email') || driverMsg.includes('email')) {
          return { success: 0, message: 'Email already exists' };
        }
        return { success: 0, message: 'Company code or Email already exists' };
      }
      return { success: 0, message: err?.message };
    }
  }

  async finishSuccess(res: any, params: any, companyFile: any) {
    const output: any = {
      settings: {
        id: res?.data?.insertData,
        success: res?.success,
        message: res?.message,
        data: params,
      },
    };

    const fid: number = parseInt(output.settings.id);
    if (companyFile?.filename) {
      await this.fileTransfer.fileTransfer(companyFile.filename, fid, 'company', { deleteExisting: true });
    }

    return output;
  }

  async finishFailure(res: any) {
    return res;
  }

  async startUpdate(params: any, companyFile: any, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    if (!authCtx.isSuperAdmin) {
      const scoped = req?.scopedCompanyIds || [authCtx.activeCompanyId];
      if (!scoped.includes(Number(params.companyId))) {
        return {
          success: 0,
          message: 'Access denied: cannot modify another company',
        };
      }
    }
    const res = await this.updateCompany(params, companyFile, req);
    if (res.success === 1) {
      return this.updateSuccess(res, params);
    }
    return this.finishFailure(res);
  }

  async updateCompany(params: any, companyFile: any, req?: any) {
    if (!params.companyId)
      return { success: 0, message: 'companyId is mandatory' };

    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      if (!authCtx.isSuperAdmin) {
        const scoped = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scoped.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot modify another company',
          };
        }
      }

      const queryParams: any = {};

      if (params.parentCompanyId !== undefined) {
        if (
          params.parentCompanyId === null ||
          params.parentCompanyId === '' ||
          params.parentCompanyId === 'null'
        ) {
          queryParams.parentCompanyId = null;
        } else {
          const newParentId = Number(params.parentCompanyId);
          const targetCompanyId = Number(params.companyId);

          if (newParentId === targetCompanyId) {
            return {
              success: 0,
              message: 'A company cannot be its own parent',
            };
          }

          const parentComp = await this.companyEntity.findOne({
            where: { companyId: newParentId },
            select:{companyId:true}
          });
          if (!parentComp) {
            return { success: 0, message: 'Parent company not found' };
          }

          let currentId: number | null = newParentId;
          const visited = new Set<number>();
          while (currentId !== null) {
            if (currentId === targetCompanyId) {
              return {
                success: 0,
                message:
                  'Cannot set parent company: would create a circular dependency',
              };
            }
            if (visited.has(currentId)) break;
            visited.add(currentId);

            const ancestor = await this.companyEntity.findOne({
              where: { companyId: currentId },
              select: {'companyId':true, 'parentCompanyId':true},
            });
            currentId = ancestor?.parentCompanyId
              ? Number(ancestor.parentCompanyId)
              : null;
          }

          queryParams.parentCompanyId = newParentId;
        }
      }

      let codeExists = false;
      let emailExists = false;
      if (params.companyCode) {
        const existingCode = await this.companyEntity.findOne({
          where: {
            companyCode: params.companyCode,
            companyId: Not(Number(params.companyId)),
          },
          select:{companyCode:true}
        });
        if (existingCode) codeExists = true;
      }
      if (params.email) {
        const existingEmail = await this.companyEntity.findOne({
          where: {
            email: params.email,
            companyId: Not(Number(params.companyId)),
          },
          select:{email:true}
        });
        if (existingEmail) emailExists = true;
      }

      if (codeExists && emailExists) {
        return { success: 0, message: 'Company code and Email already exist' };
      } else if (codeExists) {
        return { success: 0, message: 'Company code already exists' };
      } else if (emailExists) {
        return { success: 0, message: 'Email already exists' };
      }

      if (params.companyName) queryParams.companyName = params.companyName;
      if (params.companyCode) queryParams.companyCode = params.companyCode;
      if (params.companyLocation)
        queryParams.companyLocation = params.companyLocation;
      if (params.status) queryParams.status = params.status;
      if (params.email) queryParams.email = params.email;
      if (params.website) queryParams.website = params.website;
      if (params.dialCode) queryParams.dialCode = Number(params.dialCode);
      if (params.phone) queryParams.phone = params.phone;
      if (params.country) queryParams.country = params.country;
      if (params.state) queryParams.state = params.state;
      if (params.city) queryParams.city = params.city;
      if (params.postalCode) queryParams.postalCode = Number(params.postalCode);
      if (params.AddressLineOne)
        queryParams.AddressLineOne = params.AddressLineOne;
      if (params.ownerName) queryParams.ownerName = params.ownerName;
      if (params.ownerEmail) queryParams.ownerEmail = params.ownerEmail;
      if (params.ownerPhone) queryParams.ownerPhone = params.ownerPhone;
      if (params.ownerDialCode) {
        queryParams.ownerDialCode = Number(params.ownerDialCode);
      } 
      if (companyFile) {
        queryParams.companyFile = companyFile.filename;
      } else if (params.removeCompanyFile === 'true') {
        queryParams.companyFile = null;
      }
      if (params.updatedBy) queryParams.updatedBy = Number(params.updatedBy);

      queryParams.updatedDate = () => 'NOW()';

      // Perform all database modifications in a transaction
      await this.dataSource.transaction(async (manager) => {
        await manager.update(
          CompanyEntity,
          { companyId: params.companyId },
          queryParams,
        );

        if (params.curIds && Array.isArray(params.curIds)) {
          const existingMappings = await manager.find(CompanyCurrencyEntity, {
            where: { companyId: Number(params.companyId) },
            select: ['id', 'curId'],
          });

          const currentCurIds = new Set<number>(
            existingMappings.map((m) => Number(m.curId)),
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
            await manager.delete(CompanyCurrencyEntity, {
              id: In(toRemove.map((m) => m.id)),
            });
          }

          if (toAdd.length > 0) {
            await manager.insert(
              CompanyCurrencyEntity,
              toAdd.map((curId: number) => ({
                companyId: Number(params.companyId),
                curId,
              })),
            );
          }
        }
      });

      if (companyFile) {
        await this.fileTransfer.fileTransfer(
          companyFile.filename,
          params.companyId,
          'company',
          { deleteExisting: true },
        );
      }


      const performerId = req?.user?.isImpersonation ? req?.user?.impersonatedBy : (req?.user?.userId ?? params.updatedBy);
      const performerEmail = req?.user?.isImpersonation ? req?.user?.impersonatorEmail : (req?.user?.email ?? '');

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.COMPANY_UPDATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'COMPANY',
        targetId: String(params.companyId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: { 
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          companyName: params.companyName, 
          companyCode: params.companyCode, 
          email: params.email, 
          status: params.status,
          impersonated: !!req?.user?.isImpersonation
        },
        metadata: {},
      });

      return { success: 1, message: 'Updated successfully' };
    } catch (err: any) {
      const errMsg = err?.message || '';
      const driverMsg = err?.driverError?.message || '';
      if (
        err?.code === 'ER_DUP_ENTRY' ||
        errMsg.includes('Duplicate entry') ||
        driverMsg.includes('Duplicate entry')
      ) {
        if (
          errMsg.includes('companyCode') ||
          driverMsg.includes('companyCode')
        ) {
          return { success: 0, message: 'Company code already exists' };
        }
        if (errMsg.includes('email') || driverMsg.includes('email')) {
          return { success: 0, message: 'Email already exists' };
        }
        return { success: 0, message: 'Company code or Email already exists' };
      }
      return { success: 0, message: err?.message };
    }
  }
  async updateSuccess(result: any, params: any) {
    return { status: result, data: params };
  }

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
