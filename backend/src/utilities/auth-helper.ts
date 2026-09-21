import { Repository } from 'typeorm';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { ForbiddenException } from '@nestjs/common';
import { CompanyEntity } from 'src/company/entity/company.entity';

export interface AuthContext {
  isSuperAdmin: boolean;
  activeCompanyId: number;
  activeGroupId: number;
  activeGroupName: string | null;
  activeGroupCode: string | null;
  scopedCompanyIds: number[];
}

export async function resolveAuthContext(
  req: any,
  ucgRepo: Repository<UserCompanyGroupEntity>,
): Promise<AuthContext> {
  if (req && req.activeProfileResolved) {
    return {
      isSuperAdmin: req.isSuperAdmin,
      activeCompanyId: req.activeCompanyId,
      activeGroupId: req.activeGroupId,
      activeGroupName: req.activeGroupName,
      activeGroupCode: req.activeGroupCode || null,
      scopedCompanyIds: req.scopedCompanyIds || [],
    };
  }

  const userId = req?.user?.userId;
  if (!userId) {
    throw new ForbiddenException('Not authenticated');
  }

  const profileId = req?.user?.profileId;

  const ucg = profileId
    ? ((await ucgRepo.findOne({
        where: { id: profileId, userId },
        relations: ['group'],
      })) ??
      (await ucgRepo.findOne({
        where: { userId, is_parent: 0 },
        relations: ['group'],
      })) ??
      (await ucgRepo.findOne({
        where: { userId },
        relations: ['group'],
      })))
    : ((await ucgRepo.findOne({
        where: { userId, is_parent: 0 },
        relations: ['group'],
      })) ??
      (await ucgRepo.findOne({
        where: { userId },
        relations: ['group'],
      })));

  if (!ucg) {
    throw new ForbiddenException('No profile assigned');
  }

  const isSuperAdmin = ucg.group?.groupCode === 'admin';
  let scopedCompanyIds: number[] = [];

  if (!isSuperAdmin) {
    const companyRepo = ucgRepo.manager.getRepository(CompanyEntity);
    const directChildren = await companyRepo.find({
      where: { parentCompanyId: Number(ucg.companyId) },
      select: ['companyId'],
    });

    scopedCompanyIds = [
      Number(ucg.companyId),
      ...directChildren.map((c) => Number(c.companyId)),
    ];
  }

  const context: AuthContext = {
    isSuperAdmin,
    activeCompanyId: ucg.companyId,
    activeGroupId: ucg.groupId,
    activeGroupName: ucg.group?.groupName || null,
    activeGroupCode: ucg.group?.groupCode || null,
    scopedCompanyIds,
  };

  if (req) {
    req.isSuperAdmin = context.isSuperAdmin;
    req.activeCompanyId = context.activeCompanyId;
    req.activeGroupId = context.activeGroupId;
    req.activeGroupName = context.activeGroupName;
    req.activeGroupCode = context.activeGroupCode;
    req.scopedCompanyIds = context.scopedCompanyIds;
    req.userRoles = [ucg.group?.groupCode].filter(Boolean);
    req.activeProfileResolved = true;
  }

  return context;
}


  // if (!isSuperAdmin) {
  //   const companyRepo = ucgRepo.manager.getRepository(CompanyEntity);
  //   const allCompanies = await companyRepo.find({
  //     select: ['companyId', 'parentCompanyId'],
  //   });
  //
  //   const childrenMap = new Map<number, number[]>();
  //   for (const c of allCompanies) {
  //     if (c.parentCompanyId) {
  //       const parentId = Number(c.parentCompanyId);
  //       if (!childrenMap.has(parentId)) {
  //         childrenMap.set(parentId, []);
  //       }
  //       childrenMap.get(parentId)!.push(Number(c.companyId));
  //     }
  //   }
  //
  //   const visited = new Set<number>();
  //   const queue = [Number(ucg.companyId)];
  //
  //   while (queue.length > 0) {
  //     const currentId = queue.shift()!;
  //     if (!visited.has(currentId)) {
  //       visited.add(currentId);
  //       const children = childrenMap.get(currentId) || [];
  //       for (const childId of children) {
  //         if (!visited.has(childId)) {
  //           queue.push(childId);
  //         }
  //       }
  //     }
  //   }
  //
  //   scopedCompanyIds = Array.from(visited);
  // }

