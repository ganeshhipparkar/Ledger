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
import { OrderService } from './order.service';
import {
  OrderDto,
  OrderListDto,
  OrderUpdateDto,
  OrderUpdatePriceDto,
} from './dto/order.dto';
import { encryptResponse } from 'src/utilities/crypto';

import { OrderPdfService } from './order.pdf.service';

@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderPdfService: OrderPdfService,
  ) { }

  @Post('order-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderList')
  async orderList(@Req() req: any, @Body() body: OrderListDto) {
    const result = await this.orderService.orderList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('order-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderView')
  async getOrderDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.orderService.getOrderDetails(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Post('order-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderAdd')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'attachments', maxCount: 10 },
        { name: 'termsConditionsFile', maxCount: 1 },
      ],
      attachmentMulterConfig,
    ),
  )
  async insertOrder(
    @Req() req: any,
    @Body() body: OrderDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
  ) {
    const result = await this.orderService.insertOrder(body, req, files);
    return { encrypted: encryptResponse(result) };
  }

  @Put('order-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderUpdate')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'attachments', maxCount: 10 },
        { name: 'termsConditionsFile', maxCount: 1 },
      ],
      attachmentMulterConfig,
    ),
  )
  async updateOrder(
    @Req() req: any,
    @Body() body: OrderUpdateDto,
    @UploadedFiles()
    files: {
      attachments?: Express.Multer.File[];
      termsConditionsFile?: Express.Multer.File[];
    },
  ) {
    const result = await this.orderService.updateOrder(
      { ...body, updatedBy: req.user.userId },
      req,
      files,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Put('order-submit/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderUpdate')
  async submitOrder(@Req() req: any, @Param('id') id: string) {
    const result = await this.orderService.submitOrder(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('order-cancel/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderUpdate')
  async cancelOrder(@Req() req: any, @Param('id') id: string) {
    const result = await this.orderService.cancelOrder(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Put('order-close/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderUpdate')
  async closeOrder(@Req() req: any, @Param('id') id: string) {
    const result = await this.orderService.closeOrder(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }


  @Put('order-update-price')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderUpdate')
  async updateOrderPrice(
    @Req() req: any,
    @Body() body: OrderUpdatePriceDto,
  ) {
    const result = await this.orderService.updateOrderPrice(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Delete('order-delete/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderUpdate')
  async deleteOrder(@Req() req: any, @Param('id') id: string) {
    const result = await this.orderService.deleteOrder(Number(id), req);
    return { encrypted: encryptResponse(result) };
  }

  @Delete('order-attachment-delete/:attachmentId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderUpdate')
  async deleteOrderAttachment(
    @Req() req: any,
    @Param('attachmentId') attachmentId: string,
  ) {
    const result = await this.orderService.deleteOrderAttachment(
      Number(attachmentId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Delete('order-terms-file-delete/:orderId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderUpdate')
  async deleteOrderTermsFile(
    @Req() req: any,
    @Param('orderId') orderId: string,
  ) {
    const result = await this.orderService.deleteOrderTermsFile(
      Number(orderId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('order-invoice-regenerate/:orderId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('orderUpdate')
  async regenerateInvoicePdf(
    @Req() _req: any,
    @Param('orderId') orderId: string,
  ) {
    try {
      const invoicePdfPath = await this.orderPdfService.generateAndStoreInvoicePdf(
        Number(orderId),
      );
      return { encrypted: encryptResponse({ success: 1, invoicePdfPath }) };
    } catch (err: any) {
      return { encrypted: encryptResponse({ success: 0, message: err.message }) };
    }
  }
}
