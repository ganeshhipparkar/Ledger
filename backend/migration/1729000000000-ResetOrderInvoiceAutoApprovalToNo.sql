-- =========================================================================================
-- ONE-OFF MIGRATION SCRIPT: Reset invoiceAutoApproval to 'NO' for pre-existing orders
--
-- File: 1729000000000-ResetOrderInvoiceAutoApprovalToNo.sql
--
-- BACKGROUND:
-- When the `invoiceAutoApproval` column was first introduced to the `order` table as an ENUM
-- without an explicit default, MySQL's default behavior for ENUM columns populated existing rows
-- with the first declared enum value ('YES'). This mistakenly marked pre-existing orders as
-- having auto-approval enabled.
--
-- INSTRUCTIONS FOR DBA:
-- 1. DO NOT run this script blindly in production.
-- 2. Set the @CUTOFF_DATE variable below to the exact timestamp when the column was added
--    or deployed to your database.
-- 3. Run STEP 1 (the SELECT queries) to review the list and count of orders affected.
-- 4. Verify that only orders created prior to the column introduction will be modified.
-- 5. Run STEP 2 (the UPDATE query) to safely reset `invoiceAutoApproval` to 'NO'.
-- 6. Run STEP 3 to verify that zero unintended 'YES' rows remain prior to the cutoff date.
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- CONFIGURATION: Cutoff Timestamp
-- Replace the placeholder date below with your actual deployment / column creation date.
-- Format: 'YYYY-MM-DD HH:MM:SS'
-- -----------------------------------------------------------------------------------------
SET @CUTOFF_DATE = '2026-10-01 00:00:00'; -- <-- PLACEHOLDER: DBA MUST SET THIS CUTOFF DATE

-- -----------------------------------------------------------------------------------------
-- STEP 1: PRE-CHECK (REVIEW AFFECTED ROWS)
-- Inspect all orders created before the cutoff date that currently have invoiceAutoApproval = 'YES'.
-- -----------------------------------------------------------------------------------------
SELECT 
    orderId,
    orderCode,
    companyId,
    customerId,
    invoiceGenerationOn,
    invoiceAutoApproval,
    addedDate
FROM `order`
WHERE addedDate < @CUTOFF_DATE
  AND invoiceAutoApproval = 'YES'
ORDER BY orderId ASC;

SELECT COUNT(*) AS total_affected_orders
FROM `order`
WHERE addedDate < @CUTOFF_DATE
  AND invoiceAutoApproval = 'YES';

-- -----------------------------------------------------------------------------------------
-- STEP 2: APPLY UPDATE
-- Resets invoiceAutoApproval to 'NO' for pre-existing orders created before @CUTOFF_DATE.
-- -----------------------------------------------------------------------------------------
UPDATE `order`
SET invoiceAutoApproval = 'NO'
WHERE addedDate < @CUTOFF_DATE
  AND invoiceAutoApproval = 'YES';

-- -----------------------------------------------------------------------------------------
-- STEP 3: POST-UPDATE VERIFICATION
-- This query should return 0 rows if all pre-cutoff orders were successfully reset.
-- -----------------------------------------------------------------------------------------
SELECT COUNT(*) AS remaining_pre_cutoff_yes_count
FROM `order`
WHERE addedDate < @CUTOFF_DATE
  AND invoiceAutoApproval = 'YES';
