import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Filter } from 'src/utilities/filter';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { PermissionEntity, GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { GroupEntity } from '../entity/group.entity';

@Injectable()
export class GroupListService {
  @Inject()
  private readonly filter?: Filter;

  @InjectRepository(GroupEntity)  
  protected groupEntity!: Repository<GroupEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  protected ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(PermissionEntity)
  protected permissionEntity!: Repository<PermissionEntity>;

  @InjectRepository(GroupPermissionEntity)
  protected groupPermissionEntity!: Repository<GroupPermissionEntity>;

  async getGroups(param: any, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.groupEntity?.createQueryBuilder('group');
      const queryString = await this.filter!.makeFilterString(
        param?.filters,
        'group',
      );
      if (queryString && queryString !== '') queryBuilder.andWhere(queryString);

      const [skip, limit] = (await this.filter?.calcPages(
        param,
        this.groupEntity,
      )) as [number, number];
      queryBuilder.skip(skip).take(limit);
      queryBuilder.andWhere('group.groupCode != :code', {
        code: 'admin',
      });

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        queryBuilder.leftJoin(
          UserCompanyGroupEntity,
          'creator_ucg',
          'creator_ucg.userId = group.addedBy',
        );
        queryBuilder.andWhere(
          '(group.addedBy IS NULL OR creator_ucg.companyId IN (:...scopedCompanyIds))',
          { scopedCompanyIds },
        );
      }

      queryBuilder.orderBy('group.groupName', 'ASC');

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

  async getGroupsForDropdown(req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.groupEntity?.createQueryBuilder('group');
      
      queryBuilder.select(['group.groupId', 'group.groupName', 'group.status']);
      queryBuilder.where('group.status = :status', { status: 'active' });
      queryBuilder.andWhere('group.groupCode != :code', { code: 'admin' });

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        queryBuilder.leftJoin(
          UserCompanyGroupEntity,
          'creator_ucg',
          'creator_ucg.userId = group.addedBy',
        );
        queryBuilder.andWhere(
          '(group.addedBy IS NULL OR creator_ucg.companyId IN (:...scopedCompanyIds))',
          { scopedCompanyIds },
        );
      }

      const data = await queryBuilder.getMany();
      return { success: 1, data };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async getGroup(query: any, req?: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const groupId = Number(query);

      const group = await this.groupEntity.findOne({ where: { groupId } });
      if (!group) throw new NotFoundException('Group not found');

      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!authCtx.isSuperAdmin && group.addedBy !== null) {
        const creatorUcg = await this.ucgEntity.findOne({
          where: { userId: group.addedBy, companyId: In(scopedCompanyIds) },
        });
        if (!creatorUcg) {
          throw new ForbiddenException(
            'Access denied: group belongs to another company',
          );
        }
      }

      const userRepo = this.groupEntity.manager.getRepository(UserEntity);
      const [assignments, addedByUser, updatedByUser] = await Promise.all([
        this.ucgEntity.find({
          where: {
            groupId,
            ...(authCtx.isSuperAdmin
              ? {}
              : { companyId: In(scopedCompanyIds) }),
          },
          relations: { user: true, company: true },
          select: {
            id: true, userId: true, companyId: true, groupId: true, is_parent: true,
            user: { name: true, email: true },
            company: { companyName: true },
          },
        }),
        group.addedBy
          ? userRepo.findOne({
              where: { userId: group.addedBy },
              select: ['name'],
            })
          : null,
        group.updatedBy
          ? userRepo.findOne({
              where: { userId: group.updatedBy },
              select: ['name'],
            })
          : null,
      ]);

      return {
        ...group,
        addedByName: addedByUser?.name ?? null,
        updatedByName: updatedByUser?.name ?? null,
        assignments: assignments.map((ucg) => ({
          userId: ucg.userId,
          userName: ucg.user?.name,
          userEmail: ucg.user?.email,
          companyId: ucg.companyId,
          companyName: ucg.company?.companyName,
          is_parent: ucg.is_parent,
        })),
      };
    } catch (err) {
      return err;
    }
  }

  async getAllPermissions() {
    try {
      const permissions = await this.permissionEntity.find();
      return { success: 1, data: permissions };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async getGroupPermissions(groupId: number) {
    try {
      const groupPerms = await this.groupPermissionEntity.find({
        where: { groupId },
        relations: { permission: true },
        select: { id: true, groupId: true, permission: { permissionName: true } },
      });
      const permissions = groupPerms
        .map((gp) => gp.permission?.permissionName)
        .filter(Boolean);
      return { success: 1, groupId, permissions };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}
