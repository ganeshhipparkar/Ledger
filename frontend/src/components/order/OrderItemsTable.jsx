"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import AsyncSelect from "react-select/async";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { limitDecimals } from "@/lib/utils";
import OrderDiscountSidePanel from "./OrderDiscountSidePanel";
import OrderExtraChargeSidePanel from "./OrderExtraChargeSidePanel";

let rowIdCounter = 0;
export function generateRowId() {
    rowIdCounter += 1;
    return `row-${rowIdCounter}`;
}

const TAX_CALC_OPTIONS = ["N/A", "EXCLUSIVE", "INCLUSIVE"];

export function getItemLabel(it) {
    if (!it) return "";
    const name =
        it.itemName ||
        it.item?.itemName ||
        it.item_itemName ||
        it.name ||
        it.item?.name ||
        "";
    const code =
        it.itemCode ||
        it.item?.itemCode ||
        it.item_itemCode ||
        it.code ||
        it.item?.code ||
        "";
    if (name && code) return `${name} (${code})`;
    if (name) return name;
    if (code) return code;
    return it.itemLabel || "";
}

export function newEmptyItem() {
    return {
        _id: generateRowId(),
        itemId: "",
        itemLabel: "",
        itemGL: "",
        isDecimalAllowed: true,
        baseCurrencyPrice: 0,
        quantity: "",
        unitPrice: "",
        amount: 0,
        totalAmount: 0,
        taxCalculation: "N/A",
        taxGroupId: "",
        taxGroup: "",
        taxGroupLabel: "",
        taxRate: 0,
        taxAmount: 0,
        taxableAmount: 0,
        finalAmount: 0,
        discounts: [],
        extraCharges: [],
        discountTotal: 0,
        extraChargeTotal: 0,
    };
}

export function computeItem(item) {
    const qty = Math.max(0, parseFloat(item.quantity) || 0);
    const up = Math.max(0, parseFloat(item.unitPrice) || 0);
    const amount = qty * up;
    const discountTotal = (item.discounts || []).reduce((s, d) => s + Math.max(0, parseFloat(d.discountPrice ?? d.amount) || 0), 0);
    const extraChargeTotal = (item.extraCharges || []).reduce((s, ec) => s + Math.max(0, parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0), 0);
    const rawTotalAmount = amount - discountTotal + extraChargeTotal;
    const totalAmount = isNaN(rawTotalAmount) ? 0 : Math.max(0, rawTotalAmount);
    const rate = parseFloat(item.taxRate) || 0;
    let taxableAmount = 0;
    let taxAmount = 0;
    let finalAmount = totalAmount;

    if (item.taxCalculation === "INCLUSIVE") {
        taxableAmount = rate > 0 ? totalAmount / (1 + rate / 100) : totalAmount;
        taxAmount = totalAmount - taxableAmount;
        finalAmount = totalAmount;
    } else if (item.taxCalculation === "EXCLUSIVE") {
        taxableAmount = totalAmount;
        taxAmount = (taxableAmount * rate) / 100;
        finalAmount = totalAmount + (isNaN(taxAmount) ? 0 : taxAmount);
    } else {
        taxableAmount = 0;
        taxAmount = 0;
        finalAmount = totalAmount;
    }
    const resolvedLabel = item.itemLabel || getItemLabel(item);
    return {
        ...item,
        itemLabel: resolvedLabel,
        amount: isNaN(amount) ? 0 : amount,
        discountTotal: isNaN(discountTotal) ? 0 : discountTotal,
        extraChargeTotal: isNaN(extraChargeTotal) ? 0 : extraChargeTotal,
        totalAmount,
        taxableAmount: isNaN(taxableAmount) ? 0 : taxableAmount,
        taxAmount: isNaN(taxAmount) ? 0 : taxAmount,
        finalAmount: isNaN(finalAmount) ? 0 : finalAmount,
    };
}

export default function OrderItemsTable({
    items,
    onChange,
    companyId,
    currencyConversionRate = 1,
    currencySymbol = "",
}) {
    const [taxGroups, setTaxGroups] = useState([]);
    const [discountPanel, setDiscountPanel] = useState({ open: false, idx: -1 });
    const [extraChargePanel, setExtraChargePanel] = useState({ open: false, idx: -1 });

    useEffect(() => {
        if (!companyId) return;
        (async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        endpoint: "tax-group-list",
                        module: "tax-group",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ page: 1, limit: 200, filters: [{ key: "companyId", value: String(companyId), operator: "eq" }] }),
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const rawList = data?.data ?? [];
                const unique = [];
                const seen = new Set();
                rawList.forEach((tg) => {
                    const id = tg.taxId ?? tg.taxGroupId ?? tg.taxCode;
                    if (id && !seen.has(id)) {
                        seen.add(id);
                        unique.push(tg);
                    }
                });
                setTaxGroups(unique);
            } catch {
                setTaxGroups([]);
            }
        })();
    }, [companyId]);

    const loadItemOptions = (inputValue, callback) => {
        if (!companyId) return callback([]);
        fetch("/relayapi", {
            method: "POST",
            headers: {
                ...authHeaders(),
                endpoint: "item-list",
                module: "item",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                page: 1,
                limit: 20,
                filters: [
                    { key: "companyId", value: String(companyId), operator: "eq" },
                    ...(inputValue ? [{ key: "itemName", value: inputValue, operator: "like" }] : []),
                ],
            }),
        })
            .then((res) => res.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const options = (data?.data ?? []).map((it) => ({
                    value: it.itemId,
                    label: `${it.itemName} (${it.itemCode})`,
                    raw: it,
                }));
                callback(options);
            })
            .catch(() => callback([]));
    };

    const handleItemSelect = (idx, selectedItem) => {
        if (!selectedItem) {
            const updated = items.map((it, i) => (i === idx ? newEmptyItem() : it));
            onChange(updated);
            return;
        }

        const rawObj = selectedItem.raw || selectedItem;
        const realItemId = rawObj.itemId ?? rawObj.value ?? rawObj.id;
        const itemName = rawObj.itemName ?? rawObj.label ?? "";
        const itemCode = rawObj.itemCode ? ` (${rawObj.itemCode})` : "";
        const convRate = parseFloat(currencyConversionRate) || 0;
        const basePrice = parseFloat(rawObj.convertedCostPerUnit) ||
            (parseFloat(rawObj.costPerUnit) / (parseFloat(rawObj.conversionRate) || 1)) || 0;
        const unitPrice = convRate > 0 ? basePrice * convRate : 0;

        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            return computeItem({
                ...it,
                itemId: realItemId,
                itemLabel: selectedItem.label ?? (itemName ? `${itemName}${itemCode}` : ""),
                isDecimalAllowed: rawObj.isDecimalAllowed !== "false",
                baseCurrencyPrice: basePrice,
                quantity: rawObj.primitiveQuantity ?? 1,
                unitPrice: parseFloat(unitPrice.toFixed(4)),
            });
        });
        onChange(updated);
    };

    const handleFieldChange = (idx, field, value) => {
        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            let val = value;
            if (field === "quantity" && !it.isDecimalAllowed) {
                val = String(parseInt(value, 10) || "");
            } else if (field === "quantity" || field === "unitPrice") {
                val = limitDecimals(value);
            }
            return computeItem({ ...it, [field]: val });
        });
        onChange(updated);
    };

    const handleTaxGroupSelect = (idx, selectVal) => {
        const tg = taxGroups.find((t) => String(t.taxId ?? t.taxGroupId ?? t.taxCode) === String(selectVal));
        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            return computeItem({
                ...it,
                taxGroupId: tg ? (tg.taxId ?? tg.taxGroupId) : "",
                taxGroup: tg?.taxCode ?? "",
                taxGroupLabel: tg?.taxName ?? tg?.taxCode ?? "",
                taxRate: parseFloat(tg?.taxValue) || 0,
            });
        });
        onChange(updated);
    };

    const handleTaxCalcChange = (idx, val) => {
        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            const hasTax = val !== "N/A";
            return computeItem({
                ...it,
                taxCalculation: val,
                taxGroup: hasTax ? it.taxGroup : "",
                taxGroupId: hasTax ? it.taxGroupId : "",
                taxRate: hasTax ? it.taxRate : 0,
            });
        });
        onChange(updated);
    };

    const handleAddRow = () => {
        onChange([...items, newEmptyItem()]);
    };

    const handleRemoveRow = (idx) => {
        if (items.length <= 1) return;
        onChange(items.filter((_, i) => i !== idx));
    };

    const handleDiscountSave = (idx, discounts) => {
        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            return computeItem({ ...it, discounts });
        });
        onChange(updated);
    };

    const handleExtraChargeSave = (idx, extraCharges) => {
        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            return computeItem({ ...it, extraCharges });
        });
        onChange(updated);
    };

    const fmtNum = (n) => {
        const val = Number(n ?? 0);
        return (isNaN(val) ? 0 : val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };

    return (
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 mb-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-blue-500 font-bold">#</span> Line Items <span className="text-red-500">*</span>
                </h3>
                <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                >
                    <Plus className="h-3.5 w-3.5" /> Add Row
                </button>
            </div>

            <div className="max-h-[480px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-3 py-3 w-10 text-center">#</th>
                            <th className="px-3 py-3">Description</th>
                            <th className="px-3 py-3 w-36">Item GL</th>
                            <th className="px-3 py-3 w-28 text-right">Qty</th>
                            <th className="px-3 py-3 w-32 text-right">Unit Price</th>
                            <th className="px-3 py-3 w-28 text-right">Amount</th>
                            <th className="px-3 py-3 w-32 text-right">Discount</th>
                            <th className="px-3 py-3 w-32 text-right">Extra Charge</th>
                            <th className="px-3 py-3 w-28 text-right">Total</th>
                            <th className="px-3 py-3 w-32">Tax Calc</th>
                            <th className="px-3 py-3 w-36">Tax Group</th>
                            <th className="px-3 py-3 w-28 text-right">Tax Amt</th>
                            <th className="px-3 py-3 w-28 text-right">Taxable Amt</th>

                            <th className="px-3 py-3 w-32 text-right font-bold text-gray-700">Final Amt</th>
                            <th className="px-3 py-3 w-10 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm">
                        {items.map((item, idx) => {
                            const selectedTaxGroup = taxGroups.find(
                                (t) =>
                                    String(t.taxId ?? t.taxGroupId) === String(item.taxGroupId) ||
                                    t.taxCode === item.taxGroup
                            );
                            const selectedTaxValue = selectedTaxGroup
                                ? (selectedTaxGroup.taxId ?? selectedTaxGroup.taxGroupId ?? selectedTaxGroup.taxCode)
                                : "";
                            return (
                                <tr key={item._id} className="hover:bg-gray-50/50 transition">
                                    <td className="px-3 py-4 text-gray-500 font-medium text-center">{idx + 1}</td>
                                    <td className="px-3 py-4 min-w-[240px]">
                                        <AsyncSelect
                                            instanceId={`item-select-row-${idx}`}
                                            cacheOptions
                                            // defaultOptions
                                            loadOptions={loadItemOptions}
                                            value={
                                                item.itemId
                                                    ? {
                                                        value: String(item.itemId),
                                                        label: item.itemLabel || getItemLabel(item) || `Item #${item.itemId}`,
                                                    }
                                                    : null
                                            }
                                            onChange={(selected) => handleItemSelect(idx, selected)}
                                            placeholder="Search item..."
                                            isClearable
                                            classNamePrefix="react-select"
                                            styles={{
                                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                control: (base) => ({
                                                    ...base,
                                                    minWidth: "220px",
                                                    borderRadius: "0.5rem",
                                                    borderColor: "#d1d5db",
                                                    fontSize: "0.875rem",
                                                    boxShadow: "none",
                                                    "&:hover": { borderColor: "#3b82f6" },
                                                }),
                                            }}
                                            menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                        />
                                    </td>
                                    <td className="px-3 py-4 min-w-[150px]">
                                        <select
                                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 cursor-pointer"
                                            value={item.itemGL || ""}
                                            onChange={(e) => handleFieldChange(idx, "itemGL", e.target.value)}
                                        >
                                            <option value="">-- Select GL --</option>
                                            <option value="SALES_REVENUE">Sales Revenue</option>
                                            <option value="COGS">Cost of Goods Sold</option>
                                            <option value="INVENTORY">Inventory</option>
                                            <option value="SERVICE_REVENUE">Service Revenue</option>
                                            <option value="FREIGHT">Freight & Logistics</option>
                                            <option value="DISCOUNTS">Discounts Given</option>
                                            <option value="TAX_PAYABLE">Tax Payable</option>
                                            <option value="OTHER_INCOME">Other Income</option>
                                        </select>
                                    </td>
                                    <td className="px-3 py-4 min-w-[110px]">
                                        <input
                                            type="number"
                                            min="0"
                                            step={item.isDecimalAllowed ? "0.0001" : "1"}
                                            value={item.quantity}
                                            onChange={(e) => handleFieldChange(idx, "quantity", e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                        />
                                    </td>

                                    <td className="px-3 py-4 min-w-[130px]">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.0001"
                                            value={item.unitPrice}
                                            onChange={(e) => handleFieldChange(idx, "unitPrice", e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                        />
                                    </td>

                                    <td className="px-3 py-4 text-right font-medium text-gray-700 whitespace-nowrap min-w-[110px]">
                                        {fmtNum(item.amount)}
                                    </td>

                                    <td className="px-3 py-4 text-right min-w-[130px]">
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="font-medium">{fmtNum(item.discountTotal)}</span>
                                            <button
                                                type="button"
                                                onClick={() => setDiscountPanel({ open: true, idx })}
                                                className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition cursor-pointer text-xs font-bold"
                                                title="Manage Item Discounts"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </td>

                                    <td className="px-3 py-4 text-right min-w-[130px]">
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="font-medium">{fmtNum(item.extraChargeTotal)}</span>
                                            <button
                                                type="button"
                                                onClick={() => setExtraChargePanel({ open: true, idx })}
                                                className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition cursor-pointer text-xs font-bold"
                                                title="Manage Extra Charges"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </td>

                                    <td className="px-3 py-4 text-right font-semibold text-gray-800 whitespace-nowrap min-w-[120px]">
                                        {fmtNum(item.totalAmount)}
                                    </td>

                                    <td className="px-3 py-4 min-w-[130px]">
                                        <select
                                            value={item.taxCalculation}
                                            onChange={(e) => handleTaxCalcChange(idx, e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 cursor-pointer"
                                        >
                                            {TAX_CALC_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="px-3 py-4 min-w-[150px]">
                                        <select
                                            value={selectedTaxValue}
                                            disabled={item.taxCalculation === "N/A"}
                                            onChange={(e) => handleTaxGroupSelect(idx, e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                        >
                                            <option value="">-- Tax Group --</option>
                                            {taxGroups.map((tg, tgIdx) => {
                                                const val = tg.taxId ?? tg.taxGroupId ?? tg.taxCode;
                                                return (
                                                    <option key={val ?? `tg-${tgIdx}`} value={val}>
                                                        {tg.taxCode} ({tg.taxValue}%)
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </td>

                                    <td className="px-3 py-4 text-right text-gray-700 whitespace-nowrap min-w-[110px]">
                                        {fmtNum(item.taxAmount)}
                                    </td>

                                    <td className="px-3 py-4 text-right text-gray-700 whitespace-nowrap min-w-[120px]">
                                        {fmtNum(item.taxableAmount)}
                                    </td>

                                    <td className="px-3 py-4 text-right font-bold text-gray-900 whitespace-nowrap min-w-[130px]">
                                        {fmtNum(item.finalAmount)}
                                    </td>

                                    <td className="px-3 py-4 text-center whitespace-nowrap">
                                        <button
                                            type="button"
                                            disabled={items.length <= 1}
                                            onClick={() => handleRemoveRow(idx)}
                                            title={items.length <= 1 ? "At least 1 item required" : "Remove item"}
                                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Discount Side Panel */}
            {discountPanel.open && (
                <OrderDiscountSidePanel
                    isOpen={discountPanel.open}
                    onClose={() => setDiscountPanel({ open: false, idx: -1 })}
                    itemGrossAmount={items[discountPanel.idx]?.amount ?? 0}
                    discounts={items[discountPanel.idx]?.discounts ?? []}
                    onSave={(discounts) => handleDiscountSave(discountPanel.idx, discounts)}
                />
            )}

            {/* Extra Charge Side Panel */}
            {extraChargePanel.open && (
                <OrderExtraChargeSidePanel
                    isOpen={extraChargePanel.open}
                    onClose={() => setExtraChargePanel({ open: false, idx: -1 })}
                    extraCharges={items[extraChargePanel.idx]?.extraCharges ?? []}
                    onSave={(extraCharges) => handleExtraChargeSave(extraChargePanel.idx, extraCharges)}
                />
            )}
        </div>
    );
}
