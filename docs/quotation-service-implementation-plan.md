# QuotationService — Implementation Plan

> **Status: LOCKED — all eight questions resolved, ready for implementation.**
> Update this file in place as the implementation progresses; do not repeat the whole plan in chat.

---

## Open-Questions Resolution Table

| # | Question | Status | Resolution |
|---|---|---|---|
| Q1 | Update semantics for line items | ✅ Confirmed | Full delete-all-then-reinsert. `QuotationItemInputDto` has no `quotationItemId`; no diffing possible. See Known Tradeoffs. |
| Q2 | Tax rate source | ✅ Confirmed | Real lookup against `taxGroupEntity` via `taxCode` + `companyId`. Returns `0` if no row found. `taxGroup` column stays `varchar`. See detail below. |
| Q3 | Aggregate formula | ✅ Confirmed | Formula verified against screenshot and signed off. See detail below. |
| Q4 | `termsConditionsFile` vs `termsConditionsId` exclusivity | ✅ Confirmed | No guard. Store both if both arrive. Frontend UX concern only. |
| Q5 | FK scoping on customer/bankBook/salesPerson | ✅ Confirmed | No backend cross-entity FK validation. Scope check on `companyId` only. |
| Q6 | Transactionality | ✅ Confirmed | Use `QueryRunner` transaction for `insertQuotation` and `updateQuotation`. |
| Q7 | `expiryDate` validation | ✅ Confirmed | Validated in service (return `{ success:0 }` with message), not in DTO. |
| Q8 | Status transitions | ✅ Confirmed | No restricted transitions. Any enum value settable via update. Comment in code for future. |
| — | `quantity` field type | ✅ Confirmed assumption | Free-text numeric input; allows manual decimal entry. `computeItemAmounts` treats it as a plain number throughout — no change needed. |

---

## Q2 — Tax Rate Source & `resolveTaxRate()` (CONFIRMED — real implementation)

### Codebase findings (verified before writing this section)

- `quotation_items.taxGroup` is **still a plain `varchar`** — not an int FK.
- `taxGroupEntity` exists at `src/tax_group/entity/tax.group.entity.ts` (class name: `taxGroupEntity`, lowercase).
- Relevant columns: `taxCode` (auto-generated code, matched against the `taxGroup` varchar), `taxValue` (flat rate number), `companyId` (per-company scope).
- No `status` column on `taxGroupEntity` — no Active/Inactive filter needed.

### What the code will do

Tax-group validation is an **upfront pass** run before the transaction begins, not inside
`computeItemAmounts`. This means an invalid `taxGroup` code rejects the entire request before any
DB write happens.

#### Step 1 — `validateTaxGroups(items, companyId)` (new helper)

Called right after `validateDates`, before `computeItemAmounts`:

```typescript
private async validateTaxGroups(
  items: QuotationItemInputDto[],
  companyId: number,
): Promise<{ valid: true; rateMap: Map<string, number> } | { valid: false; message: string }> {
  const invalidCodes: string[] = [];
  const rateMap = new Map<string, number>();

  for (const item of items) {
    if (item.taxCalculation !== TaxCalculation.EXCLUSIVE || !item.taxGroup) continue;
    if (rateMap.has(item.taxGroup)) continue;  // already looked up this code

    const rec = await this.taxGroupRepo.findOne({
      where: { taxCode: item.taxGroup, companyId },
    });
    if (!rec) {
      invalidCodes.push(item.taxGroup);
    } else {
      rateMap.set(item.taxGroup, Number(rec.taxValue));
    }
  }

  if (invalidCodes.length > 0) {
    return {
      valid: false,
      message: `Invalid tax group code(s) for this company: ${invalidCodes.join(', ')}`,
    };
  }
  return { valid: true, rateMap };
}
```

If `valid: false`, the caller immediately returns `{ success: 0, message }` **without opening a
transaction**.

#### Step 2 — `computeItemAmounts(item, taxRate)` receives the pre-resolved rate

`computeItemAmounts` no longer does any repository lookup. The `taxRate` for the item is passed in
directly from the `rateMap` returned by `validateTaxGroups`:

```typescript
// taxRate already resolved — 0 for NA items, rateMap.get(item.taxGroup) for EXCLUSIVE
private computeItemAmounts(item: QuotationItemInputDto, taxRate: number): ComputedItemAmounts {
  const rawAmount       = Number(item.quantity) * Number(item.unitPrice);
  const itemDiscount    = (item.discounts    ?? []).reduce((s, d)  => s + Number(d.discountPrice),     0);
  const itemExtraCharge = (item.extraCharges ?? []).reduce((s, ec) => s + Number(ec.extraChargesPrice), 0);
  const totalAmount     = rawAmount - itemDiscount + itemExtraCharge;
  const taxableAmount   = item.taxCalculation === TaxCalculation.EXCLUSIVE ? totalAmount : 0;
  const taxAmount       = Math.round(taxableAmount * taxRate / 100 * 10000) / 10000;
  const finalAmount     = totalAmount + taxAmount;
  return { totalAmount, taxableAmount, taxAmount, finalAmount };
}
```

`resolveTaxRate` as a separate private method is removed entirely — its role is fully replaced by
`validateTaxGroups` + the `rateMap` passed to `computeItemAmounts`.

`validateTaxGroups` is called only when `quotationItems` is present (which is always true for
`insertQuotation`; conditional for `updateQuotation` if items are being replaced).

---

## Q3 — Aggregate Formula (CONFIRMED)

### Item-level computation (inside `computeItemAmounts`)

```
rawAmount       = quantity × unitPrice
itemDiscount    = Σ item.discounts[].discountPrice       (0 if array empty/absent)
itemExtraCharge = Σ item.extraCharges[].extraChargesPrice (0 if array empty/absent)
totalAmount     = rawAmount − itemDiscount + itemExtraCharge

taxableAmount   = (taxCalculation === EXCLUSIVE) ? totalAmount : 0
                  // EXCLUSIVE items contribute to taxableAmount; NA items do not
taxRate         = pre-resolved from rateMap (passed in as an argument — 0 for NA items)
taxAmount       = round(taxableAmount × taxRate / 100, 4)
finalAmount     = totalAmount + taxAmount
```

### Quotation-level aggregation (inside `computeQuotationTotals`)

```
quotation.totalAmount    = Σ item.totalAmount
                           // "Gross Amount" in summary panel — all items regardless of tax type

quotation.taxableAmount  = Σ item.taxableAmount
                           // "Taxable Amount" in summary panel — EXCLUSIVE items only
                           // "Non Taxable Amount" (display only) = totalAmount − taxableAmount

quotation.taxAmount      = Σ item.taxAmount
                           // "Tax Amount" in summary panel

quotation.discount       = Σ quotationDiscounts[].discountPrice     (null if no rows)
                           // "Less/Discount" line in summary panel (stored as positive)

quotation.extraCharge    = Σ quotationExtraCharges[].extraChargesPrice (null if no rows)
                           // "Add/Extra Charge" line in summary panel

quotation.finalAmount    = totalAmount + taxAmount + (extraCharge ?? 0) − (discount ?? 0)
                           // "Net Amount" = "Final Amount" = "Receivable" in summary panel
                           // Uses totalAmount (gross), not taxableAmount — must include NA items
```

### Verification against the screenshot

```
totalAmount   = 1,010.00  (qty 10 × 100.00, less item discount 10, plus item extra charge 20)
taxableAmount = 1,010.00  (all EXCLUSIVE in this example; non-taxable = 0)
taxAmount     =    75.75  (VAT 7.5% × 1,010.00)
extraCharge   =    10.00  (quotation-level extra charge row)
discount      =    20.00  (quotation-level discount row)
finalAmount   = 1,010.00 + 75.75 + 10.00 − 20.00 = 1,075.75  ✓
```

---

## Q4 — Terms & Conditions (REVISED — no guard)

Both `termsConditionsFile` (uploaded PDF path) and `termsConditionsId` (FK to a template) are
independent nullable columns. If both are present in the same request, both are stored. No validation,
no precedence rule. The "Upload **OR** Select Template" wording in the UI is a frontend UX
constraint only.

`termsConditionsText` (free text alongside a selected template) is independent of both.

---

## Files Touched

| File | Action |
|---|---|
| `src/quotation/quotation.service.ts` | **Full implementation** (primary deliverable) |
| `src/quotation/quotation.module.ts` | Add 7 missing entities to `TypeOrmModule.forFeature`; add `CodeGeneratorService` to `providers` |
| `src/activity/enums/activity-code.enum.ts` | Append `QUOTATION_CREATE` and `QUOTATION_UPDATE` |
| `src/utilities/file.transfer.ts` | Add `fileTransferQuotation(filename, id, subfolder)` method |

### Entities/providers to add to `quotation.module.ts`

```typescript
// Add to TypeOrmModule.forFeature([...]):
QuotationEntity,
QuotationItemEntity,
QuotationDiscountEntity,
QuotationExtraChargeEntity,
QuotationAttachmentsEntity,
TermsAndConditionsEntity,
BankBookEntity,
ItemEntity,
ManufacturerEntity,
taxGroupEntity,          // src/tax_group/entity/tax.group.entity.ts

// Add to providers: [...]:
CodeGeneratorService,
```

---

## Step 0 — Pre-flight Fixes (Other Files)

### `activity-code.enum.ts`
Append after `TERMS_CONDITIONS_UPDATE`:
```typescript
QUOTATION_CREATE = 'QUOTATION_CREATE',
QUOTATION_UPDATE = 'QUOTATION_UPDATE',
```

### `file.transfer.ts`
Add method (mirrors `fileTransferItem` exactly, new path):
```typescript
async fileTransferQuotation(filename: string, id: number, subfolder: 'attachments' | 'terms') {
  const targetDir = `./upload/quotation/${id}/${subfolder}`;
  try {
    const source = path.join('./temp-upload', filename);
    const dest   = path.join(targetDir, filename);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    if (fs.existsSync(source)) {
      try {
        await fs.promises.rename(source, dest);
      } catch {
        await fs.promises.copyFile(source, dest);
        await fs.promises.unlink(source);
      }
    }
  } catch (error) {
    return error;
  }
}
```
No pre-existing file deletion on upload: attachments are additive; `termsConditionsFile` path
is overwritten in the DB column but the old physical file is not deleted (matches item image
pattern).

---

## Step 1 — Constructor & Injections

```typescript
constructor(
  @InjectRepository(QuotationEntity)            private quotationRepo:     Repository<QuotationEntity>,
  @InjectRepository(QuotationItemEntity)         private quotationItemRepo:  Repository<QuotationItemEntity>,
  @InjectRepository(QuotationDiscountEntity)     private discountRepo:       Repository<QuotationDiscountEntity>,
  @InjectRepository(QuotationExtraChargeEntity)  private extraChargeRepo:    Repository<QuotationExtraChargeEntity>,
  @InjectRepository(QuotationAttachmentsEntity)  private attachmentRepo:     Repository<QuotationAttachmentsEntity>,
  @InjectRepository(UserCompanyGroupEntity)      private ucgEntity:          Repository<UserCompanyGroupEntity>,
  @InjectRepository(UserEntity)                  private userEntity:         Repository<UserEntity>,
  @InjectRepository(CurrencyEntity)              private currencyRepo:       Repository<CurrencyEntity>,
  @InjectRepository(taxGroupEntity)              private taxGroupRepo:       Repository<taxGroupEntity>,
  private readonly eventEmitter: EventEmitter2,
  private readonly fileTransfer: FileTransfer,
  private readonly dataSource: DataSource,       // for QueryRunner transactions
)

@Inject() private readonly filter!: Filter;
@Inject() private readonly codeGeneratorService!: CodeGeneratorService;
```

---

## Step 2 — Private Helpers

### `validateTaxGroups(items, companyId)` — upfront validation pass
For every item where `taxCalculation === EXCLUSIVE`: looks up `taxGroup` (varchar) against
`taxGroupRepo` by `taxCode + companyId`. Collects all unmatched codes.
- If any unmatched → returns `{ valid: false, message: 'Invalid tax group code(s): ...' }`
- If all matched → returns `{ valid: true, rateMap: Map<taxCode, taxValue> }`
Called **before the transaction opens**.

### `computeItemAmounts(item, taxRate)` — pure calculation, no DB calls
Receives the pre-resolved `taxRate` from the caller (sourced from `validateTaxGroups` rateMap;
`0` for NA items). Applies the item-level formula from Q3.
Returns `{ totalAmount, taxableAmount, taxAmount, finalAmount }`.

### `resolvePerformer(req, fallbackId?)`
Mirrors `ItemService` impersonation-aware actor extraction:
```typescript
const performerId    = req?.user?.isImpersonation
  ? req?.user?.userId
  : (req?.user?.impersonatedBy ?? fallbackId);
const performerEmail = req?.user?.isImpersonation
  ? req?.user?.email
  : (req?.user?.impersonatorEmail ?? '');
return { performerId, performerEmail };
```

### `computeItemAmounts(item: QuotationItemInputDto)`
Applies the item-level formula from Q3. Calls `resolveTaxRate` only when
`taxCalculation === EXCLUSIVE && item.taxGroup != null`.
Returns `{ totalAmount, taxableAmount, taxAmount, finalAmount }`.

### `computeQuotationTotals(computedItems[], quotationDiscounts[], quotationExtraCharges[])`
Applies the quotation-level aggregation from Q3.
Returns `{ totalAmount, taxableAmount, taxAmount, discount, extraCharge, finalAmount }`.

### `validateDates(issueDate: string, expiryDate: string): string | null`
Returns an error string if invalid, `null` if OK:
- Parse both as `Date`; if either is `Invalid Date` → error
- If `issueDate >= expiryDate` → error
- If `daysBetween(issueDate, expiryDate) < 15` → error

---

## Step 3 — `quotationList`

```
1.  resolveAuthContext(req, ucgEntity)
2.  createQueryBuilder('quotation')
3.  if !superAdmin: andWhere('quotation.companyId IN (:...scopedCompanyIds)')
4.  makeFilterString(filters, 'quotation', aliasMap, condition)
5.  calcPages(param, quotationRepo)
6.  leftJoinAndSelect: customer, currency, company, salesPerson, bankBook
7.  skip/take, orderBy('quotation.quotationCode', 'ASC')
8.  getManyAndCount()
9.  map → spread + customerName, currencyCode, companyName, salesPersonName, bankBookName
10. return { success:1, message:'Quotations fetched successfully', total, data }
```
Wrapped in try/catch → `{ success: 0, message: err.message }`.

---

## Step 4 — `getQuotationDetails`

```
1.  resolveAuthContext(req, ucgEntity)
2.  findOne({ where: { quotationId: id }, relations: [
      'customer', 'currency', 'company', 'bankBook', 'salesPerson',
      'termsConditions', 'quotationItems', 'quotationItems.item',
      'quotationItems.discounts', 'quotationItems.extraCharges',
      'discounts', 'extraCharges', 'attachments'
    ]})
3.  if !quotation → throw NotFoundException('Quotation not found')
4.  if !superAdmin && !scopedCompanyIds.includes(quotation.companyId) → throw ForbiddenException
5.  resolve addedByUser, updatedByUser names (same pattern as getItemDetails)
6.  return { ...quotation, customerName, companyName, ... addedByName, updatedByName }
```
Not wrapped in try/catch — throws `HttpException` subclasses; NestJS handles them.

---

## Step 5 — `insertQuotation`

```
1.  resolveAuthContext(req, ucgEntity)
2.  Company scope check on body.companyId
      → return { success:0, message:'Access denied...' } if denied
3.  ~~terms exclusivity guard~~ REMOVED (Q4)
4.  validateDates(body.issueDate, body.expiryDate)
      → return { success:0, message } if invalid
5.  validateTaxGroups(body.quotationItems, body.companyId)
      → if valid:false → return { success:0, message:'Invalid tax group code(s): <values>' }
      → captures rateMap (taxCode → taxValue) for all EXCLUSIVE items
6.  generateCode(quotationRepo, body.customerId.toString(), body.companyId, 'quotationCode', 'QUO')
7.  Lookup currency by currencyId → extract currencyCode
8.  Compute amounts:
      computedItems = body.quotationItems.map(item =>
        computeItemAmounts(item, item.taxCalculation === EXCLUSIVE ? rateMap.get(item.taxGroup) : 0))
      totals        = computeQuotationTotals(computedItems, body.quotationDiscounts, body.quotationExtraCharges)
9.  resolvePerformer(req, body.addedBy)
10. BEGIN queryRunner transaction
11.   INSERT quotation row (all scalar fields + computed totals), capture insertId
12.   For each item in body.quotationItems (with its computedAmounts):
        INSERT quotation_items row, capture itemInsertId
        For each discount in item.discounts:
          INSERT quotation_discount { quotationItemId: itemInsertId, quotationId: null, ... }
        For each extraCharge in item.extraCharges:
          INSERT quotation_extra_charge { quotationItemId: itemInsertId, quotationId: null, ... }
13.   For each discount in body.quotationDiscounts:
        INSERT quotation_discount { quotationId: insertId, quotationItemId: null, ... }
14.   For each extraCharge in body.quotationExtraCharges:
        INSERT quotation_extra_charge { quotationId: insertId, quotationItemId: null, ... }
15. COMMIT
16. File uploads (outside transaction — file I/O cannot be rolled back):
      if files.termsConditionsFile[0]:
        fileTransferQuotation(filename, insertId, 'terms')
        UPDATE quotation SET termsConditionsFile = '/upload/quotation/{id}/terms/{filename}'
      for each file in files.attachments:
        fileTransferQuotation(filename, insertId, 'attachments')
        INSERT quotation_attachments { quotationId: insertId, attachmentUrl, addedBy, addedDate }
17. eventEmitter.emit('activity.log', {
      activityCode: ActivityCode.QUOTATION_CREATE,
      userId: performerId,
      companyId: body.companyId,
      actorType: 'USER', targetType: 'QUOTATION', targetId: String(insertId),
      executionStatus: 'SUCCESS', severity: 'INFO',
      parameters: { quotationCode, customerId, companyId, impersonated: !!req?.user?.isImpersonation },
    })
18. return { success:1, message:'Quotation created successfully', data: { insertData: insertId } }

catch (err) → queryRunner.rollbackTransaction(); return { success:0, message: err.message }
finally     → queryRunner.release()
```

---

## Step 6 — `updateQuotation`

```
1.  Guard: if !body.quotationId → return { success:0, message:'quotationId is mandatory' }
2.  resolveAuthContext(req, ucgEntity)
3.  findOne existing quotation (no relations needed for update)
4.  if !found → return { success:0, message:'Quotation not found' }
5.  Scope check on existing.companyId
6.  ~~terms exclusivity guard~~ REMOVED (Q4)
7.  If issueDate or expiryDate present:
      effectiveIssue  = body.issueDate  ?? existing.issueDate
      effectiveExpiry = body.expiryDate ?? existing.expiryDate
      validateDates(effectiveIssue, effectiveExpiry) → return { success:0 } if invalid
8.  If body.quotationItems present:
      validateTaxGroups(body.quotationItems, effectiveCompanyId)
        → if valid:false → return { success:0, message:'Invalid tax group code(s): <values>' }
        → captures rateMap for all EXCLUSIVE items
      computedItems = body.quotationItems.map(item =>
        computeItemAmounts(item, item.taxCalculation === EXCLUSIVE ? rateMap.get(item.taxGroup) : 0))
      totals = computeQuotationTotals(computedItems, body.quotationDiscounts, body.quotationExtraCharges)
9.  Build quotationPatch (only fields !== undefined — mirrors ItemService.updateItem):
      scalar fields: customerId, currencyId, issueDate, expiryDate, companyId, remarks,
                     termsConditionsId, termsConditionsText, bankBookId, accountNumber,
                     salesPersonId, currencyConversionRate, vatWithheld, status
      if amounts recomputed: include all 5 financial columns from totals
      if new currencyId: lookup currencyCode, include currencyCode in patch
      updatedBy, updatedDate
10. resolvePerformer(req, body.updatedBy)
11. BEGIN queryRunner transaction
12.   UPDATE quotation SET {...quotationPatch} WHERE quotationId
13.   If body.quotationItems present:
        (a) DELETE quotation_discount WHERE quotationItemId IN
              (SELECT quotationItemId FROM quotation_items WHERE quotationId = id)
        (b) DELETE quotation_extra_charge (item-level) — same subquery pattern
        (c) DELETE quotation_items WHERE quotationId = id
        (d) Re-insert items + their discounts/extra charges (same loop as Step 5 §12)
14.   If body.quotationDiscounts present:
        DELETE quotation_discount WHERE quotationId = id AND quotationItemId IS NULL
        Re-insert quotation-level discounts
15.   If body.quotationExtraCharges present:
        DELETE quotation_extra_charge WHERE quotationId = id AND quotationItemId IS NULL
        Re-insert quotation-level extra charges
16. COMMIT
17. deletedAttachmentIds handling (outside transaction):
      For each attachmentId:
        find QuotationAttachmentsEntity row
        if row found: unlink physical file from disk (try/catch, ignore ENOENT)
        DELETE row
18. New attachment files (outside transaction):
      for each file in files.attachments:
        fileTransferQuotation(filename, quotationId, 'attachments')
        INSERT quotation_attachments row
19. New termsConditionsFile (outside transaction):
      if files.termsConditionsFile[0]:
        fileTransferQuotation(filename, quotationId, 'terms')
        UPDATE quotation SET termsConditionsFile = '/upload/quotation/{id}/terms/{filename}'
        (old file NOT deleted from disk — mirrors item image append pattern)
20. eventEmitter.emit('activity.log', {
      activityCode: ActivityCode.QUOTATION_UPDATE,
      userId: performerId, companyId: existing.companyId,
      actorType: 'USER', targetType: 'QUOTATION', targetId: String(quotationId),
      executionStatus: 'SUCCESS', severity: 'INFO',
      parameters: { quotationCode: existing.quotationCode,
                    status: body.status ?? existing.status,
                    impersonated: !!req?.user?.isImpersonation },
    })
21. return { success:1, message:'Quotation updated successfully' }

catch (err) → queryRunner.rollbackTransaction(); return { success:0, message: err.message }
finally     → queryRunner.release()
```

---

## Design Decisions Summary

| Decision | Rationale |
|---|---|
| `validateTaxGroups()` runs before transaction opens | Invalid tax code must reject the entire request; silent-zero fallback would let bad data produce wrong financial totals |
| All invalid codes collected and reported together | Better DX — client sees all bad codes in one round trip, not just the first failure |
| `computeItemAmounts` receives pre-resolved `taxRate` arg | No DB call inside the calculation loop; clean separation between validation and math |
| `item.taxableAmount = totalAmount` for EXCLUSIVE, `0` for NA | Matches screenshot's "Taxable Amount" / "Non Taxable Amount" split in summary panel |
| `quotation.finalAmount = totalAmount + taxAmount + extraCharge − discount` | Verified against screenshot (1010 + 75.75 + 10 − 20 = 1075.75); uses gross (`totalAmount`), not `taxableAmount`, to include NA items |
| No terms exclusivity guard | Q4 confirmed — both columns independent; frontend UX concern only |
| QueryRunner transaction for write methods | Multi-table write; partial failure would leave orphaned quotation rows |
| File I/O outside transaction | File renames cannot be rolled back; consistent with item pattern |
| Full item replace on update | `QuotationItemInputDto` has no `quotationItemId`; diffing impossible |
| Date validation in service, not DTO | No custom class-validators exist anywhere in this codebase |
| No status transition guards | Not specified; comment in code marks it for future implementation |
| `quotationCode` prefix from `customerId.toString()` | Matches `itemCode` pattern: first 8 chars of the "name" param, uppercased |

---

## Known Tradeoffs

### Delete-then-reinsert for `quotation_items` on update (Q1)

Within the current codebase, **nothing outside the quotation module holds a foreign reference to
`quotationItemId`**. The mapping tables (`quotation_discount`, `quotation_extra_charge`) are torn
down and rebuilt together with their parent `quotation_items` rows inside the same transaction step,
so they never point at a stale ID — the approach is safe today.

> [!WARNING]
> **Revisit if a future module ever references `quotationItemId` directly** (e.g. an invoice or
> sales order generated from a specific line item). Under the current replace-all strategy, that
> foreign reference would silently dangle on the next quotation update, because the old
> `quotationItemId` values are deleted and new ones are assigned. At that point, line-item updates
> will need either (a) a stable `quotationItemId` threaded through the DTO and a proper merge
> strategy, or (b) a cascade-nullify rule on the referencing table.

---

## Changelog

| Date | Change |
|---|---|
| 2026-08-24 | Initial plan created (two rounds of Q&A with corrections for Q2, Q3, Q4) |
| 2026-08-24 | Q2 resolved: real `taxGroupEntity` lookup wired up (match on `taxCode` + `companyId`, return 0 on miss). Q3 formula confirmed. Q1 tradeoff documented. Plan status → LOCKED. |
| 2026-08-24 | Q2 corrected: removed silent-zero fallback. Replaced `resolveTaxRate` with upfront `validateTaxGroups` pass (reject-on-invalid before transaction, collect all bad codes). `computeItemAmounts` now receives pre-resolved `taxRate` arg — no DB call inside calculation loop. Steps 5 and 6 updated accordingly. |

