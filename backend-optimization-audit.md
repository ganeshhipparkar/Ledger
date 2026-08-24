# Backend Optimization Audit

This document outlines structural, performance, and maintainability improvements for the backend codebase. It highlights patterns that technically work but can be optimized for better scalability and cleaner code.

## 1. Cross-Module Duplication

### **B. Company Scoping and SuperAdmin Checks**
- **Files Affected:** All services and controllers (e.g., `brand.service.ts:57`, `item.service.ts`).
- **Why it matters:** There is a repeated boilerplate block across almost every `find`, `update`, and `insert` method checking `if (!authCtx.isSuperAdmin) { const scoped = req?.scopedCompanyIds || [authCtx.activeCompanyId]; ... }` to append `.andWhere('...companyId IN...')` to queries. This clutters business logic.
- **Proposed Fix:** Centralize this in a shared query helper, e.g., `applyCompanyScope(queryBuilder, authCtx, req, alias)`.
  ```typescript
  export function applyCompanyScope(qb: SelectQueryBuilder<any>, req: any, authCtx: AuthContext, tableAlias: string) {
    if (!authCtx.isSuperAdmin) {
      const scopedIds = req?.scopedCompanyIds || [authCtx.activeCompanyId];
      if (scopedIds.length === 0) throw new ForbiddenException('No scoped companies available');
      qb.andWhere(`${tableAlias}.companyId IN (:...scopedCompanyIds)`, { scopedCompanyIds: scopedIds });
    }
    return qb;
  }
  ```

### **C. Audit Field Population (`addedByName`, `updatedByName`)**
- **Files Affected:** `brand.service.ts`, `item.service.ts`, `company.service.ts`, `group.service.ts`, `customer.service.ts`.
- **Why it matters:** Services manually do `addedByUser = await this.userEntity.findOne(...)` every time they fetch details, rather than leveraging TypeORM relations. This duplicates fetching logic across modules.
- **Proposed Fix:** Define `addedBy` and `updatedBy` as `@ManyToOne(() => UserEntity)` relations directly on a generic `BaseEntity` or individual entities, allowing them to be loaded via `.leftJoinAndSelect('entity.addedByUser', 'addedByUser')`.

## 2. Query Efficiency

### **A. N+1 Queries for User Lookups in List vs Detail Views**
- **Files Affected:** Details endpoints across most master services (e.g., `getBrandDetails`).
- **Why it matters:** Doing separate `findOne` lookups for `addedBy` and `updatedBy` inside the `getBrandDetails` methods adds unnecessary network round-trips to the DB. If this pattern leaks into list views, it creates an N+1 query problem.
- **Proposed Fix:** Let TypeORM handle it with a `JOIN`.
  ```typescript
  // In BrandEntity:
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'addedBy' })
  addedByUser: UserEntity;

  // In BrandService:
  const brand = await this.brandEntity.findOne({
    where: { brandId: id },
    relations: ['company', 'manufacturer', 'addedByUser', 'updatedByUser'],
  });
  // Now brand.addedByUser.name is immediately available without extra queries.
  ```

## 3. Database Indexes

### **A. Missing Indexes on Foreign Keys and Filtered Columns**
- **Files Affected:** `item.entity.ts`, `brand.entity.ts`, `customer.entity.ts`, etc.
- **Why it matters:** TypeORM's `synchronize: true` creates foreign key constraints, but it *does not* automatically create secondary indexes for columns frequently used in `WHERE` clauses (like `companyId`, `status`, or `code` fields). Queries filtering by `companyId IN (...)` (which happens on *every* request for non-superAdmins) will trigger full table scans as the tables grow.
- **Proposed Fix:** Add explicit `@Index` decorators to entity files for frequently queried columns.
  ```typescript
  @Entity('item_master')
  @Index('idx_item_companyId', ['companyId'])
  @Index('idx_item_code_company', ['itemCode', 'companyId'], { unique: true })
  export class ItemEntity {
      // ...
  }
  ```

## 4. Inconsistent Patterns

### **A. Resolving the Auth Context for Activity Logs**
- **Files Affected:** `currency.service.ts` vs `brand.service.ts`.
- **Why it matters:** In `currency.service.ts`, the code manually fetches the `ucgEntity` again just to get the `groupName` for the ActivityLog (`performerUcg?.group?.groupName`). In `brand.service.ts`, it elegantly reuses `authCtx.activeGroupName`, avoiding an extra database hit.
- **Proposed Fix:** Standardize ActivityLog parameter fetching by universally passing the `authCtx` derived from `resolveAuthContext` and avoiding redundant manual user/group queries.

### **B. Mixed Error Handling Styles**
- **Files Affected:** `currency.service.ts` and controllers.
- **Why it matters:** Methods like `getCurrencyDetails` throw standard NestJS exceptions (`NotFoundException`, `ForbiddenException`), while `insertCurrency` catches errors and returns `{ success: 0, message: err.message }`. This leads to inconsistent HTTP status codes and response shapes.
- **Proposed Fix:** Move to throwing standard exceptions universally and implement a global NestJS `ExceptionFilter` to map all exceptions to the desired `{ success: 0, message: ... }` JSON structure centrally.

## 5. Scalability Concerns

### **A. The `generate<X>Code` Uniqueness Loop**
- **Files Affected:** `brand.service.ts`, `item.service.ts`, etc.
- **Why it matters:** The current implementation uses a `do { ... } while(true)` loop to increment a counter and query the DB (e.g., checking `BRND001`, then `BRND002`) until it finds an unused code. At scale, if there are 500 items with the same prefix, inserting the 501st item will execute 500 individual DB queries.
- **Proposed Fix:** Use a single query to find the maximum existing code for a prefix, then increment it in memory.
  ```typescript
  const maxCodeRecord = await repository.createQueryBuilder()
    .select('MAX(brandCode)', 'max')
    .where('brandCode LIKE :prefix AND companyId = :companyId', { prefix: `${prefix}%`, companyId })
    .getRawOne();
    
  // Extract number from maxCodeRecord.max, increment by 1, and pad.
  ```

### **B. `syncCurrency` Bulk Update Mechanism**
- **Files Affected:** `currency.service.ts:315`
- **Why it matters:** `syncCurrency` loops through `existingCurrencies` and pushes an individual `.update()` promise per currency into an array. It creates an unnecessary load of individual UPDATE statements on the DB rather than a bulk operation.
- **Proposed Fix:** Execute a bulk update query, or use TypeORM's `save` with an array of entities if chunked properly.

## 6. Transactions

### **A. Missing Transactions on Multi-Step Writes**
- **Files Affected:** `currency.service.ts` (`syncCurrency`).
- **Why it matters:** In `syncCurrency`, `Promise.all(updates)` executes concurrent independent updates. If the database connection drops halfway through, half the currencies will have old rates and half will have new rates. 
- **Proposed Fix:** Wrap multi-table or bulk operations in a transaction.
  ```typescript
  await this.dataSource.transaction(async (manager) => {
    // Execute all currency updates within this manager
    const promises = existingCurrencies.map(cur => 
      manager.update(CurrencyEntity, { curId: cur.curId }, { conversionRate: rate })
    );
    await Promise.all(promises);
  });
  ```

## 7. Leftover Debug Code

### **A. Console Logs and Commented Code**
- **Files Affected:** 
  - `backend/src/utilities/filter.ts` (lines 69, 128, 140)
  - `backend/src/utilities/file.transfer.ts` (lines 7, 16, 49, 87)
  - `backend/src/item/item.service.ts` (line 471)
  - `backend/src/user/user.controller.ts` (lines 73, 111, 195)
- **Why it matters:** Leftover `console.log('hello')` and commented-out debugging blocks clutter production logs and increase technical debt.
- **Proposed Fix:** Remove all `console.log` statements. If logging is required for errors, inject and use NestJS's `Logger` service (`private readonly logger = new Logger(MyService.name)`).
