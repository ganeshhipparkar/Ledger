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
import { QuotationService } from './quotation.service';
import { QuotationPdfService } from './quotation.pdf.service';
import {
  QuotationDto,
  QuotationListDto,
  QuotationUpdateDto,
} from './dto/quotation.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('quotation')
export class QuotationContorller {
  constructor(
    private readonly quotationService: QuotationService,
    private readonly quotationPdfService: QuotationPdfService,
  ) {}

  @Post('quotation-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('quotationList')
  async quotationList(@Req() req: any, @Body() body: QuotationListDto) {
    const result = await this.quotationService.quotationList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('quotation-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('quotationView')
  async getQuotationDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.quotationService.getQuotationDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('quotation-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('quotationAdd')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'attachments', maxCount: 10 },
        { name: 'termsConditionsFile', maxCount: 1 },
      ],
      attachmentMulterConfig,
    ),
  )
  async insertQuotation(
    @Req() req: any,
    @Body() body: QuotationDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
  ) {
    const result = await this.quotationService.insertQuotation(body, req, files);

    return { encrypted: encryptResponse(result) };
  }

  @Put('quotation-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('quotationUpdate')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'attachments', maxCount: 10 },
        { name: 'termsConditionsFile', maxCount: 1 },
      ],
      attachmentMulterConfig,
    ),
  )
  async updateQuotation(
    @Req() req: any,
    @Body() body: QuotationUpdateDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
  ) {
    const result = await this.quotationService.updateQuotation(
      { ...body, updatedBy: req.user.userId },
      req,
      files,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Delete('quotation-attachment-delete/:attachmentId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('quotationUpdate')
  async deleteQuotationAttachment(
    @Req() req: any,
    @Param('attachmentId') attachmentId: string,
  ) {
    const result = await this.quotationService.deleteQuotationAttachment(
      Number(attachmentId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Delete('quotation-terms-file-delete/:quotationId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('quotationUpdate')
  async deleteQuotationTermsFile(
    @Req() req: any,
    @Param('quotationId') quotationId: string,
  ) {
    const result = await this.quotationService.deleteQuotationTermsFile(
      Number(quotationId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('quotation-invoice-regenerate/:quotationId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('quotationUpdate')
  async regenerateInvoicePdf(
    @Req() _req: any,
    @Param('quotationId') quotationId: string,
  ) {
    try {
      const invoicePdfPath = await this.quotationPdfService.generateAndStoreInvoicePdf(
        Number(quotationId),
      );
      return { encrypted: encryptResponse({ success: 1, invoicePdfPath }) };
    } catch (err: any) {
      return { encrypted: encryptResponse({ success: 0, message: err.message }) };
    }
  }
}