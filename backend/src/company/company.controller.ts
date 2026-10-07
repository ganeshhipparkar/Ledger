import {
  Body,
  ConsoleLogger,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/packages/config/multer.config';
import { CompanyService } from './service/company.service';
import { CompanyListService } from './service/company.list.service';
import {
  CompanyDto,
  CompanyUpdateDto,
  getCompanyListDto,
} from 'src/company/dto/company.dto';
import { AuthGuard } from '@nestjs/passport';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('company')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly companyListService: CompanyListService,
  ) {}
  @Get()
  async hello() {
    return 'hello';
  }

  @Post('company-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('companyAdd')
  @UseInterceptors(FileInterceptor('companyFile', multerConfig))
  async insertCompany(
    @Req() req,
    @Body() body: CompanyDto,
    @UploadedFile() companyFile: Express.Multer.File,
  ) {
    if (companyFile) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

      if (!allowedTypes.includes(companyFile.mimetype)) {
        return {
          encrypted: encryptResponse({
            status: 0,
            message: 'invalid File type',
          }),
        };
      }
    }
    const param = { ...body, addedBy: req.user.userId };
    const result = await this.companyService.startInsertCompany(
      param,
      companyFile,
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Put('company-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('companyUpdate')
  @UseInterceptors(FileInterceptor('companyFile', multerConfig))
  async updateCompany(
    @Req() req,
    @Body() body: CompanyUpdateDto,
    @UploadedFile() companyFile: Express.Multer.File,
  ) {
    try {
      if (companyFile) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(companyFile.mimetype)) {
          return {
            encrypted: encryptResponse({ status: 0, message: 'invalid File type' }),
          };
        }
      }
      const param = { ...body, updatedBy: req.user.userId };
      const result = await this.companyService.startUpdate(
        param,
        companyFile || null,
        req,
      );
      return { encrypted: encryptResponse(result) };
    } catch (err) {
      return { encrypted: encryptResponse(err) };
    }
  }

  @Post('company-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('companyList')
  @UseInterceptors(FileInterceptor('companyFile', multerConfig))
  async getCompanys(@Req() req, @Body() body: getCompanyListDto) {
    const result = await this.companyListService.getCompanies(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('company-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('companyView')
  async getCompany(@Req() req, @Param('id') param) {
    const result = await this.companyListService.getCompany(param, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('currency-list')
  @UseGuards(AuthGuard('jwt'))
  async getCurrencies(@Req() req) {
    const result = await this.companyListService.getCurrencies(req);
    return { encrypted: encryptResponse(result) };
  }
}
