import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { resolveAuthContext } from './auth-helper';

export const ROLES_KEY = 'roles';
export const COMPANY_SCOPED = 'company_scoped';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,

    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgRepo: Repository<UserCompanyGroupEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles: string[] =
      this.reflector.get(ROLES_KEY, context.getHandler()) || [];
    const companyScoped: boolean =
      this.reflector.get(COMPANY_SCOPED, context.getHandler()) || false;

    const request = context.switchToHttp().getRequest();
    const authCtx = await resolveAuthContext(request, this.ucgRepo);

    // Check required roles
    if (requiredRoles.length) {
      const hasRole = requiredRoles.includes(authCtx.activeGroupCode ?? '');
      if (!hasRole) throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
