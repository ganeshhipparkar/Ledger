import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';

@Injectable()
export class UserListService {
  private calculateAge(dobInput: Date | string | null | undefined): number | null {
    if (!dobInput) return null;
    const dob = new Date(dobInput);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  constructor(
    private readonly filter: Filter,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    @InjectRepository(GroupPermissionEntity)
    private readonly groupPermissionEntity: Repository<GroupPermissionEntity>,
  ) {}

  async getUsers(param: any, req?: any) {
    let return_data: any = {};
    try {
      
      const baseQB = this.userEntity
        .createQueryBuilder('user')
        .leftJoin('user.userCompanyGroups', 'ucg')
        .leftJoin('ucg.company', 'company')
        .leftJoin('ucg.group', 'group')
        .orderBy('user.name', 'ASC');

      if (req?.user?.userId) {
        baseQB.andWhere('user.userId != :loggedInUserId', {
          loggedInUserId: req.user.userId,
        });
      }

      if (req?.scopedCompanyIds?.length) {
        baseQB.andWhere('ucg.companyId IN (:...companyIds)', {
          companyIds: req.scopedCompanyIds,
        });
      }

      const filterString = await this.filter.makeFilterString(
        param?.filters,
        'user',
        { groupName: 'group', companyName: 'company' },
        param?.condition === 'Any' ? 'Any' : 'All',
      );

      if (filterString && filterString !== '')
        baseQB.andWhere(`(${filterString})`);

      const allIds = await baseQB.select('user.userId').getMany();
      const total = allIds.length;

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.userEntity,
      )) as [number, number];
      const pageIds = allIds
        .slice(skip, skip + limit)
        .map((u: any) => u.userId);

      const data = pageIds.length
        ? await this.userEntity
            .createQueryBuilder('user')
            .whereInIds(pageIds)
            .select([
              'user.userId', 'user.name', 'user.email', 'user.firstName', 'user.surname',
              'user.phone', 'user.dialCode', 'user.status', 'user.userFile', 'user.dob',
            ])
            .leftJoin('user.userCompanyGroups', 'ucg')
            .addSelect(['ucg.id', 'ucg.companyId', 'ucg.groupId', 'ucg.is_parent'])
            .leftJoin('ucg.company', 'company')
            .addSelect(['company.companyId', 'company.companyName'])
            .leftJoin('ucg.group', 'group')
            .addSelect(['group.groupId', 'group.groupName', 'group.groupCode'])
            .orderBy('user.name', 'ASC')
            .getMany()
        : [];

      const formattedData = data.map((user) => {
        const allAssignments = user.userCompanyGroups ?? [];
        const primary = req?.scopedCompanyIds?.length
          ? (allAssignments.find((a) =>
              req.scopedCompanyIds.includes(a.companyId)) ??
            allAssignments.find((a) => a.is_parent === 0) ??
            allAssignments[0] ??
            null)
          : (allAssignments.find((a) => a.is_parent === 0) ??
            allAssignments[0] ??
            null);
        return {
          userId: user.userId,
          name: user.name,
          email: user.email,
          firstName: user?.firstName,
          surname: user?.surname,
          phone: user.phone,
          dialCode: user?.dialCode,
          status: user.status,
          userFile: user.userFile,
          dob: user.dob,
          age: this.calculateAge(user.dob),
          assignments: primary
            ? [
                {
                  id: primary.id,
                  companyId: primary.companyId,
                  companyName: primary.company?.companyName,
                  groupId: primary.groupId,
                  groupName: primary.group?.groupName,
                  groupCode: primary.group?.groupCode ?? null,
                  is_parent: primary.is_parent,
                },
              ]
            : [],
        };
      });

      return_data = {
        success: 1,
        message: 'List fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getUser(query: any, req?: any) {
    try {
      const targetId = Number(query.id ?? query);
      const profileId = query.profileId ? Number(query.profileId) : null;

      const user = await this.userEntity.findOne({
        where: { userId: targetId },
        relations: { userCompanyGroups: { company: true, group: true } },
        select: {
          userId: true, name: true, firstName: true, middleName: true, surname: true,
          email: true, dob: true, dialCode: true, phone: true, alternatePhone: true,
          status: true, remarks: true, createdBy: true, updatedBy: true,
          userFile: true, createdAt: true, updatedDate: true,
          userCompanyGroups: {
            id: true, companyId: true, groupId: true, is_parent: true,
            company: { companyName: true },
            group: { groupName: true, groupCode: true },
          },
        },
      });

      if (!user) return { success: 0, message: 'User not found' };

      if (!req?.isSuperAdmin && req?.scopedCompanyIds?.length) {
        const userCompanyIds = (user.userCompanyGroups ?? []).map(
          (ucg) => ucg.companyId,
        );
        const hasAccess = userCompanyIds.some((id) =>
          req.scopedCompanyIds.includes(id),
        );
        if (!hasAccess) {
          return {
            success: 0,
            message:
              'Access denied. This user does not belong to your company.',
          };
        }
      }

      const [createdByUser, updatedByUser] = await Promise.all([
        user.createdBy
          ? this.userEntity.findOne({
              where: { userId: user.createdBy },
              select: ['name'],
            })
          : null,
        user.updatedBy
          ? this.userEntity.findOne({
              where: { userId: user.updatedBy },
              select: ['name'],
            })
          : null,
      ]);

      const allAssignments = user.userCompanyGroups ?? [];

      const activeAssignment =
        profileId != null
          ? (allAssignments.find((u) => u.id === profileId) ?? null)
          : req?.scopedCompanyIds?.length
            ? (allAssignments.find((a) =>
                req.scopedCompanyIds.includes(a.companyId)) ??
              allAssignments.find((u) => u.is_parent === 0) ??
              allAssignments[0] ??
              null)
            : (allAssignments.find((u) => u.is_parent === 0) ??
              allAssignments[0] ??
              null);

      const mapAssignment = (ucg: any) => ({
        id: ucg.id,
        companyId: ucg.companyId,
        companyName: ucg.company?.companyName ?? null,
        groupId: ucg.groupId,
        groupName: ucg.group?.groupName ?? null,
        groupCode: ucg.group?.groupCode ?? null,
        is_parent: ucg.is_parent,
      });

      const primary =
        allAssignments.find((u) => u.is_parent === 0) ??
        allAssignments[0] ??
        null;

      const groupId = activeAssignment?.groupId;
      const groupPerms = groupId
        ? await this.groupPermissionEntity.find({
            where: { groupId },
            relations: { permission: true },
            select: { id: true, groupId: true, permission: { permissionName: true } },
          })
        : [];
      const permissions = groupPerms
        .map((gp) => gp.permission?.permissionName)
        .filter(Boolean);

      return {
        userId: user.userId,
        name: user.name,
        firstName: user.firstName,
        middleName: user.middleName,
        surname: user.surname,
        email: user.email,
        dob: user.dob,
        age: this.calculateAge(user.dob),
        dialCode: user?.dialCode,
        phone: user.phone,
        status: user.status,
        remarks: user.remarks,
        createdBy: createdByUser?.name ?? null,
        createdById: user.createdBy ?? null,
        updatedBy: updatedByUser?.name ?? null,
        updatedById: user.updatedBy ?? null,
        userFile: user.userFile,
        createdAt: user.createdAt,
        updatedDate: user.updatedDate,
        primaryProfile: primary
          ? {
              companyName: primary.company?.companyName ?? null,
              groupName: primary.group?.groupName ?? null,
              groupCode: primary.group?.groupCode ?? null,
              is_parent: primary.is_parent,
            }
          : null,
        activeAssignment: activeAssignment
          ? mapAssignment(activeAssignment)
          : null,
        assignments: allAssignments.map(mapAssignment),
        permissions,
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}
