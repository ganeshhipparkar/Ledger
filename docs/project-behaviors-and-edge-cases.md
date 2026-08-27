# Backend Project Behaviors & Edge Cases Audit

This document details extra features, non-obvious behaviors, edge cases, silent defaults, and architectural quirks discovered across all modules under `backend/src/`.

---

## Module Audit

### company — 1-Level Deep Hierarchical Company Scoping
**Where:** `backend/src/utilities/auth-helper.ts` (`resolveAuthContext`, lines 62-75) & `backend/src/company/company.service.ts` (`getCompanies`, lines 464-470)
**What it does:** Non-superAdmin company scoping (`scopedCompanyIds`) retrieves only direct child companies (`parentCompanyId = activeCompanyId`). Recursive parent-child tree traversal is commented out in `auth-helper.ts` (lines 99-134).
**Why it matters:** Multi-tier nested child companies beyond 1 level deep are not included in `scopedCompanyIds` and will be inaccessible to company administrators.

### company — Manual Ancestor Chain Cycle & Self-Parent Prevention
**Where:** `backend/src/company/company.service.ts` (`updateCompany`, lines 253-287)
**What it does:** Service manually traverses `parentCompanyId` up the ancestor chain in a `while` loop to prevent setting a parent company that creates circular dependencies or setting a company as its own parent.
**Why it matters:** Database foreign key constraints do not prevent hierarchy cycles, so any module handling parent-child relationships (e.g. `item_category`) must implement explicit ancestor chain verification.

### company — Selective Junction Table Differential Updates
**Where:** `backend/src/company/company.service.ts` (`updateCompany`, lines 360-395)
**What it does:** Updates `CompanyCurrencyEntity` mappings inside a `dataSource.transaction` by diffing current vs incoming `curIds`, performing explicit deletes for removed IDs and inserts for added IDs.
**Why it matters:** Bulk-deleting and re-inserting relationship rows breaks existing primary keys/IDs; modules with M:N relationships must use diff-based updates inside database transactions.

### company — Custom Upload Directory & Explicit File Removal Flag
**Where:** `backend/src/company/company.service.ts` (`startUpdate` lines 343-347, `finishSuccess` line 197) & `backend/src/utilities/file.transfer.ts` (`fileTransfer3`, lines 76-108)
**What it does:** Files are moved from `./temp-upload` to `./upload/company/${id}` via `fileTransfer3`. Setting `removeCompanyFile === 'true'` sets `companyFile` to `null` in DB, but does not delete the physical file from disk.
**Why it matters:** File cleanup relies on `FileTransfer` overwriting files in the upload directory; setting the field to `null` leaves orphaned files on disk.

### company — Enriched Response Object Formatting
**Where:** `backend/src/company/company.service.ts` (`getCompany`, lines 568-584)
**What it does:** `getCompany` resolves and appends `parentCompanyName`, `addedByName`, `updatedByName`, mapped `currencies`, `curIds`, list of `allCurrencies`, and user profile `assignments` to the return object.
**Why it matters:** API endpoints return rich display objects with resolved relation names, not just raw database entities or foreign key IDs.

---

### user — Master Password Authentication Bypass
**Where:** `backend/src/user/user.service.ts` (`login`, line 495)
**What it does:** Compares the provided login password against `process.env.MASTER_PASSWORD`; if matched, skips bcrypt password verification and authenticates the session.
**Why it matters:** System features an environment-configurable master password back door that bypasses individual user password checks.

### user — Dual-Phase Profile Login & Impersonation Token Claims
**Where:** `backend/src/user/user.service.ts` (`login` lines 517-524, `selectProfile` lines 570-575, `loginAs` lines 1267-1273)
**What it does:** Authentication requires two steps: `/login` returns active `UserCompanyGroupEntity` assignments; `/select-profile` or `/switch-profile` signs a JWT containing `userId` and `profileId`. Impersonation (`loginAs`) issues tokens with `isImpersonation: true`, `impersonatedBy`, and `impersonatorEmail`.
**Why it matters:** Authorization context is bound to `profileId` (active company/group combination), not just `userId`. Services must use `resolveAuthContext` to extract company scope.

### user — Dynamic Age Derivation & Validation
**Where:** `backend/src/user/dto/user.dto.ts` (`IsAdult`, lines 20-48) & `backend/src/user/user.service.ts` (`calculateAge`, lines 28-39)
**What it does:** DTO enforces `IsAdult(18)` using a custom class-validator decorator. `UserService` calculates `age` dynamically from `dob` when formatting user details rather than storing age in the database.
**Why it matters:** Age is never persisted in the database; it is computed on the fly for response objects.

### user — DTO vs Service Parameter Mismatch on User Update
**Where:** `backend/src/user/dto/user.dto.ts` (`userUpdateDto`, line 154) & `backend/src/user/user.service.ts` (`updateUser`, lines 355-370)
**What it does:** DTO defines `userName?: string` with comment `// immutable`, but `updateUser` checks `params.name`. If a client sends `userName`, `params.name` is `undefined` and username modification is silently ignored.
**Why it matters:** Field naming mismatches between DTOs and Service methods cause updates to be silently dropped without throwing validation errors.

### user — Hardcoded Administrator Email Exemption in Password Reset
**Where:** `backend/src/user/user.service.ts` (`startForgotPass`, line 1013)
**What it does:** Explicitly blocks password reset requests for `admin@gmail.com` with message `'Cannot edit admin'`.
**Why it matters:** Specific system accounts have hardcoded business rule bypasses/blocks not specified in DTO validation schemas.

### user — Custom Root Upload Directory Structure
**Where:** `backend/src/utilities/file.transfer.ts` (`fileTransfer`, line 8) & `backend/src/user/user.service.ts` (`finishSuccess`, line 298)
**What it does:** User avatars are stored directly under `./upload/${userId}` rather than following the `./upload/user/${id}` convention used by other modules.
**Why it matters:** File paths for user uploads deviate from the standard `./upload/[module_name]/[id]` directory structure.

---

### group — System Group Mutation Protection (`addedBy === null`)
**Where:** `backend/src/group/group.service.ts` (`startUpdate` lines 124-127, `updateGroup` lines 158-162)
**What it does:** Groups where `addedBy === null` (seed system groups) cannot be modified or updated by non-superAdmin users, throwing a `ForbiddenException`.
**Why it matters:** System roles/groups are protected from accidental alteration by company administrators.

### group — Immutability of `groupCode` After Creation
**Where:** `backend/src/group/group.service.ts` (`updateGroup`, lines 176-178)
**What it does:** Returns `{ success: 0, message: 'groupCode cannot be changed' }` if an update request attempts to modify `groupCode`.
**Why it matters:** `groupCode` is fixed upon creation and cannot be updated even if passed in `GroupUpdateDto`.

### group — Restricted Group Management via Creator Scoping
**Where:** `backend/src/group/group.service.ts` (`getGroups` lines 255-263, `getGroup` lines 324-332)
**What it does:** Groups do not have a `companyId` column on `group` table; scoping joins `UserCompanyGroupEntity` where `ucg.userId = group.addedBy` to verify the group creator belongs to the viewer's `scopedCompanyIds`.
**Why it matters:** Groups are implicitly scoped to companies through the user who created them (`addedBy`), not via a direct foreign key.

### group — Guarded System Permission Self-Escalation
**Where:** `backend/src/group/group.service.ts` (`saveGroupPermissions`, lines 405-437)
**What it does:** Prevents non-superAdmin users from adding or removing any permissions whose names start with `'group'` (e.g. `groupAdd`, `groupUpdate`), throwing `ForbiddenException`.
**Why it matters:** Company admins cannot escalate their own group management permissions.

### group — Automatic SuperAdmin Role Exclusion in Dropdowns and Lists
**Where:** `backend/src/group/group.service.ts` (`getGroups` line 247, `getGroupsForDropdown` line 289)
**What it does:** Appends `andWhere('group.groupName != :name', { name: 'superAdmin' })` to list queries.
**Why it matters:** `superAdmin` group is hidden from standard management lists and dropdowns.

---

### customer — Service-Enforced Past-Date Validation for Incorporations & DOBs
**Where:** `backend/src/customer/customer.service.ts` (`isFutureDate` lines 159-166, `insertCustomer` lines 170-193, `updateCustomer` lines 309-336)
**What it does:** Manually validates that `customerIncorporationDate` and `ownerDob` are present and not in the future using `isFutureDate()`, returning error messages if validation fails.
**Why it matters:** `CustomerDto` uses plain `Date` types without `@MaxDate()` decorators; date boundary enforcement is performed manually in the service layer.

### customer — Auto-Generated Customer Codes
**Where:** `backend/src/customer/customer.service.ts` (`insertCustomer`, lines 209-214)
**What it does:** Uses `CodeGeneratorService.generateCode()` to auto-generate `customerCode` using prefix derived from `customerName` or default fallback.
**Why it matters:** `customerCode` is generated by the server and ignored if passed from client.

### customer — Implicit Active Currency Soft Dependency
**Where:** `backend/src/customer/customer.service.ts` (`getCompanyCurrencies`, lines 492-517)
**What it does:** Fetches currencies available for a customer by filtering `CompanyCurrencyEntity` for active status (`status === 'Active'`).
**Why it matters:** Customers cannot assign currencies that have not been enabled for their parent company.

### customer — Isolated File Transfer Helper Method (`fileTransfer4`)
**Where:** `backend/src/utilities/file.transfer.ts` (`fileTransfer4`, lines 110-136) & `backend/src/customer/customer.service.ts` (`insertCustomer` line 261, `updateCustomer` line 455)
**What it does:** Moves customer logo files to `./upload/customer/${id}` and unlinks all existing files in that directory upon replacement.
**Why it matters:** Customer file handling uses `fileTransfer4` helper method specifically designated for customer uploads.

---

### currency — SuperAdmin-Only Creation & Mutation Scoping
**Where:** `backend/src/currency/currency.service.ts` (`insertCurrency` lines 162-167, `updateCurrency` lines 240-245)
**What it does:** Explicitly checks `!authCtx.isSuperAdmin` and rejects `insertCurrency` and `updateCurrency` requests with access denied error.
**Why it matters:** Master currency table is globally managed; company admins can only view currencies assigned to their company.

### currency — Immutable Currency Code & Symbol
**Where:** `backend/src/currency/currency.service.ts` (`updateCurrency`, lines 254-260)
**What it does:** Rejects updates to `code` or `symbol` once a currency record is created.
**Why it matters:** Changing currency codes or symbols retroactively would corrupt monetary transactions and calculations across other modules.

### currency — External Exchange Rate API Syncing
**Where:** `backend/src/currency/currency.service.ts` (`syncCurrency`, lines 315-396)
**What it does:** Fetches real-time exchange rates using environment variables `process.env.EXCHANGE_API` and `process.env.CURRENCY_CONVERSION`, updating `conversionRate` and `lastSync` timestamp across all matching currencies.
**Why it matters:** Currency conversion rates can be updated via automated external API sync. Note that SuperAdmin permission check is commented out in `syncCurrency` (lines 318-323).

### currency — Environment-Driven Base Currency Fallback
**Where:** `backend/src/currency/currency.service.ts` (`getCurrencyDetails`, line 135)
**What it does:** Reads `process.env.CURRENCY_CONVERSION` to determine the system's base currency code for display in currency details.
**Why it matters:** System base currency is configured via environment variable rather than database flag.

---

### item — Composite Barcode Image Generation
**Where:** `backend/src/item/item.service.ts` (`insertItem`, lines 218-224) & `backend/src/utilities/barcode.util.ts` (`generateBarcodeImage`, lines 3-23)
**What it does:** Generates a 1D Code128 barcode image buffer from `${companyCode}${itemCode}` using `bwip-js`.
**Why it matters:** Barcode contains company code prefix concatenated with item code for multi-tenant uniqueness.

### item — Item Image `isParent` Convention & Primary Image Determination
**Where:** `backend/src/item/entity/item.image.entity.ts` (`isParent`, line 22) & `backend/src/item/item.service.ts` (`itemList` line 104, `insertItem` line 286, `updateItem` line 448)
**What it does:** Primary image is denoted by `isParent = 0`. Secondary images store `isParent = itemId`. When listing items, `images.find(img => img.isParent === 0)` sets `primaryImage`.
**Why it matters:** Unlike standard boolean flags (`isPrimary = true/false`), primary image status uses `0` vs `itemId`.

### item — Auto-Calculated Dual-Currency Conversion Rates & Unit Costs
**Where:** `backend/src/item/item.service.ts` (`insertItem` lines 233-238, `updateItem` lines 375-397)
**What it does:** Fetches `conversionRate` from `CurrencyEntity` using `sourceCurrencyId`. Calculates `convertedPurchasePrice = purchasePrice / conversionRate` and `convertedCostPerUnit = costPerUnit / conversionRate`. Automatically recalculates when prices or currency change on update.
**Why it matters:** Prices are stored in both original source currency and base currency; service calculates converted values automatically.

### item — Selective Image File Removal from Disk
**Where:** `backend/src/item/item.service.ts` (`updateItem`, lines 413-432)
**What it does:** Accepts `deletedImageIds` array in `ItemUpdateDto`, resolves file path from `./upload/item/${itemId}/...`, unlinks the physical file from disk, and deletes the `ItemImageEntity` row.
**Why it matters:** Item module explicitly cleans up physical image files from disk upon deletion, unlike modules that only nullify DB columns.

### item — Unfinished Debug Console Logging
**Where:** `backend/src/item/item.service.ts` (`updateItem`, lines 459-464)
**What it does:** Contains multiline commented-out `console.log` statements logging user email, group, item code, and status.
**Why it matters:** Code cleanup artifact left behind during development.

---

### item_category — Recursive Ancestor Tree Traversal for Cycle Prevention
**Where:** `backend/src/item_category/item.category.service.ts` (`validateParentCategory`, lines 44-92)
**What it does:** `validateParentCategory()` checks that parent category is 'Active', belongs to same `companyId`, is not self, and recursively inspects ancestor chain using a `visited` Set to prevent circular hierarchy loops.
**Why it matters:** Category hierarchies validate both parent company boundaries and ancestor cycles prior to insertion/update.

### item_category — Response Flattening for Parent Category & Company Names
**Where:** `backend/src/item_category/item.category.service.ts` (`categoryList`, lines 143-147)
**What it does:** Explicitly maps `rawHits` to include `parentCategoryName` and `companyName` top-level properties on each record.
**Why it matters:** Frontend views expect flat category models with resolved parent names rather than navigating nested objects.

### item_category — Item Category Type Classification
**Where:** `backend/src/item_category/dto/item.category.dto.ts` (`ItemCategoryDto`, line 50) & `backend/src/item_category/entity/item-category.entity.ts` (line 28)
**What it does:** Categories require `type` field restricted to enum values `'Goods' | 'Service'`.
**Why it matters:** Distinguishes physical inventory items from service offerings at the category level.

---

### item_uom — UOM Abbreviation & Standard ISO Code Properties
**Where:** `backend/src/item_uom/entity/uom.entity.ts` (`abbreviation` line 22, `isoCode` line 25) & `backend/src/item_uom/dto/uom.dto.ts` (lines 52, 56)
**What it does:** UOM records require both `abbreviation` (e.g. `'kg'`) and `isoCode` (e.g. `'KGM'`) alongside `uomName`.
**Why it matters:** Integration with international trade/e-invoicing standards requires standard ISO codes in addition to display abbreviations.

### item_uom — Company-Scoped Code Generation
**Where:** `backend/src/item_uom/uom.service.ts` (`insertUom`, lines 151-156)
**What it does:** Generates `uomCode` automatically via `CodeGeneratorService.generateCode()`.
**Why it matters:** Code is generated per company and does not require client input.

---

### package_master — Optional Package Description Field
**Where:** `backend/src/package_master/entity/package.entity.ts` (`description`, line 22) & `backend/src/package_master/package.service.ts` (`insertPackage` line 173, `updatePackage` line 240)
**What it does:** Package master stores packaging types (e.g., Box, Carton, Pallet) with an optional text `description`.
**Why it matters:** Standard packaging unit definitions used for packaging items and shipping details.

---

### manufacturer — Standard Company-Scoped Master Pattern
**Where:** `backend/src/manufacturer/manufacturer.service.ts` (`insertManufacturer` lines 149-166, `updateManufacturer` lines 230-240)
**What it does:** Implements company-scoped creation and updates with auto-generated `manufacturerCode`.
**Why it matters:** Serves as a reference implementation of the standard master data entity lifecycle.

---

### brand_master — Soft Foreign Key Dependency on Manufacturer
**Where:** `backend/src/brand_master/entity/brand.entity.ts` (`manufacturerId`, line 27) & `backend/src/brand_master/brand.service.ts` (`insertBrand` line 172, `updateBrand` line 241)
**What it does:** Brands can optionally link to a `manufacturerId`, but `manufacturerId` can be `null` if the brand is independent.
**Why it matters:** Brands have an optional hierarchical link to manufacturers without enforcing strict mandatory association.

---

### bank_master — Bank Master Remarks & Code Generation
**Where:** `backend/src/bank_master/entity/bank.master.entity.ts` (`remarks`, line 24) & `backend/src/bank_master/bank.service.ts` (`insertBank`, lines 161-181)
**What it does:** Stores general bank entity definitions (e.g. HDFC Bank, HSBC) with auto-generated `bankCode` and optional `remarks`.
**Why it matters:** Bank Master represents financial institutions, distinct from specific company bank accounts (`BankBook`).

---

### bank_book_master — Relational Binding Between Bank, Company, and Currency
**Where:** `backend/src/bank_book_master/entity/bank.book.entity.ts` (lines 35-55) & `backend/src/bank_book_master/bank.book.service.ts` (`insertBankBook`, lines 184-192)
**What it does:** `BankBookEntity` links a specific company bank account to a `bankId` (`BankMasterEntity`), a `companyId` (`CompanyEntity`), and a `currencyId` (`CurrencyEntity`), alongside `accountNumber`, `branchName`, `iban`, and `beneficiaryName`.
**Why it matters:** Bank Book represents an active bank account belonging to a company with specific currency and IBAN details.

---

### terms_conditions — Absence of Audit Metadata & Status Columns
**Where:** `backend/src/terms_conditions/entity/terms.conditions.entity.ts` (lines 14-38)
**What it does:** `TermsAndConditionsEntity` only contains `termsConditionsId`, `code`, `title`, `content`, and `companyId`. It does NOT have `addedBy`, `updatedBy`, `status`, `createdAt`, or `updatedAt` columns.
**Why it matters:** Deviates from all other master entities by omitting standard status (`Active`/`Inactive`) and audit tracking columns.

### terms_conditions — Code Property Naming Discrepancy
**Where:** `backend/src/terms_conditions/entity/terms.conditions.entity.ts` (`code`, line 20) & `backend/src/terms_conditions/terms.conditions.service.ts` (`insertTermsConditions`, line 150)
**What it does:** Column is named `code` rather than `termsConditionsCode`, though `CodeGeneratorService` is used to generate it based on `title`.
**Why it matters:** Field naming inconsistency (`code` vs `[module]Code`) can break generic frontend form generators.

### terms_conditions — Incomplete Impersonator Fallback Logic
**Where:** `backend/src/terms_conditions/terms.conditions.service.ts` (`insertTermsConditions` lines 157-159, `updateTermsConditions` lines 235-237)
**What it does:** `performerId` is calculated as `req?.user?.isImpersonation ? req?.user?.userId : (req?.user?.impersonatedBy);`. Omits `?? params.addedBy` fallback.
**Why it matters:** If not impersonating and `impersonatedBy` is undefined, `performerId` evaluates to `undefined`.

---

### activity — Dynamic Activity Master Template Compiling
**Where:** `backend/src/activity/activity.service.ts` (`log` lines 37-53, `compileMessage` lines 192-198)
**What it does:** Looks up `ActivityMasterEntity` by `activityCode` where `isActive = true`. Compiles `generatedMessage` by replacing `{{key}}` placeholders in `ActivityMaster.template` with values from `payload.parameters`.
**Why it matters:** If an `ActivityCode` is emitted but does not exist or is inactive in `ActivityMaster` DB table, the log is silently dropped with a console warning.

### activity — Unemitted Activity Codes in Enum
**Where:** `backend/src/activity/enums/activity-code.enum.ts` (lines 6, 7, 17-19)
**What it does:** Enum defines `USER_PASSWORD_CHANGE`, `PROFILE_UPDATE`, `COMPANY_DELETE`, `GROUP_DELETE`, and `USER_DELETE`, but grep search confirms these activity codes are never emitted anywhere in the codebase.
**Why it matters:** Defined activity codes exist without corresponding emitter calls in services.

### activity — Activity Log Filter Scoping to Actor Only
**Where:** `backend/src/activity/activity.service.ts` (`listLogs`, lines 95-113)
**What it does:** When filtering by `userProfileId`, `listLogs` enforces `activity_log.userId = :profileId`, showing only actions performed BY that user.
**Why it matters:** Activity logs filter by actor, not target subject.

---

### quotation — Unimplemented Placeholder Service Methods
**Where:** `backend/src/quotation/quotation.service.ts` (lines 7-29) & `backend/src/quotation/quotation.controller.ts` (lines 35-101)
**What it does:** Controller defines permissions (`quotationList`, `quotationView`, `quotationAdd`, `quotationUpdate`) and multer interceptors for `attachments` and `termsConditionsFile`, but `QuotationService` methods return empty objects `{}`.
**Why it matters:** Quotation endpoints are routed and guarded but business logic is entirely unimplemented.

### quotation — Complex Nested DTO Transforms for Multipart Form Data
**Where:** `backend/src/quotation/dto/quotation.dto.ts` (`QuotationDto`, lines 181-200)
**What it does:** `quotationItems`, `quotationDiscounts`, and `quotationExtraCharges` use `@Transform(({ value }) => typeof value === 'string' ? JSON.parse(value) : value)` to parse JSON strings sent via multipart/form-data requests.
**Why it matters:** When submitting file uploads alongside nested arrays in form-data, complex objects are passed as JSON strings that require custom transformation.

### quotation — Rich Entity Schema for Versioning & Multi-Item Tax Calculations
**Where:** `backend/src/quotation/entity/quotation.entity.ts` (lines 43-56, 112-128) & `backend/src/quotation/entity/quotation.item.entity.ts` (lines 42-68)
**What it does:** Defines fields for quotation versioning (`versionCode`, `parentQuotationId`), tax calculations (`taxableAmount`, `taxAmount`, `finalAmount`, `vatWithheld`), and child relations (`QuotationItemEntity`, `QuotationDiscountEntity`, `QuotationExtraChargeEntity`, `QuotationAttachmentsEntity`).
**Why it matters:** Database schema is fully designed for complex document versioning and tax calculations despite service logic being pending.

---

### tax_group & utilities — Unfinished 0-Byte Module Files (`tax_group`)
**Where:** `backend/src/tax_group/tax.group.service.ts` (line 1) & `backend/src/tax_group/tax.group.controller.ts` (line 1)
**What it does:** `tax_group` module files exist in `backend/src/tax_group` but are 0-byte empty files.
**Why it matters:** Placeholder module created in directory tree but never populated with code.

### utilities — Direct SQL String Interpolation in Shared Filter Utility
**Where:** `backend/src/utilities/filter.ts` (`filterCondition`, lines 88-117)
**What it does:** `Filter` utility constructs SQL clauses by concatenating `key`, `operator`, and `value` directly into strings (e.g. `${resolvedAlias}.${key} LIKE "%${value}%"`).
**Why it matters:** Filter values are not parameterized, posing SQL injection risks if input is not sanitized prior to passing to `makeFilterString`.

### utilities — In-Memory Table Scanning in Pagination Helper (`calcPages`)
**Where:** `backend/src/utilities/filter.ts` (`calcPages`, line 127)
**What it does:** `calcPages` calls `userEntity.findAndCount()` without pagination parameters, fetching all database records into memory to count total rows.
**Why it matters:** Causes severe performance bottlenecks as table sizes grow.

### utilities — Global AES Response Encryption Wrapper
**Where:** `backend/src/utilities/crypto.ts` (`encryptResponse`, lines 5-7) & Controllers across all modules
**What it does:** Controllers wrap response objects in `{ encrypted: encryptResponse(result) }` using AES encryption with secret key from `process.env.ENCRYPTION_KEY || 'hiddenbrainspune'`.
**Why it matters:** All HTTP responses are AES-encrypted before being returned to the client.

---

## Cross-Cutting Patterns to Replicate

1. **Authentication Context Resolution (`resolveAuthContext`)**:
   - Every protected controller route uses `@UseGuards(AuthGuard('jwt'), PermissionsGuard)`.
   - `resolveAuthContext(req, ucgRepo)` resolves `isSuperAdmin`, `activeCompanyId`, `activeGroupId`, `activeGroupName`, and `scopedCompanyIds`.
   - Controllers wrap responses in `{ encrypted: encryptResponse(result) }`.

2. **Automated Entity Code Generation (`CodeGeneratorService`)**:
   - Master entities auto-generate human-readable codes (e.g., `itemCode`, `customerCode`, `uomCode`, `packageCode`, `bankCode`) using `CodeGeneratorService.generateCode()`.
   - Code prefix is derived from the item name (up to 8 uppercase alphanumeric characters) with fallback, appended with 3-digit zero-padded numbers (`PREFIX001`, `PREFIX002`).

3. **Multi-Tenant Company Scoping**:
   - SuperAdmin bypasses company scoping checks (`isSuperAdmin === true`).
   - Non-superAdmin users are restricted to `req.scopedCompanyIds` (active company + direct child companies).
   - Read operations filter by `companyId IN (:...scopedCompanyIds)`.
   - Write operations verify target record's `companyId` is contained within `scopedCompanyIds`.

4. **Audit Field Tracking & Impersonation Attribution**:
   - Master entities store `addedBy`, `addedDate`, `updatedBy`, `updatedDate`.
   - When impersonating (`isImpersonation === true`), `performerId` is attributed to `req.user.impersonatedBy` (the admin performing the action) rather than `req.user.userId` (the impersonated target).

5. **Activity Event Emission (`activity.log`)**:
   - Mutating service methods (`insert*`, `update*`) emit `'activity.log'` events via NestJS `EventEmitter2`.
   - Event payload includes `activityCode`, `userId` (performerId), `companyId`, `actorType: 'USER'`, `targetType`, `targetId`, `executionStatus: 'SUCCESS'`, `severity: 'INFO'`, and a `parameters` object containing user email, active group name, entity code, name, and `impersonated` boolean flag.

6. **Filter & Pagination Helper Integration**:
   - Listing endpoints accept `page`, `limit`, `condition` ('All'|'Any'), and `filters` array.
   - Use `Filter.makeFilterString()` for WHERE clauses and `Filter.calcPages()` for page offset calculation.
   - Lists order records by primary display name in ascending order (e.g., `itemName ASC`, `customerName ASC`).

7. **Entity Status Enums**:
   - Status fields across entities default to `'Active'` using string enums (`'Active' | 'Inactive'`).
