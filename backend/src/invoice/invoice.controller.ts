import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { attachmentMulterConfig } from 'src/packages/config/multer.config';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { encryptResponse } from 'src/utilities/crypto';
import { InvoiceService } from './invoice.service';
import { InvoicePdfService } from './invoice.pdf.service';
import {
  InvoiceDto,
  InvoiceListDto,
  InvoiceUpdateDto,
  InvoiceUpdateDueDateDto,
} from './dto/invoice.dto';

@Controller('invoice')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Post('invoice-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceList')
  async invoiceList(@Req() req: any, @Body() body: InvoiceListDto) {
    const result = await this.invoiceService.invoiceList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('invoice-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceView')
  async getInvoiceDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.invoiceService.getInvoiceDetails(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Post('invoice-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceAdd')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'attachments', maxCount: 10 },
        { name: 'termsConditionsFile', maxCount: 1 },
      ],
      attachmentMulterConfig,
    ),
  )
  async insertInvoice(
    @Req() req: any,
    @Body() body: InvoiceDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
  ) {
    const result = await this.invoiceService.insertInvoice(body, req, files);
    return { encrypted: encryptResponse(result) };
  }

  @Put('invoice-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceUpdate')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'attachments', maxCount: 10 },
        { name: 'termsConditionsFile', maxCount: 1 },
      ],
      attachmentMulterConfig,
    ),
  )
  async updateInvoice(
    @Req() req: any,
    @Body() body: InvoiceUpdateDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
  ) {
    const result = await this.invoiceService.updateInvoice(
      { ...body, updatedBy: req.user.userId },
      req,
      files,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Put('invoice-submit/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceUpdate')
  async submitInvoice(@Req() req: any, @Param('id') id: string) {
    const result = await this.invoiceService.submitInvoice(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('invoice-mark-paid/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceUpdate')
  async markAsPaid(@Req() req: any, @Param('id') id: string) {
    const result = await this.invoiceService.markAsPaid(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('invoice-update-due-date')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceUpdate')
  async updateDueDate(@Req() req: any, @Body() body: InvoiceUpdateDueDateDto) {
    const result = await this.invoiceService.updateDueDate(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Delete('invoice-delete/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceUpdate')
  async deleteInvoice(@Req() req: any, @Param('id') id: string) {
    const result = await this.invoiceService.deleteInvoice(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Delete('invoice-attachment-delete/:attachmentId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceUpdate')
  async deleteInvoiceAttachment(
    @Req() req: any,
    @Param('attachmentId') attachmentId: string,
  ) {
    const result = await this.invoiceService.deleteInvoiceAttachment(
      Number(attachmentId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Delete('invoice-terms-file-delete/:invoiceId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceUpdate')
  async deleteInvoiceTermsFile(
    @Req() req: any,
    @Param('invoiceId') invoiceId: string,
  ) {
    const result = await this.invoiceService.deleteInvoiceTermsFile(
      Number(invoiceId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('invoice-regenerate/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceUpdate')
  async regenerateInvoicePdf(
    @Req() _req: any,
    @Param('id') id: string,
  ) {
    try {
      const invoicePdfPath = await this.invoicePdfService.generateAndStoreInvoicePdf(
        Number(id),
      );
      return { encrypted: encryptResponse({ success: 1, invoicePdfPath }) };
    } catch (err: any) {
      return { encrypted: encryptResponse({ success: 0, message: err.message }) };
    }
  }
}
