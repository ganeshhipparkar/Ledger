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
import { TermsAndConditionsService } from './terms.conditions.service';
import {
  termsConditionsListDto,
  TermsAndConditionsDto,
  TermsAndConditionsUpdateDto,
} from './dto/terms.conditions.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('terms-conditions')
export class TermsAndConditionsController {
  constructor(private readonly termsConditionsService: TermsAndConditionsService) {}

  @Post('terms-conditions-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('termsConditionsList')
  async termsConditionsList(@Req() req: any, @Body() body: termsConditionsListDto) {
    const result = await this.termsConditionsService.termsConditionsList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('terms-conditions-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('termsConditionsView')
  async getTermsConditionsDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.termsConditionsService.getTermsConditionsDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('terms-conditions-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('termsConditionsAdd')
  async insertTermsConditions(@Req() req: any, @Body() body: TermsAndConditionsDto) {
    const result = await this.termsConditionsService.insertTermsConditions(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('terms-conditions-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('termsConditionsUpdate')
  async updateTermsConditions(
    @Req() req: any,
    @Body() body: TermsAndConditionsUpdateDto,
  ) {
    const result = await this.termsConditionsService.updateTermsConditions(body, req);
    return { encrypted: encryptResponse(result) };
  }
}