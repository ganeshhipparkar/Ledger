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
import { UomService } from './service/uom.service';
import { UomListService } from './service/uom.list.service';
import {
  UomListDto,
  UomDto,
  UomUpdateDto,
} from './dto/uom.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('uom')
export class UomController {
  constructor(
    private readonly uomService: UomService,
    private readonly uomListService: UomListService,
  ) {}

  @Post('uom-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('uomList')
  async uomList(@Req() req: any, @Body() body: UomListDto) {
    const result = await this.uomListService.uomList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('uom-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('uomView')
  async getUom(@Req() req: any, @Param('id') id: string) {
    const result = await this.uomListService.getUomDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('uom-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('uomAdd')
  async insertUom(@Req() req: any, @Body() body: UomDto) {
    const result = await this.uomService.insertUom(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('uom-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('uomUpdate')
  async updateUom(
    @Req() req: any,
    @Body() body: UomUpdateDto,
  ) {
    const result = await this.uomService.updateUom(body, req);
    return { encrypted: encryptResponse(result) };
  }
}