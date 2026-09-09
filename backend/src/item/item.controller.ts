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
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { multerConfig } from 'src/packages/config/multer.config';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { ItemService } from './item.service';
import {
  ItemListDto,
  ItemDto,
  ItemUpdateDto,
} from './dto/item.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('item')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Post('item-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('itemList')
  async itemList(@Req() req: any, @Body() body: ItemListDto) {
    const result = await this.itemService.itemList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('item-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('itemView')
  async getItemDetails(@Req() req: any, @Param('id') id: string) {
    const result = await this.itemService.getItemDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('item-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('itemAdd')
  @UseInterceptors(FilesInterceptor('itemImages', 10, multerConfig))
  async insertItem(
    @Req() req: any,
    @Body() body: ItemDto,
    @UploadedFiles() itemImages: Express.Multer.File[],
  ) {
    const result = await this.itemService.insertItem(body, req, itemImages);
    return { encrypted: encryptResponse(result) };
  }

  @Put('item-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('itemUpdate')
  @UseInterceptors(FilesInterceptor('itemImages', 10, multerConfig))
  async updateItem(
    @Req() req: any,
    @Body() body: ItemUpdateDto,
    @UploadedFiles() itemImages: Express.Multer.File[],
  ) {
    const param = { ...body, updatedBy: req.user.userId };
    const result = await this.itemService.updateItem(param, req, itemImages);
    return { encrypted: encryptResponse(result) };
  }

  @Delete('item-image-delete/:imageId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('itemUpdate')
  async deleteItemImage(@Req() req: any, @Param('imageId') imageId: string) {
    const result = await this.itemService.deleteItemImage(
      Number(imageId),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }
}