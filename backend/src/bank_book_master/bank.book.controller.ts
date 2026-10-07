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
import { BankBookService } from './service/bank.book.service';
import { BankBookListService } from './service/bank.book.list.service';
import {
  bankBookListDto,
  BankBookDto,
  BankBookUpdateDto,
} from './dto/bank.book.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('bank-book')
export class BankBookController {
  constructor(
    private readonly bankBookService: BankBookService,
    private readonly bankBookListService: BankBookListService,
  ) {}

  @Post('bank-book-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('bankBookList')
  async bankBookList(@Req() req: any, @Body() body: bankBookListDto) {
    const result = await this.bankBookListService.bankBookList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('bank-book-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('bankBookView')
  async getBankBookDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.bankBookListService.getBankBookDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('bank-book-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('bankBookAdd')
  async insertBankBook(@Req() req: any, @Body() body: BankBookDto) {
    const result = await this.bankBookService.insertBankBook(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('bank-book-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('bankBookUpdate')
  async updateBankBook(
    @Req() req: any,
    @Body() body: BankBookUpdateDto,
  ) {
    const result = await this.bankBookService.updateBankBook(body, req);
    return { encrypted: encryptResponse(result) };
  }
}