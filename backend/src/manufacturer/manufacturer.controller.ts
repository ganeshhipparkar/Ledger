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
import { ManufacturerService } from './service/manufacturer.service';
import {
  manufacturerListDto,
  ManufacturerDto,
  ManufacturerUpdateDto,
} from './dto/manufacturer.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('manufacturer')
export class ManufacturerContorller {
  constructor(private readonly manufacturerService: ManufacturerService) {}

  @Post('manufacturer-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('manufacturerList')
  async manufacturerList(@Req() req: any, @Body() body: manufacturerListDto) {
    const result = await this.manufacturerService.manufacturerList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('manufacturer-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('manufacturerView')
  async getManufacturer(@Req() req: any, @Param('id') id: string) {
    const result = await this.manufacturerService.getManufacturerDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('manufacturer-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('manufacturerAdd')
  async insertManufacturer(@Req() req: any, @Body() body: ManufacturerDto) {
    const result = await this.manufacturerService.insertManufacturer(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('manufacturer-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('manufacturerUpdate')
  async updateManufacturer(
    @Req() req: any,
    @Body() body: ManufacturerUpdateDto,
  ) {
    const result = await this.manufacturerService.updateManufacturer(body, req);
    return { encrypted: encryptResponse(result) };
  }
}