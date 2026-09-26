import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { attachmentMulterConfig } from 'src/packages/config/multer.config';
import { PermissionsGuard, RequirePermission } from 'src/utilities/permissions.guard';
import { encryptResponse } from 'src/utilities/crypto';
import { CreditNoteService } from './service/credit.note.service';
import { CreditNoteDto, CreditNoteListDto } from './dto/credit.note.dto';

@Controller('credit-note')
export class CreditNoteController {
  constructor(private readonly creditNoteService: CreditNoteService) {}

  @Post('credit-note-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('creditNoteAdd')
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'attachments', maxCount: 10 }],
      attachmentMulterConfig,
    ),
  )
  async insertCreditNote(
    @Req() req: any,
    @Body() body: CreditNoteDto,
    @UploadedFiles() files: { attachments?: Express.Multer.File[] },
  ) {
    const result = await this.creditNoteService.insertCreditNote(body, req, files);
    return { encrypted: encryptResponse(result) };
  }

  @Post('credit-note-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('creditNoteList')
  async creditNoteList(@Req() req: any, @Body() body: CreditNoteListDto) {
    const result = await this.creditNoteService.creditNoteList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('credit-note-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('creditNoteView')
  async creditNoteDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.creditNoteService.creditNoteDetails(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('invoices-by-customer/:customerId/:currencyId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('creditNoteAdd')
  async invoicesByCustomer(
    @Req() req: any,
    @Param('customerId') customerId: string,
    @Param('currencyId') currencyId: string,
  ) {
    const result = await this.creditNoteService.invoicesByCustomer(Number(customerId), Number(currencyId), req);
    return { encrypted: encryptResponse(result) };
  }
}
