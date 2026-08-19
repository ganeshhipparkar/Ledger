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
import { BankMasterService } from './bank.service';
import {
  bankListDto,
  BankMasterDto,
  BankMasterUpdateDto,
} from './dto/bank.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('bank')
export class BankController {
  constructor(private readonly bankService: BankMasterService) {}

  @Post('bank-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('bankList')
  async bankList(@Req() req: any, @Body() body: bankListDto) {
    const result = await this.bankService.bankList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('bank-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('bankView')
  async getBank(@Req() req: any, @Param('id') id: string) {
    const result = await this.bankService.getBankDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('bank-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('bankAdd')
  async insertBank(@Req() req: any, @Body() body: BankMasterDto) {
    const result = await this.bankService.insertBank(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('bank-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('bankUpdate')
  async updateBank(
    @Req() req: any,
    @Body() body: BankMasterUpdateDto,
  ) {
    const result = await this.bankService.updateBank(body, req);
    return { encrypted: encryptResponse(result) };
  }
}
