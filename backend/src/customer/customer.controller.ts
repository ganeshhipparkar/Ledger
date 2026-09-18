import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/packages/config/multer.config';
import { AuthGuard } from '@nestjs/passport';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { CustomerService } from './customer.service';
import {
  CustomerListDto,
  CustomerDto,
  CustomerUpdateDto,
} from './dto/customer.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('customer')
export class CustomerContorller {
  constructor(private readonly customerService: CustomerService) {}

  @Post('customer-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('customerList')
  async customerList(@Req() req: any, @Body() body: CustomerListDto) {
    const result = await this.customerService.customerList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Post('customer-currencies-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('customerList')
  async customerCurrenciesList(@Req() req: any, @Body() body: CustomerListDto) {
    const result = await this.customerService.customerCurrenciesList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('customer-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('customerView')
  async getCustomer(@Req() req: any, @Param('id') id: string) {
    const result = await this.customerService.getCustomerDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('customer-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('customerAdd')
  @UseInterceptors(FileInterceptor('customerLogo', multerConfig))
  async insertCustomer(
    @Req() req: any,
    @Body() body: CustomerDto,
    @UploadedFile() customerLogo: Express.Multer.File,
  ) {
    if (customerLogo) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(customerLogo.mimetype)) {
        return {
          encrypted: encryptResponse({
            status: 0,
            message: 'invalid File type',
          }),
        };
      }
    }
    const result = await this.customerService.insertCustomer(
      body,
      customerLogo,
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Put('customer-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('customerUpdate')
  @UseInterceptors(FileInterceptor('customerLogo', multerConfig))
  async updateCustomer(
    @Req() req: any,
    @Body() body: CustomerUpdateDto,
    @UploadedFile() customerLogo: Express.Multer.File,
  ) {
    try {
      if (customerLogo) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(customerLogo.mimetype)) {
          return {
            encrypted: encryptResponse({
              status: 0,
              message: 'invalid File type',
            }),
          };
        }
      }
      const result = await this.customerService.updateCustomer(
        body,
        customerLogo,
        req,
      );
      return { encrypted: encryptResponse(result) };
    } catch (err) {
      return { encrypted: encryptResponse(err) };
    }
  }

  @Get('company-currencies/:companyId')
  @UseGuards(AuthGuard('jwt'))
  async getCompanyCurrencies(
    @Req() req: any,
    @Param('companyId') companyId: string,
  ) {
    const result = await this.customerService.getCompanyCurrencies(
      Number(companyId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Get('check-customer-email')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('customerView')
  async checkCustomerEmail(
    @Req() req: any,
    @Query('email') email: string,
    @Query('companyId') companyId: string,
    @Query('customerId') customerId?: string,
  ) {
    const result = await this.customerService.checkCustomerEmail(
      email,
      Number(companyId),
      customerId ? Number(customerId) : undefined,
      req,
    );
    return { encrypted: encryptResponse(result) };
  }
}