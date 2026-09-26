import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/packages/config/multer.config';
import { GroupService } from './service/group.service';
import {
  getGroupListDto,
  GroupDto,
  GroupUpdateDto,
} from 'src/group/dto/group.dto';
import { AuthGuard } from '@nestjs/passport';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { RolesGuard } from 'src/utilities/roles.guard';
import { Roles } from 'src/utilities/roles.decorator';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get()
  async hello() {
    return 'hello';
  }

  @Post('group-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('groupAdd')
  @UseInterceptors(FileInterceptor('groupFile', multerConfig))
  async insertGroup(
    @Req() req,
    @Body() body: GroupDto,
    @UploadedFile() groupFile: Express.Multer.File,
  ) {
    const param = { ...body, addedBy: req.user.userId };
    const result = await this.groupService.startInsertGroup(param, req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('group-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('groupUpdate')
  async updateGroup(@Req() req, @Body() body: GroupUpdateDto) {
    try {
      const param = { ...body, updatedBy: req.user.userId };
      const result = await this.groupService.startUpdate(param, req);
      return { encrypted: encryptResponse(result) };
    } catch (err) {
      return { encrypted: encryptResponse(err) };
    }
  }

  @Post('group-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('groupList')
  async getGroups(@Req() req, @Body() body: getGroupListDto) {
    const result = await this.groupService.getGroups(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Post('group-dropdown-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('userUpdate')
  async getGroupsForDropdown(@Req() req) {
    const result = await this.groupService.getGroupsForDropdown(req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('group-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('groupView')
  async getGroup(@Req() req, @Param('id') param) {
    const result = await this.groupService.getGroup(param, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('permissions-all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async getAllPermissions() {
    const result = await this.groupService.getAllPermissions();
    return { encrypted: encryptResponse(result) };
  }

  @Get('group-permissions/:groupId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async getGroupPermissions(@Param('groupId') groupId: string) {
    const result = await this.groupService.getGroupPermissions(Number(groupId));
    return { encrypted: encryptResponse(result) };
  }

  @Post('group-permissions-save')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async saveGroupPermissions(
    @Req() req: any,
    @Body() body: { groupId: number; permissions: string[] },
  ) {
    const result = await this.groupService.saveGroupPermissions(
      Number(body.groupId),
      body.permissions,
      req,
    );
    return { encrypted: encryptResponse(result) };
  }
}
