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
import { TaxGroupService } from './tax.group.service';
import {
  taxGroupAddDto,
  taxGroupListDto,
  taxGroupUpdateDto,
} from './dto/tax.group.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('tax-group')
export class TaxGroupController {
  constructor(private readonly taxGroupService: TaxGroupService) {}

  @Post('tax-group-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('taxGroupList')
  async taxGroupList(@Req() req: any, @Body() body: taxGroupListDto) {
    const result = await this.taxGroupService.taxGroupList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('tax-group-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('taxGroupView')
  async getTaxGroupDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.taxGroupService.getTaxGroupDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('tax-group-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('taxGroupAdd')
  async insertTaxGroup(@Req() req: any, @Body() body: taxGroupAddDto) {
    const result = await this.taxGroupService.insertTaxGroup(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('tax-group-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('taxGroupUpdate')
  async updateTaxGroup(
    @Req() req: any,
    @Body() body: taxGroupUpdateDto,
  ) {
    const result = await this.taxGroupService.updateTaxGroup(body, req);
    return { encrypted: encryptResponse(result) };
  }
}