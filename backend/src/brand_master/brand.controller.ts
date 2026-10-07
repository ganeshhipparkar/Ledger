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
import { BrandService } from './service/brand.service';
import { BrandListService } from './service/brand.list.service';
import {
  BrandListDto,
  BrandDto,
  BrandUpdateDto,
} from './dto/brand.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('brand')
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly brandListService: BrandListService,
  ) {}

  @Post('brand-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('brandList')
  async brandList(@Req() req: any, @Body() body: BrandListDto) {
    const result = await this.brandListService.brandList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('brand-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('brandView')
  async getBrand(@Req() req: any, @Param('id') id: string) {
    const result = await this.brandListService.getBrandDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('brand-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('brandAdd')
  async insertBrand(@Req() req: any, @Body() body: BrandDto) {
    const result = await this.brandService.insertBrand(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('brand-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('brandUpdate')
  async updateBrand(
    @Req() req: any,
    @Body() body: BrandUpdateDto,
  ) {
    const result = await this.brandService.updateBrand(body, req);
    return { encrypted: encryptResponse(result) };
  }
}