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
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { encryptResponse } from 'src/utilities/crypto';
import { DeliveryNoteService } from './service/delivery.note.service';
import { DeliveryNoteListService } from './service/delivery.note.list.service';
import { DeliveryNoteDto, DeliveryNoteListDto } from './dto/delivery.note.dto';

@Controller('delivery-note')
export class DeliveryNoteController {
  constructor(
    private readonly deliveryNoteService: DeliveryNoteService,
    private readonly deliveryNoteListService: DeliveryNoteListService,
  ) {}

  @Post('delivery-note-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('deliveryNoteList')
  async deliveryNoteList(@Req() req: any, @Body() body: DeliveryNoteListDto) {
    const result = await this.deliveryNoteListService.deliveryNoteList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('delivery-note-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('deliveryNoteView')
  async getDeliveryNoteDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.deliveryNoteListService.getDeliveryNoteDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('delivery-note-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('deliveryNoteAdd')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'receiverImage', maxCount: 1 },
        { name: 'receiverAttachments', maxCount: 10 },
      ],
      attachmentMulterConfig,
    ),
  )
  async insertDeliveryNote(
    @Req() req: any,
    @Body() body: DeliveryNoteDto,
    @UploadedFiles()
    files: {
      receiverImage?: Express.Multer.File[];
      receiverAttachments?: Express.Multer.File[];
    },
  ) {
    const result = await this.deliveryNoteService.insertDeliveryNote(
      body,
      req,
      files,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Get('delivery-note-order-items/:orderId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('deliveryNoteAdd')
  async getDeliverableOrderItems(
    @Req() req: any,
    @Param('orderId') orderId: string,
  ) {
    const result = await this.deliveryNoteListService.getDeliverableOrderItems(
      Number(orderId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Get('deliverable-orders/:customerId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('deliveryNoteAdd')
  async getDeliverableOrdersForCustomer(
    @Req() req: any,
    @Param('customerId') customerId: string,
  ) {
    const result =
      await this.deliveryNoteListService.getDeliverableOrdersForCustomer(
        Number(customerId),
        req,
      );
    return { encrypted: encryptResponse(result) };
  }
}
