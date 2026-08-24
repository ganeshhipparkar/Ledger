import {
  Body,
  Controller,
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
import { multerConfig } from 'src/packages/config/multer.config';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { QuotationService } from './quotation.service';
import {
  QuotationDto,
  QuotationListDto,
  QuotationUpdateDto,
} from './dto/quotation.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('quotation')
export class QuotationContorller {
  constructor(private readonly quotationService: QuotationService) {}

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
      multerConfig,
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
      multerConfig,
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
}