import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  PermissionsGuard,
  RequirePermission,
} from 'src/utilities/permissions.guard';
import { ItemCategoryService } from './service/item.category.service';
import {
  categoryListDto,
  ItemCategoryDto,
  ItemCategoryUpdateDto,
} from './dto/item.category.dto';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('item-category')
export class ItemCategoryController {
  constructor(private readonly itemCategoryService: ItemCategoryService) {}

  @Post('item-category-list')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('itemCategoryList')
  async categoryList(@Req() req: any, @Body() body: categoryListDto) {
    const result = await this.itemCategoryService.categoryList(body, req);
    return { encrypted: encryptResponse(result) };
  }

  @Get('item-category-details/:id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('itemCategoryView')
  async getItemCategory(@Req() req: any, @Param('id') id: string) {
    const result = await this.itemCategoryService.getItemCategoryDetails(
      Number(id),
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Post('item-category-add')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('itemCategoryAdd')
  async insertItemCategory(@Req() req: any, @Body() body: ItemCategoryDto) {
    const result = await this.itemCategoryService.insertItemCategory(
      body,
      req,
    );
    return { encrypted: encryptResponse(result) };
  }

  @Put('item-category-update')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('itemCategoryUpdate')
  async updateItemCategory(
    @Req() req: any,
    @Body() body: ItemCategoryUpdateDto,
  ) {
    const result = await this.itemCategoryService.updateItemCategory(
      body,
      req,
    );
    return { encrypted: encryptResponse(result) };
  }
}
