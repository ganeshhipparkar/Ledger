"use client";

/**
 * InvoiceItemsTable — fork of QuotationItemsTable for the Invoice module.
 *
 * Field names used by the Invoice DTO are identical to the Quotation DTO at
 * the item level (description, quantity, unitPrice, taxCalculation, taxGroup,
 * discounts, extraCharges, totalAmount, taxableAmount, taxAmount, finalAmount).
 *
 * This file re-exports everything from QuotationItemsTable with zero changes so
 * that invoice-specific parent components (`AddInvoice`, `InvoiceUpdate`) import
 * from a stable invoice-namespaced path.  If the invoice item schema diverges in
 * the future, replace this re-export with a full fork.
 */
export {
    default,
    newEmptyItem,
    generateRowId,
} from "../quotation/QuotationItemsTable";
