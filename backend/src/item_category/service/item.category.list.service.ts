import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemCategoryEntity } from 'src/item_category/entity/item-category.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { resolveAuthContext } from 'src/utilities/auth-helper';
import { categoryListDto } from '../dto/item.category.dto';

@Injectable()
export class ItemCategoryListService {
  @Inject()
  private readonly filter!: Filter;

  @InjectRepository(ItemCategoryEntity)
  private readonly itemCategoryEntity!: Repository<ItemCategoryEntity>;

  @InjectRepository(UserCompanyGroupEntity)
  private readonly ucgEntity!: Repository<UserCompanyGroupEntity>;

  @InjectRepository(UserEntity)
  private readonly userEntity!: Repository<UserEntity>;

  async categoryList(param: categoryListDto, req?: any) {
    let return_data: any = {};
    try {
      const authCtx = await resolveAuthContext(req, this.ucgEntity);
      const queryBuilder =
        this.itemCategoryEntity.createQueryBuilder('itemCategory')
        .leftJoinAndSelect('itemCategory.parentCategory', 'parentCategory')
        .leftJoinAndSelect('itemCategory.company', 'company');

      if (!authCtx.isSuperAdmin) {
        const scopedCompanyIds = req?.scopedCompanyIds || [
          authCtx.activeCompanyId,
        ];
        if (scopedCompanyIds.length > 0) {
          queryBuilder.andWhere(
            'itemCategory.companyId IN (:...scopedCompanyIds)',
            { scopedCompanyIds },
          );
        } else {
          return {
            success: 1,
            message: 'Item categories fetched successfully',
            total: 0,
            data: [],
          };
        }
      }

      const queryString = await this.filter.makeFilterString(
        param.filters,
        'itemCategory',
        {},
        param.condition === 'Any' ? 'Any' : 'All',
      );
      if (queryString && queryString !== '') {
        queryBuilder.andWhere(queryString);
      }

      const [skip, limit] = (await this.filter.calcPages(
        param,
        this.itemCategoryEntity,
      )) as [number, number];

      queryBuilder.skip(skip).take(limit);
      queryBuilder.orderBy('itemCategory.itemCategoryName', 'ASC');

      const [rawHits, total] = await queryBuilder.getManyAndCount();

       const data = rawHits.map((cat) => ({
        ...cat,
        parentCategoryName: cat.parentCategory?.itemCategoryName ?? null,
        companyName: cat.company?.companyName ?? null,
        addedByName: (cat as any).addedByUser?.name ?? null,
      }));

      return_data = {
        success: 1,
        message: 'Item categories fetched successfully',
        total,
        data,
      };
    } catch (err: any) {
      return_data = { success: 0, message: err.message };
    }
    return return_data;
  }

  async getItemCategoryDetails(id: number, req?: any) {
    const authCtx = await resolveAuthContext(req, this.ucgEntity);
    const category = await this.itemCategoryEntity.findOne({
      where: { itemCategoryId: id },
      relations: ['parentCategory', 'company'],
    });
    if (!category) {
      throw new NotFoundException('Item category not found');
    }

    if (!authCtx.isSuperAdmin) {
      const scopedCompanyIds = req?.scopedCompanyIds || [
        authCtx.activeCompanyId,
      ];
      if (!scopedCompanyIds.includes(Number(category.companyId))) {
        throw new ForbiddenException(
          'Access denied: item category belongs to another company',
        );
      }
    }

    const addedByUser = category.addedBy
      ? await this.userEntity.findOne({ where: { userId: category.addedBy } })
      : null;
    const updatedByUser = category.updatedBy
      ? await this.userEntity.findOne({
          where: { userId: category.updatedBy },
        })
      : null;

    return {
      ...category,
      parentCategoryName: category.parentCategory?.itemCategoryName ?? null,
      companyName: category.company?.companyName ?? null,
      addedByName: addedByUser?.name ?? null,
      updatedByName: updatedByUser?.name ?? null,
    };
  }
}
