import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { resolveAuthContext } from './auth-helper';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import type Redis from 'ioredis';

export const PERMISSION_KEY = 'permission';
export const RequirePermission =
  (permission: string) =>
  (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(PERMISSION_KEY, permission, descriptor.value);
    return descriptor;
  };

 const permKey = (groupId: number) => `perm:group:${groupId}`;

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    @InjectRepository(UserCompanyGroupEntity)
    private ucgRepo: Repository<UserCompanyGroupEntity>,
    @InjectRepository(GroupPermissionEntity)
    private gpRepo: Repository<GroupPermissionEntity>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
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

    const hasPermission = await this.checkPermission(
      authCtx.activeGroupId,
      permission,
    );

    if (!hasPermission)
      throw new ForbiddenException(`Missing permission: ${permission}`);
    return true;
  }
 
  private async checkPermission(
    groupId: number,
    permission: string,
  ): Promise<boolean> {
     try {
      const cached = await this.redis.get(permKey(groupId));
      if (cached !== null) {
        const permNames: string[] = JSON.parse(cached);
        return permNames.includes(permission);
      }
    } catch (err: any) {
       this.logger.warn(
        `Redis unavailable for perm cache read (group ${groupId}): ${err?.message}`,
      );
    }

     const rows = await this.gpRepo
      .createQueryBuilder('gp')
      .innerJoin('gp.permission', 'p')
      .select('p.permissionName', 'permissionName')
      .where('gp.groupId = :groupId', { groupId })
      .getRawMany<{ permissionName: string }>();

    const permNames = rows.map((r) => r.permissionName);

     try {
      await this.redis.set(permKey(groupId), JSON.stringify(permNames));
    } catch (err: any) {
       this.logger.warn(
        `Redis unavailable for perm cache write (group ${groupId}): ${err?.message}`,
      );
    }

    return permNames.includes(permission);
  }
}
