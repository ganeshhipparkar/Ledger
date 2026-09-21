import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { resolveAuthContext } from './auth-helper';

export const PERMISSION_KEY = 'permission';
export const RequirePermission =
  (permission: string) =>
  (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(PERMISSION_KEY, permission, descriptor.value);
    return descriptor;
  };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(UserCompanyGroupEntity)
    private ucgRepo: Repository<UserCompanyGroupEntity>,
    @InjectRepository(GroupPermissionEntity)
    private gpRepo: Repository<GroupPermissionEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const authCtx = await resolveAuthContext(req, this.ucgRepo);

    if (authCtx.isSuperAdmin) return true;

    const permission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) return true;

    const perm = await this.gpRepo
      .createQueryBuilder('gp')
      .innerJoin('gp.permission', 'p')
      .where('gp.groupId = :groupId', { groupId: authCtx.activeGroupId })
      .andWhere('p.permissionName = :name', { name: permission })
      .getOne();

    if (!perm)
      throw new ForbiddenException(`Missing permission: ${permission}`);
    return true;
  }
}

// @Injectable()
// export class StrictPermissionsGuard implements CanActivate {
//   constructor(
//     private reflector: Reflector,
//     @InjectRepository(UserCompanyGroupEntity)
//     private ucgRepo: Repository<UserCompanyGroupEntity>,
//     @InjectRepository(GroupPermissionEntity)
//     private gpRepo: Repository<GroupPermissionEntity>,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const req = context.switchToHttp().getRequest();

//     // Always resolve auth context so req.isSuperAdmin and req.scopedCompanyIds are set
//     const authCtx = await resolveAuthContext(req, this.ucgRepo);

//     const permission = this.reflector.get<string>(
//       PERMISSION_KEY,
//       context.getHandler(),
//     );
//     if (!permission) return true;

//     const perm = await this.gpRepo
//       .createQueryBuilder('gp')
//       .innerJoin('gp.permission', 'p')
//       .where('gp.groupId = :groupId', { groupId: authCtx.activeGroupId })
//       .andWhere('p.permissionName = :name', { name: permission })
//       .getOne();

//     if (!perm)
//       throw new ForbiddenException(`Missing permission: ${permission}`);
//     return true;
//   }
// }
