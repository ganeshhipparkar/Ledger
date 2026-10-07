import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { PackageService } from './package.service';
import { PackageListService } from './package.list.service';
import {
  PackageListDto,
  PackageDto,
  PackageUpdateDto,
} from './dto/package.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('package')
export class PackageContorller {
  constructor(
    private readonly packageService: PackageService,
    private readonly packageListService: PackageListService,
  ) {}

  @Post('package-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('packageList')
  async packageList(@Req() req: any, @Body() body: PackageListDto) {
    const result = await this.packageListService.packageList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('package-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('packageView')
  async getPackage(@Req() req: any, @Param('id') id: string) {
    const result = await this.packageListService.getPackageDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('package-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('packageAdd')
  async insertPackage(@Req() req: any, @Body() body: PackageDto) {
    const result = await this.packageService.insertPackage(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('package-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('packageUpdate')
  async updatePackage(
    @Req() req: any,
    @Body() body: PackageUpdateDto,
  ) {
    const result = await this.packageService.updatePackage(body, req);
    return { encrypted: encryptResponse(result) };
  }
}