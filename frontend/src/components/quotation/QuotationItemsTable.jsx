"use client";
import Select, { components } from "react-select";

const CustomOption = (props) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <components.Option
            {...props}
            isHovered={isHovered}
            innerProps={{
                ...props.innerProps,
                onMouseEnter: (e) => {
                    setIsHovered(true);
                    if (props.innerProps.onMouseEnter) props.innerProps.onMouseEnter(e);
                },
                onMouseLeave: (e) => {
                    setIsHovered(false);
                    if (props.innerProps.onMouseLeave) props.innerProps.onMouseLeave(e);
                }
            }}
        />
    );
};

import { useEffect, useState, useRef } from "react";
import { Trash2, Plus } from "lucide-react";
import AsyncSelect from "react-select/async";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { limitDecimals } from "@/lib/utils";
import { TAX_CALC_OPTIONS, getItemLabel, computeItem } from "@/lib/itemTaxCalc";
import QuotationDiscountSidePanel from "./QuotationDiscountSidePanel";
import QuotationExtraChargeSidePanel from "./QuotationExtraChargeSidePanel";

let rowIdCounter = 0;
export function generateRowId() {
    rowIdCounter += 1;
    return `row-${rowIdCounter}`;
}

export function newEmptyItem() {
    return {
        _id: generateRowId(),
        itemId: "",
        description: "",
        itemLabel: "",
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

export default function QuotationItemsTable({
    items,
    onChange,
    companyId,
    currencyConversionRate = 1,
    currencySymbol = "",
    submitAttempted = false,
    itemErrors = {},
}) {
    const [taxGroups, setTaxGroups] = useState([]);
    const [discountPanel, setDiscountPanel] = useState({ open: false, idx: -1 });
    const [extraChargePanel, setExtraChargePanel] = useState({ open: false, idx: -1 });
    const [typedText, setTypedText] = useState({});
    const [arrowUsed, setArrowUsed] = useState({});

    const handleServiceText = (idx, text) => {
        if (!text) return;
        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            if (it.itemId && it.itemLabel === text) return it;
            return computeItem({
                ...it,
                itemId: "",
                description: text,
                itemLabel: text,
                isDecimalAllowed: true,
            });
        });
        onChange(updated);
        setTypedText((prev) => ({ ...prev, [idx]: "" }));
    };

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
        setTypedText((prev) => ({ ...prev, [idx]: "" }));
        setArrowUsed((prev) => ({ ...prev, [idx]: false }));
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
                                                    : item.description
                                                        ? { value: "service", label: item.description }
                                                        : null
                                            }
                                            onChange={(selected) => handleItemSelect(idx, selected)}
                                            onInputChange={(val, { action }) => {
                                                if (action === "input-change") {
                                                    setTypedText((prev) => ({ ...prev, [idx]: val }));
                                                    setArrowUsed((prev) => ({ ...prev, [idx]: false }));
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                                    setArrowUsed((prev) => ({ ...prev, [idx]: true }));
                                                    return;
                                                }
                                                if (e.key === "Enter") {
                                                    if (arrowUsed[idx]) return;
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    e.target.blur();
                                                    const typed = typedText[idx]?.trim();
                                                    const currentLabel = (item.itemLabel || item.description || "").trim();
                                                    if (typed && typed !== currentLabel) handleServiceText(idx, typed);
                                                }
                                            }}
                                            onBlur={() => {
                                                const typed = typedText[idx]?.trim();
                                                const currentLabel = (item.itemLabel || item.description || "").trim();
                                                if (typed && typed !== currentLabel) handleServiceText(idx, typed);
                                            }}
                                            placeholder="Search item..."
                                            noOptionsMessage={() => null}
                                            isClearable
                                            isSearchable={!item.itemId && !item.description}
                                            classNamePrefix="react-select"
                                            components={{ Option: CustomOption }}
                                            arrowUsed={arrowUsed[idx]}
                                            styles={{
                                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                option: (base, state) => ({
                                                    ...base,
                                                    backgroundColor: state.isSelected
                                                        ? base.backgroundColor
                                                        : (state.isHovered || (state.isFocused && state.selectProps.arrowUsed))
                                                            ? "#eff6ff"
                                                            : "white",
                                                    color: state.isSelected ? base.color : "#111827",
                                                }),
                                                control: (base) => ({
                                                    ...base,
                                                    minWidth: "220px",
                                                    borderRadius: "0.5rem",
                                                    borderColor: (submitAttempted && !item.itemId && !item.description) ? "#ef4444" : "#d1d5db",
                                                    fontSize: "0.875rem",
                                                    boxShadow: "none",
                                                    "&:hover": { borderColor: (submitAttempted && !item.itemId && !item.description) ? "#ef4444" : "#3b82f6" },
                                                }),
                                            }}
                                            menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                        />
                                    </td>

                                    <td className="px-3 py-4 min-w-[110px]">
                                        <input
                                            type="number"
                                            min="0"
                                            step={item.isDecimalAllowed ? "0.0001" : "1"}
                                            value={item.quantity}
                                            onChange={(e) => handleFieldChange(idx, "quantity", e.target.value)}
                                            className={`no-spinner w-full rounded-lg border px-2 py-1.5 text-sm text-right outline-none focus:ring-1 ${(submitAttempted && (item.itemId || item.description) && (String(item.quantity).trim() === "" || itemErrors?.[idx]?.quantity))
                                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                                                }`}
                                        />
                                    </td>

                                    <td className="px-3 py-4 min-w-[130px]">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.0001"
                                            value={item.unitPrice}
                                            onChange={(e) => handleFieldChange(idx, "unitPrice", e.target.value)}
                                            className={`no-spinner w-full rounded-lg border px-2 py-1.5 text-sm text-right outline-none focus:ring-1 ${(submitAttempted && (item.itemId || item.description) && (String(item.unitPrice).trim() === "" || itemErrors?.[idx]?.unitPrice))
                                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                                                }`}
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

                                    <td className="px-3 py-4 min-w-[150px]">
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

                                    <td className="px-3 py-4 min-w-[190px]">
                                        <Select
                                            instanceId={`item-tax-group-select-${idx}`}
                                            value={selectedTaxValue ? {
                                                value: selectedTaxValue, label: (() => {
                                                    const tg = taxGroups.find(t => String(t.taxId ?? t.taxGroupId ?? t.taxCode) === String(selectedTaxValue));
                                                    return tg ? `${tg.taxCode} (${tg.taxValue}%)` : selectedTaxValue;
                                                })()
                                            } : null}
                                            onChange={(selected) => handleTaxGroupSelect(idx, selected ? selected.value : "")}
                                            options={taxGroups.map(tg => ({
                                                value: String(tg.taxId ?? tg.taxGroupId ?? tg.taxCode),
                                                label: `${tg.taxCode} (${tg.taxValue}%)`
                                            }))}
                                            isDisabled={item.taxCalculation === "N/A"}
                                            isClearable
                                            placeholder="-- Tax Group --"
                                            classNamePrefix="react-select"
                                            styles={{
                                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                control: (base, state) => ({
                                                    ...base,
                                                    borderRadius: "0.5rem",
                                                    borderColor: "#d1d5db",
                                                    minHeight: "34px",
                                                    fontSize: "0.875rem",
                                                    boxShadow: "none",
                                                    "&:hover": { borderColor: "#3b82f6" },
                                                }),
                                            }}
                                            menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                        />
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

            {discountPanel.open && (
                <QuotationDiscountSidePanel
                    isOpen={discountPanel.open}
                    onClose={() => setDiscountPanel({ open: false, idx: -1 })}
                    itemGrossAmount={items[discountPanel.idx]?.amount ?? 0}
                    discounts={items[discountPanel.idx]?.discounts ?? []}
                    onSave={(discounts) => handleDiscountSave(discountPanel.idx, discounts)}
                />
            )}

            {extraChargePanel.open && (
                <QuotationExtraChargeSidePanel
                    isOpen={extraChargePanel.open}
                    onClose={() => setExtraChargePanel({ open: false, idx: -1 })}
                    extraCharges={items[extraChargePanel.idx]?.extraCharges ?? []}
                    onSave={(extraCharges) => handleExtraChargeSave(extraChargePanel.idx, extraCharges)}
                />
            )}
        </div>
    );
}
