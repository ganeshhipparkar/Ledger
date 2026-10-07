import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Filter } from 'src/utilities/filter';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { CurrencyEntity } from 'src/currency/entity/currency.entity';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { ItemEntity } from '../entity/item.entity';
import { ItemImageEntity } from '../entity/item.image.entity';
import { ItemListDto } from '../dto/item.dto';

@Injectable()
export class ItemListService {
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
  ) {}

  @Inject()
  private readonly filter!: Filter;

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
}
