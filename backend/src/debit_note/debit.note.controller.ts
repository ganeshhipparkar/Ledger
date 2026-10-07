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
import { DebitNoteService } from './service/debit.note.service';
import { DebitNoteListService } from './service/debit.note.list.service';
import { DebitNoteDto, DebitNoteListDto } from './dto/debit.note.dto';

@Controller('debit-note')
export class DebitNoteController {
  constructor(
    private readonly debitNoteService: DebitNoteService,
    private readonly debitNoteListService: DebitNoteListService,
  ) {}

  @Post('debit-note-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('debitNoteAdd')
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'attachments', maxCount: 10 }],
      attachmentMulterConfig,
    ),
  )
  async insertDebitNote(
    @Req() req: any,
    @Body() body: DebitNoteDto,
    @UploadedFiles() files: { attachments?: Express.Multer.File[] },
  ) {
    const result = await this.debitNoteService.insertDebitNote(body, req, files);
    return { encrypted: encryptResponse(result) };
  }

  @Post('debit-note-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('debitNoteList')
  async debitNoteList(@Req() req: any, @Body() body: DebitNoteListDto) {
    const result = await this.debitNoteListService.debitNoteList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('debit-note-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('debitNoteView')
  async debitNoteDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.debitNoteListService.debitNoteDetails(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('invoices-by-customer/:customerId/:currencyId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('debitNoteAdd')
  async invoicesByCustomer(
    @Req() req: any,
    @Param('customerId') customerId: string,
    @Param('currencyId') currencyId: string,
  ) {
    const result = await this.debitNoteListService.invoicesByCustomer(Number(customerId), Number(currencyId), req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('invoice-items/:invoiceId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('debitNoteAdd')
  async invoiceItems(
    @Req() req: any,
    @Param('invoiceId') invoiceId: string,
  ) {
    const result = await this.debitNoteListService.invoiceItems(Number(invoiceId), req);
    return { encrypted: encryptResponse(result) };
  }
}
