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
import { attachmentMulterConfig } from 'src/packages/config/multer.config';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { PaymentTransactionService } from './payment.transaction.service';
import {
  PaymentTransactionDto,
  PaymentTransactionListDto,
  PaymentTransactionUpdateDto,
  PaymentTransactionStatusDto,
} from './dto/payment.transaction.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('payment-transaction')
export class PaymentTransactionController {
  constructor(
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  @Post('payment-transaction-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('paymentTransactionList')
  async paymentTransactionList(
    @Req() req: any,
    @Body() body: PaymentTransactionListDto,
  ) {
    const result = await this.paymentTransactionService.paymentTransactionList(
      body,
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Get('payment-transaction-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('paymentTransactionView')
  async getPaymentTransactionDetails(
    @Req() req: any,
    @Param('id') id: string,
  ) { 
    const result =
      await this.paymentTransactionService.getPaymentTransactionDetails(
        Number(id),
        req,
      );
    return { encrypted: encryptResponse(result) };
  }

  @Post('payment-transaction-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('paymentTransactionAdd')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 10 }], attachmentMulterConfig),
  )
  async insertPaymentTransaction(
    @Req() req: any,
    @Body() body: PaymentTransactionDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
    },
  ) {
    const result =
      await this.paymentTransactionService.insertPaymentTransaction(
        body,
        req,
        files,
      );
    return { encrypted: encryptResponse(result) };
  }

  @Put('payment-transaction-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('paymentTransactionUpdate')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 10 }], attachmentMulterConfig),
  )
  async updatePaymentTransaction(
    @Req() req: any,
    @Body() body: PaymentTransactionUpdateDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
    },
  ) {
    const result =
      await this.paymentTransactionService.updatePaymentTransaction(
        { ...body, updatedBy: req.user.userId },
        req,
        files,
      );
    return { encrypted: encryptResponse(result) };
  }

  @Put('payment-transaction-approve')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('paymentTransactionUpdate')
  async approvePaymentTransaction(
    @Req() req: any,
    @Body() body: PaymentTransactionStatusDto,
  ) {
    const result =
      await this.paymentTransactionService.approvePaymentTransaction(
        body,
        req,
      );
    return { encrypted: encryptResponse(result) };
  }

  @Put('payment-transaction-cancel')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('paymentTransactionUpdate')
  async cancelPaymentTransaction(
    @Req() req: any,
    @Body() body: PaymentTransactionStatusDto,
  ) {
    const result =
      await this.paymentTransactionService.cancelPaymentTransaction(
        body,
        req,
      );
    return { encrypted: encryptResponse(result) };
  }
}
