"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import MultiFilePicker from "../common/MultiFilePicker";
import AsyncSelect from "react-select/async";

const CUSTOMER_CHARGES_OPTIONS = [
    { value: "INVOICE_CHARGES", label: "Invoice Charges" },
    { value: "GLOBAL_CUSTOMER_CHARGES", label: "Global Customer Charges" },
    { value: "DEMO_TEST_CHARGES", label: "Demo / Test Charges" },
];

const TAX_CALC_OPTIONS = [
    { value: "NA", label: "N/A" },
    { value: "EXCLUSIVE", label: "Exclusive" },
    { value: "INCLUSIVE", label: "Inclusive" },
];

function computePreview(totalAmount, taxCalculation, taxRate) {
    const total = parseFloat(totalAmount) || 0;
    const rate = parseFloat(taxRate) || 0;
    let taxAmount = 0;
    let finalAmount = total;

    if (taxCalculation === "INCLUSIVE") {
        taxAmount = rate > 0 ? Math.round((total - total / (1 + rate / 100)) * 10000) / 10000 : 0;
        finalAmount = total;
    } else if (taxCalculation === "EXCLUSIVE") {
        taxAmount = Math.round(((total * rate) / 100) * 10000) / 10000;
        finalAmount = total + (isNaN(taxAmount) ? 0 : taxAmount);
    }
    return { taxAmount: isNaN(taxAmount) ? 0 : taxAmount, finalAmount };
}


export default function CreditNoteFormCore({
    lockedCustomerId = null,
    lockedCustomerName = null,
    lockedCurrencyId = null,
    lockedCurrencyCode = null,
    lockedInvoiceId = null,
    lockedInvoiceCode = null,

    formData,
    onChange,

    selectedFiles,
    onFilesChange,

    companyId = null,

    invoices = [],
    taxGroups = [],

    loading = false,
    onSubmit,
    onCancel,

    errors = {},
}) {
    const needsTaxGroup = formData.taxCalculation && formData.taxCalculation !== "NA";

    const selectedTaxGroup = taxGroups.find(
        (tg) => String(tg.taxId) === String(formData.taxGroupId)
    );
    const taxRate = selectedTaxGroup ? Number(selectedTaxGroup.taxValue) : 0;
    const { taxAmount, finalAmount } = computePreview(formData.totalAmount, formData.taxCalculation, taxRate);

    const fmt = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

    const loadCustomerOptions = (inputValue, callback) => {
        if (!companyId) return callback([]);
        fetch("/relayapi", {
            method: "POST",
            headers: {
                ...authHeaders(),
                endpoint: "customer-currencies-list",
                module: "customer",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                page: 1,
                limit: 50,
                filters: [
                    ...(inputValue ? [{ key: "customerName", value: inputValue, operator: "like" }] : []),
                ],
            }),
        })
            .then((res) => res.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const options = (data?.data?.data ?? data?.data ?? []).map((c) => ({
                    value: `${c.customerId}_${c.curId}`,
                    label: `${c.customer?.customerName} (${c.currency?.code})`,
                    raw: c,
                }));
                callback(options);
            })
            .catch(() => callback([]));
    };

    const handleCustomerCurrencySelect = (option) => {
        if (!option) {
            onChange("customerId", "");
            onChange("customerLabel", "");
            onChange("currencyId", "");
            onChange("currencyCode", "");
            onChange("invoiceId", "");
            return;
        }

        const raw = option.raw;
        const custId = raw.customerId;
        const custName = raw.customer?.customerName || "";
        const curId = raw.curId;
        const curCode = raw.currency?.code || "";

        onChange("customerId", custId ? String(custId) : "");
        onChange("customerLabel", custName);
        onChange("currencyId", String(curId));
        onChange("currencyCode", curCode);
        onChange("invoiceId", "");
    };


    const LockedField = ({ label, value }) => (
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {label}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 cursor-[block]">
                <span className="text-sm font-medium text-gray-700">{value || "—"}</span>
            </div>
        </div>
    );

    const FieldError = ({ name }) =>
        errors[name] ? <p className="mt-1 text-xs text-red-500">{errors[name]}</p> : null;

    return (
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {lockedCustomerId !== null ? (
                <>
                    <LockedField label="Customer" value={lockedCustomerName} />
                    <LockedField label="Currency" value={lockedCurrencyCode} />
                </>
            ) : (
                <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Customer & Currency <span className="text-red-500">*</span>
                    </label>
                    <AsyncSelect
                        instanceId="cn-customer-select"
                        cacheOptions
                        defaultOptions
                        loadOptions={loadCustomerOptions}
                        value={formData.customerId && formData.currencyId ? {
                            value: `${formData.customerId}_${formData.currencyId}`,
                            label: formData.currencyCode ? `${formData.customerLabel} (${formData.currencyCode})` : formData.customerLabel
                        } : null}
                        onChange={handleCustomerCurrencySelect}
                        placeholder="Search customer..."
                        isClearable
                        isDisabled={lockedCustomerId !== null}
                        classNamePrefix="react-select"
                        styles={{
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            control: (base) => ({
                                ...base,
                                borderRadius: "0.75rem",
                                borderColor: (errors.customerId || errors.currencyId) ? "#ef4444" : "#e5e7eb",
                                padding: "1px",
                                fontSize: "0.875rem",
                                boxShadow: "none",
                                "&:hover": { borderColor: (errors.customerId || errors.currencyId) ? "#ef4444" : "#3b82f6" },
                            }),
                        }}
                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                    />
                    <FieldError name="customerId" />
                    <FieldError name="currencyId" />
                </div>
            )}

            {lockedInvoiceId !== null ? (
                <LockedField label="Invoice" value={lockedInvoiceCode} />
            ) : (
                <div>
                    <label htmlFor="cn-invoice" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Invoice <span className="text-red-500">*</span>
                    </label>
                    <select
                        id="cn-invoice"
                        value={formData.invoiceId || ""}
                        onChange={(e) => onChange("invoiceId", e.target.value)}
                        required
                        disabled={!formData.currencyId && !lockedCustomerId}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">{formData.customerId ? "Select invoice…" : "Select a customer first"}</option>
                        {invoices.map((inv) => (
                            <option key={inv.invoiceId} value={inv.invoiceId}>
                                {inv.invoiceCode} — {inv.status}
                            </option>
                        ))}
                    </select>
                    <FieldError name="invoiceId" />
                </div>
            )}

            <div>
                <label htmlFor="cn-charges" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Customer Charges <span className="text-red-500">*</span>
                </label>
                <select
                    id="cn-charges"
                    value={formData.customerCharges || ""}
                    onChange={(e) => onChange("customerCharges", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                >
                    <option value="">Select…</option>
                    {CUSTOMER_CHARGES_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <FieldError name="customerCharges" />
            </div>

            <div>
                <label htmlFor="cn-narration" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Narration <span className="text-red-500">*</span>
                </label>
                <textarea
                    id="cn-narration"
                    value={formData.narration || ""}
                    onChange={(e) => onChange("narration", e.target.value)}
                    rows={2}
                    placeholder="narration…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                />
                <FieldError name="narration" />
            </div>

            <div>
                <label htmlFor="cn-total-amount" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Total Amount <span className="text-red-500">*</span>
                </label>
                <input
                    id="cn-total-amount"
                    step="0.0001"
                    value={formData.totalAmount ?? ""}
                    onChange={(e) => onChange("totalAmount", e.target.value)}
                    placeholder="0.0000"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <FieldError name="totalAmount" />
            </div>

            <div>
                <label htmlFor="cn-tax-calc" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tax Calculation <span className="text-red-500">*</span>
                </label>
                <select
                    id="cn-tax-calc"
                    value={formData.taxCalculation || "NA"}
                    onChange={(e) => {
                        onChange("taxCalculation", e.target.value);
                        if (e.target.value === "NA") onChange("taxGroupId", "");
                    }}
                    required
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                >
                    {TAX_CALC_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            </div>

            {needsTaxGroup && (
                <div>
                    <label htmlFor="cn-tax-group" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Tax Group <span className="text-red-500">*</span>
                    </label>
                    <select
                        id="cn-tax-group"
                        value={formData.taxGroupId || ""}
                        onChange={(e) => onChange("taxGroupId", e.target.value)}
                        required
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
                    >
                        <option value="">Select tax group…</option>
                        {taxGroups.map((tg) => (
                            <option key={tg.taxId} value={tg.taxId}>
                                {tg.taxName} ({tg.taxValue}%)
                            </option>
                        ))}
                    </select>
                    <FieldError name="taxGroupId" />
                </div>
            )}

            <div className="rounded-sm border border-blue-100 px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-xs text-gray-600">
                    <span>Tax Amount</span>
                    <span className="font-semibold text-gray-800">{fmt(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-800 border-t border-blue-100 pt-1.5">
                    <span>Final Amount</span>
                    <span>{fmt(finalAmount)}</span>
                </div>
            </div>

            <div>
                <MultiFilePicker
                    selectedFiles={selectedFiles}
                    onFilesChange={onFilesChange}
                    label="Attachments"
                    required={false}
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                />
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    {loading ? "Saving…" : "Submit"}
                </button>
            </div>
        </form>
    );
}
