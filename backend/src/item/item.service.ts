import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { ActivityCode } from '../activity/enums/activity-code.enum';
import { Filter } from 'src/utilities/filter';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { generateBarcodeImage } from 'src/utilities/barcode.util';
import { FileTransfer } from 'src/utilities/file.transfer';
import { ItemEntity } from './entity/item.entity';
import { ItemImageEntity } from './entity/item.image.entity';
import { ItemDto, ItemListDto, ItemUpdateDto } from './dto/item.dto';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';

@Injectable()
export class ItemService {
  constructor(
    @InjectRepository(ItemEntity)
    private readonly itemEntity: Repository<ItemEntity>,
    @InjectRepository(ItemImageEntity)
    private readonly itemImageEntity: Repository<ItemImageEntity>,
    @InjectRepository(CurrencyEntity)
    private readonly currencyEntity: Repository<CurrencyEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyEntity: Repository<CompanyEntity>,
    @InjectRepository(UserCompanyGroupEntity)
    private readonly ucgEntity: Repository<UserCompanyGroupEntity>,
    @InjectRepository(UserEntity)
    private readonly userEntity: Repository<UserEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly fileTransfer: FileTransfer,
  ) {}

  @Inject()
  private readonly filter!: Filter;

  @Inject()
  private readonly codeGeneratorService!: CodeGeneratorService;

  async itemList(param: ItemListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder = this.itemEntity.createQueryBuilder('item');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere('item.companyId IN (:...scopedCompanyIds)', {
            scopedCompanyIds,
          });
        } else {
          return {
            success: 1,
            message: 'Items fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'item',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.itemEntity,
      )) as [number, number];

      queryBuilder.leftJoinAndSelect('item.company', 'company');
      queryBuilder.leftJoinAndSelect('item.category', 'category');
      queryBuilder.leftJoinAndSelect('item.manufacturer', 'manufacturer');
      queryBuilder.leftJoinAndSelect('item.brand', 'brand');
      queryBuilder.leftJoinAndSelect('item.itemUomRel', 'itemUomRel');
      queryBuilder.leftJoinAndSelect('item.packageRel', 'packageRel');
      queryBuilder.leftJoinAndSelect('item.currency', 'currency');
      queryBuilder.leftJoinAndSelect('item.images', 'images');
      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('item.itemName', 'ASC');

      const [data, total] = await queryBuilder.getManyAndCount();

      const formattedData = data.map((item) => {
        const primaryImg = item.images?.find((img) => img.isParent === 0);
        return {
          ...item,
          companyName: item.company?.companyName ?? null,
          categoryName: item.category?.itemCategoryName ?? null,
          manufacturerName: item.manufacturer?.manufacturerName ?? null,
          brandName: item.brand?.brandName ?? null,
          itemUomName: item.itemUomRel?.uomName ?? null,
          packageName: item.packageRel?.packageName ?? null,
          currencyName: item.currency?.name ?? null,
          currencyCode: item.currency?.code ?? null,
          currencySymbol: item.currency?.symbol ?? null,
          primaryImage: primaryImg ? primaryImg.itemImageUrl : null,
        };
      });

      return_data = {
        success: 1,
        message: 'Items fetched successfully',
        total,
        data: formattedData,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getItemDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const item = await this.itemEntity.findOne({
      where: { itemId: id },
      relations: [
        'company',
        'category',
        'manufacturer',
        'brand',
        'itemUomRel',
        'packageRel',
        'currency',
        'images',
      ],
    });
    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const baseCurrency = await this.currencyEntity.findOne({
      where :{code:process.env.CURRENCY_CONVERSION || "INR"}
    })

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(item.companyId))) {
        throw new ForbiddenException(
          'Access denied: item belongs to another company',
        );
      }
    }

    const addedByUser = item.addedBy
      ? await this.userEntity.findOne({ where: { userId: item.addedBy } })
      : null;
    const updatedByUser = item.updatedBy
      ? await this.userEntity.findOne({ where: { userId: item.updatedBy } })
      : null;

    const primaryImg = item.images?.find((img) => img.isParent === 0);

    return {
      ...item,
      companyName: item.company?.companyName ?? null,
      categoryName: item.category?.itemCategoryName ?? null,
      manufacturerName: item.manufacturer?.manufacturerName ?? null,
      brandName: item.brand?.brandName ?? null,
      itemUomName: item.itemUomRel?.uomName ?? null,
      packageName: item.packageRel?.packageName ?? null,
      currencyName: item.currency?.name ?? null,
      currencyCode: item.currency?.code ?? null,
      currencySymbol: item.currency?.symbol ?? null,
      primaryImage: primaryImg ? primaryImg.itemImageUrl : null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
      baseCurrencySymbol:baseCurrency?.symbol ?? null,
      baseCurrencyCode : baseCurrency?.symbol ?? null
    };
  }

  async insertItem(params: ItemDto, req?: any, itemImages?: Express.Multer.File[]) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(params.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot add item to another company',
          };
        }
      }

      const itemCode = await this.codeGeneratorService.generateCode(
        this.itemEntity,
        params.itemName,
        params.companyId,
        'itemCode',
        'ITEM',
      );

      const company = await this.companyEntity.findOne({
        where: { companyId: Number(params.companyId) },
      });
      const companyCode = company?.companyCode ?? '';
      const barcodeText = `${companyCode}${itemCode}`;
      
      const barcodeImage = await generateBarcodeImage(barcodeText);

      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.addedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      const srcCurrency = await this.currencyEntity.findOne({
        where: { curId: Number(params.sourceCurrencyId) },
      });
      const conversionRate = srcCurrency?.conversionRate ?? 1;
      const convertedPurchasePrice = Number(params.purchasePrice) / conversionRate;
      const convertedCostPerUnit = Number(params.costPerUnit) / conversionRate;

      const queryParams: any = {
        itemCode,
        barcode: barcodeText,
        itemName: params.itemName,
        companyId: Number(params.companyId),
        categoryId: Number(params.categoryId),
        manufacturerId: Number(params.manufacturerId),
        brandId: Number(params.brandId),
        itemUom: Number(params.itemUom),
        primitiveQuantity: params.primitiveQuantity,
        purchasePrice: params.purchasePrice,
        costPerUnit: params.costPerUnit,
        sourceCurrencyId: Number(params.sourceCurrencyId),
        conversionRate,
        convertedPurchasePrice,
        convertedCostPerUnit,
      };

      if (params.packageUom !== undefined && params.packageUom !== null) {
        queryParams.packageUom = Number(params.packageUom);
      }
      if (params.isDecimalAllowed) queryParams.isDecimalAllowed = params.isDecimalAllowed;
      if (params.checkShelfLife) queryParams.checkShelfLife = params.checkShelfLife;
      if (params.shelfLifeUnit) queryParams.shelfLifeUnit = params.shelfLifeUnit;
      if (params.shelfLifeSpan !== undefined && params.shelfLifeSpan !== null) {
        queryParams.shelfLifeSpan = params.shelfLifeSpan;
      }
      if (params.shortName !== undefined) queryParams.shortName = params.shortName;
      if (params.remarks !== undefined) queryParams.remarks = params.remarks;
      if (params.archive) queryParams.archive = params.archive;
      if (params.status) queryParams.status = params.status;

      if (performerId) queryParams.addedBy = Number(performerId);
      queryParams.addedDate = new Date();

      const result = await this.itemEntity.insert(queryParams);
      const insertId = result?.raw?.insertId;

      // Handle image uploads
      if (itemImages && itemImages.length > 0 && insertId) {
        for (let idx = 0; idx < itemImages.length; idx++) {
          const file = itemImages[idx];
          const filename = file.filename || file.originalname;
          await this.fileTransfer.fileTransfer(filename, insertId, 'item');


          const itemImageUrl = `/upload/item/${insertId}/${filename}`;
          const isParent = idx === 0 ? 0 : insertId;

          await this.itemImageEntity.insert({
            itemId: Number(insertId),
            itemImageUrl,
            isParent,   
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
        }
      }

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.ITEM_CREATE,
        userId: performerId,
        companyId: Number(params.companyId),
        actorType: 'USER',
        targetType: 'ITEM',
        targetId: String(insertId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          itemCode,
          itemName: params.itemName,
          companyId: params.companyId,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Item inserted successfully',
        data: { insertData: insertId },
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async updateItem(params: ItemUpdateDto, req?: any, itemImages?: Express.Multer.File[]) {
    if (!params.itemId) {
      return { success: 0, message: 'itemId is mandatory' };
    }
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const itemId = Number(params.itemId);
      const existingItem = await this.itemEntity.findOne({
        where: { itemId },
      });
      if (!existingItem) {
        return { success: 0, message: 'Item not found' };
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (!scopedCompanyIds.includes(Number(existingItem.companyId))) {
          return {
            success: 0,
            message: 'Access denied: cannot update item of another company',
          };
        }
      }

      const queryParams: any = {};
      if (params.itemName !== undefined) queryParams.itemName = params.itemName;
      if (params.categoryId !== undefined) queryParams.categoryId = Number(params.categoryId);
      if (params.manufacturerId !== undefined) queryParams.manufacturerId = Number(params.manufacturerId);
      if (params.brandId !== undefined) queryParams.brandId = Number(params.brandId);
      if (params.itemUom !== undefined) queryParams.itemUom = Number(params.itemUom);
      if (params.packageUom !== undefined) queryParams.packageUom = params.packageUom ? Number(params.packageUom) : null;
      if (params.primitiveQuantity !== undefined) queryParams.primitiveQuantity = params.primitiveQuantity;
      if (params.purchasePrice !== undefined) queryParams.purchasePrice = params.purchasePrice;
      if (params.costPerUnit !== undefined) queryParams.costPerUnit = params.costPerUnit;
      if (params.sourceCurrencyId !== undefined) queryParams.sourceCurrencyId = Number(params.sourceCurrencyId);
      if (params.isDecimalAllowed !== undefined) queryParams.isDecimalAllowed = params.isDecimalAllowed;
      if (params.checkShelfLife !== undefined) queryParams.checkShelfLife = params.checkShelfLife;
      if (params.shelfLifeUnit !== undefined) queryParams.shelfLifeUnit = params.shelfLifeUnit;
      if (params.shelfLifeSpan !== undefined) queryParams.shelfLifeSpan = params.shelfLifeSpan;
      if (params.shortName !== undefined) queryParams.shortName = params.shortName;
      if (params.remarks !== undefined) queryParams.remarks = params.remarks;
      if (params.archive !== undefined) queryParams.archive = params.archive;
      if (params.status !== undefined) queryParams.status = params.status;

      // Recompute conversionRate + converted prices whenever any of the three price-related fields change
      if (
        params.sourceCurrencyId !== undefined ||
        params.purchasePrice !== undefined ||
        params.costPerUnit !== undefined
      ) {
        const effectiveCurrencyId = params.sourceCurrencyId !== undefined
          ? Number(params.sourceCurrencyId)
          : existingItem.sourceCurrencyId;
        const effectivePurchasePrice = params.purchasePrice !== undefined
          ? Number(params.purchasePrice)
          : Number(existingItem.purchasePrice);
        const effectiveCostPerUnit = params.costPerUnit !== undefined
          ? Number(params.costPerUnit)
          : Number(existingItem.costPerUnit);

        const srcCurrency = await this.currencyEntity.findOne({
          where: { curId: effectiveCurrencyId },
        });
        const conversionRate = srcCurrency?.conversionRate ?? 1;
        queryParams.conversionRate = conversionRate;
        queryParams.convertedPurchasePrice = effectivePurchasePrice / conversionRate;
        queryParams.convertedCostPerUnit = effectiveCostPerUnit / conversionRate;
      }
      const performerId = req?.user?.isImpersonation
        ? req?.user?.userId
        : (req?.user?.impersonatedBy ?? params.updatedBy);
      const performerEmail = req?.user?.isImpersonation
        ? req?.user?.email
        : (req?.user?.impersonatorEmail ?? '');

      if (performerId) queryParams.updatedBy = Number(performerId);
      queryParams.updatedDate = new Date();

      if (Object.keys(queryParams).length > 0) {
        await this.itemEntity.update({ itemId }, queryParams);
      }



      // Append new images 
      if (itemImages && itemImages.length > 0) {
        const existingPrimary = await this.itemImageEntity.findOne({
          where: { itemId, isParent: 0 },
        });
        const hasPrimary = !!existingPrimary;

        for (let idx = 0; idx < itemImages.length; idx++) {
          const file = itemImages[idx];
          const filename = file.filename || file.originalname;
          await this.fileTransfer.fileTransfer(filename, itemId, 'item');


          const itemImageUrl = `/upload/item/${itemId}/${filename}`;

          const isParent = (!hasPrimary && idx === 0) ? 0 : itemId;

          await this.itemImageEntity.insert({
            itemId,
            itemImageUrl,
            isParent,
            addedBy: performerId ? Number(performerId) : undefined,
            addedDate: new Date(),
          });
        }
      }
      // console.log(" userEmail: ",performerEmail,
      //     "userGroup:", authCtx.activeGroupName || 'N/A',
      //     "itemCode: ",existingItem.itemCode,
      //     "itemName: ",params.itemName ?? existingItem.itemName,
      //     "status: ",params.status ?? existingItem.status,
      //     "impersonated: ",!!req?.user?.isImpersonation,)

      this.eventEmitter.emit('activity.log', {
        activityCode: ActivityCode.ITEM_UPDATE,
        userId: performerId,
        companyId: existingItem.companyId,
        actorType: 'USER',
        targetType: 'ITEM',
        targetId: String(itemId),
        executionStatus: 'SUCCESS',
        severity: 'INFO',
        parameters: {
          userEmail: performerEmail,
          userGroup: authCtx.activeGroupName || 'N/A',
          itemCode: existingItem.itemCode,
          itemName: params.itemName ?? existingItem.itemName,
          status: params.status ?? existingItem.status,
          impersonated: !!req?.user?.isImpersonation,
        },
        metadata: {},
      });

      return {
        success: 1,
        message: 'Item updated successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }

  async deleteItemImage(imageId: number, req: any) {
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const img = await this.itemImageEntity.findOne({
        where: { id: imageId },
      });
      if (!img) {
        throw new NotFoundException('Item image not found');
      }

      const item = await this.itemEntity.findOne({
        where: { itemId: img.itemId },
      });
      if (!item) {
        throw new NotFoundException('Associated item not found');
      }

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
        if (!scopedCompanyIds.includes(Number(item.companyId))) {
          throw new ForbiddenException(
            'Access denied: item image belongs to another company',
          );
        }
      }

      const relativePath = img.itemImageUrl.startsWith('/')
        ? img.itemImageUrl.substring(1)
        : img.itemImageUrl;
      const fullPath = path.resolve('.', relativePath);
      if (fs.existsSync(fullPath)) {
        try {
          await fs.promises.unlink(fullPath);
        } catch {
        }
      }

      await this.itemImageEntity.delete({ id: imageId });

      return {
        success: 1,
        message: 'Item image deleted successfully',
      };
    } catch (err: any) {
      return { success: 0, message: err.message };
    }
  }
}