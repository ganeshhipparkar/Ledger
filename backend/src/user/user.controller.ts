import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/packages/config/multer.config';
import {
  adminResetPass,
  changePass,
  confirmOtp,
  forgotPass,
  getUserListDto,
  login,
  resetpass,
  selectProfileDto,
  UserDto,
  userUpdateDto,
} from 'src/user/dto/user.dto';
import { encryptResponse } from 'src/utilities/crypto';
import { AuthGuard } from '@nestjs/passport';
import { Roles, CompanyScoped } from 'src/utilities/roles.decorator';
import { RolesGuard } from 'src/utilities/roles.guard';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async hello() {
    return 'hello';
  }

  @Post('user-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('userAdd')
  @UseInterceptors(FileInterceptor('userFile', multerConfig))
  async insertUser(
    @Req() req,
    @Body() body: UserDto,
    @UploadedFile() userFile: Express.Multer.File,
  ) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (userFile && !allowedTypes.includes(userFile.mimetype)) {
      return { status: 0, message: 'Invalid file type' };
    }

    const result = await this.userService.startInsertUser(body, userFile, req);
    return {
      encrypted: encryptResponse(result),
    };
  }

  @Put('user-changepass')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('userFile', multerConfig))
  async ChangePass(@Body() body: changePass) {
    // console.log(body,"##########################controller")
    return await this.userService.startChangePass(body);
  }

    // let result =await this.userService.startChangePass(body);
    // return{
    //    encrypted: encryptResponse(result)
    // }
  @Put('user-admin-reset-pass')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('superAdmin')
  async adminResetPassword(@Body() body: adminResetPass) {
    return await this.userService.adminResetPassword(body);
  }

  @Put('user-forgotpass')
  @UseInterceptors(FileInterceptor('userFile', multerConfig))
  async updatePass(@Body() body: forgotPass) {
    return await this.userService.startForgotPass(body);
  }

  @Put('user-update')
  @Roles('superAdmin', 'companyAdmin', 'warehouseAdmin')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('userUpdate')
  @UseInterceptors(FileInterceptor('userFile', multerConfig))
  async updateUser(
    @Req() req,
    @Body() body: userUpdateDto,
    @UploadedFile() userFile: Express.Multer.File,
  ) {
    try {
      if (userFile) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(userFile.mimetype)) {
          return { status: 0, message: 'Invalid file type' };
        }
      }
      // console.log(body,",############################## in the update controller")

      const result = await this.userService.startUpdate(body, userFile, req);

      return {
        encrypted: encryptResponse(result),
      };
    } catch (err) {
      return err;
    }
  }

  @Post('user-login')
  @UseInterceptors(FileInterceptor('userFile', multerConfig))
  async login(@Body() body: login, @Res({ passthrough: true }) response: any) {
    const result = await this.userService.login(body);
    return {
      encrypted: encryptResponse(result),
    };
  }

  @Post('user-select-profile')
  @UseInterceptors(FileInterceptor('userFile', multerConfig))
  async selectProfile(
    @Body() body: selectProfileDto,
    @Res({ passthrough: true }) response: any,
  ) {
    // Step 2: verify ownership, issue real token with profileId.
    const result = await this.userService.selectProfile(body);
    if (result.success === 1 && result.token) {
      response.setHeader('x-auth-token', result.token);
      delete (result as any).token;
    }
    return {
      encrypted: encryptResponse(result),
    };
  }

  @Post('user-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard, RolesGuard)
  @RequirePermission('userList')
  @Roles('superAdmin', 'companyAdmin', 'warehouseAdmin')
  @CompanyScoped()
  @UseInterceptors(FileInterceptor('userFile', multerConfig))
  async getUsers(@Body() body: getUserListDto, @Req() req) {
    const result = await this.userService.getUsers(body, req);
    return {
      encrypted: encryptResponse(result),
    };
  }

  @Get('user-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard, RolesGuard)
  @Roles('superAdmin', 'companyAdmin', 'warehouseAdmin')
  @RequirePermission('userView')
  async getUser(
    @Param('id') id: string,
    @Query('profileId') profileId: string,
    @Req() req: any,
  ) {
    const result = await this.userService.getUser({ id, profileId }, req);
    return { encrypted: encryptResponse(result) };
  }

  @Post('user-confirm-otp')
  @UseInterceptors(FileInterceptor('userFile', multerConfig))
  async confirmOtp(@Body() body: confirmOtp) {
    return await this.userService.confirmOtp(body);
  }

  @Post('user-resetpass')
  @UseInterceptors(FileInterceptor('userFile', multerConfig))
  async resetPass(@Body() body: resetpass) {
    return await this.userService.startResetPass(body);
  }

  @Post('user-check-password')
  // @UseGuards(AuthGuard('jwt'))
  async checkPassword(@Body() body: { email: string; password: string }) {
    return await this.userService.checkPassword(body);
  }

  @Post('verify-password')
  async verifyPassword(@Body() body) {
    console.log('hello');
    return await this.userService.verifyPassword(body);
  }

  @Post('user-add-profile')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('userUpdate')
  async addProfile(
    @Req() req,
    @Body()
    body: {
      userId: number;
      groupId: number;
      companyId: number;
      isActive: string;
    },
  ) {
    const result = await this.userService.addProfile(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Post('user-delete-profile')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('userUpdate')
  async deleteProfile(@Req() req, @Body() body: { id: number; userId: number }) {
    const result = await this.userService.deleteProfile(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Post('user-login-as')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('superAdmin')
  async loginAs(@Body() body: { targetUserId: number }, @Req() req, @Res({ passthrough: true }) response: any) {
    const result = await this.userService.loginAs(
      Number(body.targetUserId),
      req.user.userId,
    );
    if (result.success === 1 && result.impersonationToken) {
      response.setHeader('x-impersonation-token', result.impersonationToken);
      delete (result as any).impersonationToken;
    }
    return { encrypted: encryptResponse(result) };
  }

  @Post('user-stop-impersonating')
  @UseGuards(AuthGuard('jwt'))
  async stopImpersonating(@Body() body: { targetUserId: number }, @Req() req) {
    const result = await this.userService.stopImpersonating(
      Number(body.targetUserId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('user-switch-profile')
  @UseGuards(AuthGuard('jwt'))
  async switchProfile(
    @Body() body: { profileId: number },
    @Req() req,
    @Res({ passthrough: true }) response: any,
  ) {
    const result = await this.userService.switchProfile(body, req);
    if (result.success === 1 && result.token) {
      if (result.isImpersonation) {
        response.setHeader('x-impersonation-token', result.token);
      } else {
        response.setHeader('x-auth-token', result.token);
      }
      delete (result as any).token;
    }
    return { encrypted: encryptResponse(result) };
  }

  @Get('user-me')
  @UseGuards(AuthGuard('jwt'))
  async getMyProfile(@Req() req: any) {
    const result = await this.userService.getUser(
      { id: String(req.user.userId), profileId: req.user.profileId },
      req,
    );
    if (req.user?.isImpersonation && req.user?.impersonatedBy) {
      const adminResult = await this.userService.getUser(
        { id: String(req.user.impersonatedBy) },
        req,
      );
      (result as any).isImpersonation = true;
      (result as any).impersonatedBy = req.user.impersonatedBy;
      (result as any).impersonatorEmail = req.user.impersonatorEmail;
      (result as any).impersonatorUser = adminResult;
    }
    return { encrypted: encryptResponse(result) };
  }

  @Post('user-logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(
    @Req() req,
    @Body() body: { companyId?: number },
  ) {
    return this.userService.logout(body, req);
  }
}
