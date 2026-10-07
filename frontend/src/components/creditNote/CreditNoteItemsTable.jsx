"use client";
import FormattedNumberInput from "../ui/FormattedNumberInput";
import Select, { components } from "react-select";
import { useEffect, useState, useRef } from "react";
import { Trash2, Plus } from "lucide-react";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { limitDecimals, limitPriceDecimals } from "@/lib/utils";
import { TAX_CALC_OPTIONS, getItemLabel, computeItem, formatTaxCalcLabel } from "@/lib/itemTaxCalc";

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

export function generateRowId() {
    return `row-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
}

export function newEmptyCreditNoteItem() {
    return {
        _id: generateRowId(),
        itemId: "",
        invoiceItemId: null,
        lineType: "",
        description: "",
        itemLabel: "",
        isDecimalAllowed: true,
        baseCurrencyPrice: 0,
        quantity: "",
        unitPrice: "",
        amount: 0,
        totalAmount: 0,
        taxCalculation: "NA",
        taxGroupId: "",
        taxGroup: "",
        taxGroupLabel: "",
        taxRate: 0,
        taxAmount: 0,
        taxableAmount: 0,
        finalAmount: 0,
        discounts: [],
        extraCharges: [],
        itemName: "",
    };
}

export function validateCreditNoteItems(items) {
    const itemErrors = {};
    const validItems = [];

    items.forEach((it) => {
        const isBlank = !it.itemId && !it.invoiceItemId && (!it.description || !it.description.trim()) && (!it.quantity || parseFloat(it.quantity) === 0);
        if (isBlank && items.length > 1) return;

        let hasErr = false;

        if (it.itemId && !it.invoiceItemId) {
            itemErrors[it._id] = { ...itemErrors[it._id], invalidSource: true };
            hasErr = true;
        }

        if (!it.invoiceItemId && (!it.description || !it.description.trim())) {
            itemErrors[it._id] = { ...itemErrors[it._id], description: true };
            hasErr = true;
        }
        
        const qty = parseFloat(it.quantity);
        if (isNaN(qty) || qty <= 0) {
            itemErrors[it._id] = { ...itemErrors[it._id], quantity: true };
            hasErr = true;
        }

        if (it.lineType === "INVOICE_ITEM" || it.invoiceItemId) {
            if (it.maxQuantity !== undefined && qty > it.maxQuantity) {
                itemErrors[it._id] = { ...itemErrors[it._id], quantityExceeds: true };
                hasErr = true;
            }
        }
        const unitPrice = parseFloat(it.unitPrice);
        if (isNaN(unitPrice) || unitPrice < 0) {
            itemErrors[it._id] = { ...itemErrors[it._id], unitPrice: true };
            hasErr = true;
        }
        if (it.taxCalculation && it.taxCalculation !== "NA" && !it.taxGroupId) {
            itemErrors[it._id] = { ...itemErrors[it._id], taxGroup: true };
            hasErr = true;
        }

        if (!hasErr) {
            validItems.push({
                ...it,
                lineType: it.lineType || (it.invoiceItemId ? "INVOICE_ITEM" : "SERVICE"),
            });
        }
    });

    const usedInvoiceItemIds = new Set();
    validItems.forEach(it => {
        if (it.lineType === "INVOICE_ITEM" && it.invoiceItemId) {
            if (usedInvoiceItemIds.has(it.invoiceItemId)) {
                itemErrors[it._id] = { ...itemErrors[it._id], duplicate: true };
            }
            usedInvoiceItemIds.add(it.invoiceItemId);
        }
    });

    return { itemErrors, validItems: Object.keys(itemErrors).length === 0 ? validItems : [] };
}

export function toCreditNotePayloadItems(validItems) {
    return validItems.map(it => {
        return {
            lineType: it.lineType,
            invoiceItemId: it.invoiceItemId || null,
            description: it.description,
            quantity: String(it.quantity),
            unitPrice: String(it.unitPrice),
            taxCalculation: it.taxCalculation,
            taxGroupId: it.taxGroupId || null,
        };
    });
}

export default function CreditNoteItemsTable({
    companyId,
    items,
    onChange,
    invoiceItems = [],
    currencySymbol = "",
    submitAttempted = false,
    itemErrors = {},
}) {
    const [taxGroups, setTaxGroups] = useState([]);
    const [typedText, setTypedText] = useState({});
    const [arrowUsed, setArrowUsed] = useState({});

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
                    body: JSON.stringify({
                        page: 1, limit: 200,
                        filters: [{ key: "companyId", value: String(companyId), operator: "eq" }]
                    }),
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
    }, [invoiceItems]);

    const handleServiceText = (idx, text) => {
        if (!text) return;
        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            if ((it.itemId || it.invoiceItemId) && it.itemLabel === text) return it;
            return computeItem({
                ...it,
                itemId: "",
                invoiceItemId: null,
                lineType: "SERVICE",
                description: text,
                itemLabel: text,
                isDecimalAllowed: true,
                discounts: [],
                extraCharges: [],
            });
        });
        onChange(updated);
        setTypedText((prev) => ({ ...prev, [idx]: "" }));
    };

    const handleItemSelect = (idx, selectedItem) => {
        setTypedText((prev) => ({ ...prev, [idx]: "" }));
        setArrowUsed((prev) => ({ ...prev, [idx]: false }));
        if (!selectedItem) {
            const updated = items.map((it, i) => (i === idx ? newEmptyCreditNoteItem() : it));
            onChange(updated);
            return;
        }

        const usedInvoiceItemIds = items.map(it => it.invoiceItemId).filter(Boolean);
        const raw = invoiceItems
            .filter(it => String(it.itemId || it.description || it.invoiceItemId) === String(selectedItem.value) && it.remainingQuantity > 0 && !usedInvoiceItemIds.includes(it.invoiceItemId))
            .sort((a, b) => a.lineNo - b.lineNo)[0];

        if (!raw) return;

        const updated = items.map((it, i) =>
            i === idx
                ? computeItem({
                    ...it,
                    invoiceItemId: raw.invoiceItemId,
                    lineType: "INVOICE_ITEM",
                    itemId: String(raw.itemId || ""),
                    itemName: raw.itemName,
                    itemLabel: raw.itemName,
                    description: raw.description || "",
                    itemGL: raw.itemGL || "",
                    isDecimalAllowed: raw.isDecimalAllowed ?? true,
                    baseCurrencyPrice: parseFloat(raw.unitPrice) || 0,
                    quantity: raw.remainingQuantity,
                    maxQuantity: raw.remainingQuantity,
                    unitPrice: parseFloat(raw.unitPrice) || 0,
                    taxCalculation: "NA",
                    taxGroupId: "",
                    taxGroup: "",
                    taxGroupLabel: "",
                    taxRate: 0,
                    discounts: [],
                    extraCharges: [],
                })
                : it
        );
        onChange(updated);
    };

    const handleFieldChange = (idx, field, value) => {
        const updated = items.map((it, i) => {
            if (i !== idx) return it;
            let val = value;
            if (field === "quantity" && !it.isDecimalAllowed) {
                val = String(parseInt(value, 10) || "");
            } else if (field === "quantity") {
                val = limitDecimals(value);
            } else if (field === "unitPrice") {
                val = limitPriceDecimals(value);
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
            const hasTax = val !== "NA";
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
        onChange([...items, newEmptyCreditNoteItem()]);
    };

    const handleRemoveRow = (idx) => {
        if (items.length <= 1) return;
        onChange(items.filter((_, i) => i !== idx));
    };

    const fmtNum = (n) => {
        const val = Number(n ?? 0);
        return (isNaN(val) ? 0 : val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };

    const usedInvoiceItemIds = items.map(it => it.invoiceItemId).filter(Boolean);
    const availableInvoiceItems = invoiceItems.filter(it => it.remainingQuantity > 0 && !usedInvoiceItemIds.includes(it.invoiceItemId));
    const invoiceLineOptions = [];
    const seenItemIds = new Set();
    availableInvoiceItems.sort((a, b) => a.lineNo - b.lineNo).forEach(it => {
        const idKey = String(it.itemId || it.description || it.invoiceItemId);
        if (!seenItemIds.has(idKey)) {
            seenItemIds.add(idKey);
            invoiceLineOptions.push({
                value: idKey,
                label: it.itemName || it.description || it.itemLabel,
            });
        }
    });

    return (
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 mb-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <span className="text-blue-500 font-bold">#</span> Line Items <span className="text-red-500">*</span>
                </h3>
                <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-sm transition cursor-pointer"
                >
                    <Plus className="h-3.5 w-3.5" /> Add Row
                </button>
            </div>

            <div className="max-h-[480px] overflow-y-auto overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-1 py-3 w-10 text-center">#</th>
                            <th className="px-1 py-3">Description</th>
                            <th className="px-1 py-3 w-32 text-right">Qty</th>
                            <th className="px-1 py-3 w-40 text-right">Unit Price ({currencySymbol})</th>
                            <th className="px-1 py-3 w-32 text-right">Amount ({currencySymbol})</th>
                            <th className="px-1 py-3 w-40">Tax Calc</th>
                            <th className="px-1 py-3 w-48">Tax Group</th>
                            <th className="px-1 py-3 w-32 text-right">Tax Amt ({currencySymbol})</th>
                            <th className="px-1 py-3 w-40 text-right">Taxable Amt ({currencySymbol})</th>
                            <th className="px-1 py-3 w-40 text-right font-bold text-gray-700">Final Amt ({currencySymbol})</th>
                            <th className="px-3 py-3 w-12 text-center">Action</th>
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
                            const errs = itemErrors[idx] || {};
                            const hasErr = Object.keys(errs).length > 0;
                            
                            const filteredOptions = invoiceLineOptions;

                            return (
                                <tr key={item._id} className="hover:bg-gray-50/50 transition">
                                    <td className="px-3 py-4 text-gray-500 font-medium text-center">{idx + 1}</td>
                                    <td className="px-3 py-4 min-w-[350px]">
                                        <Select
                                            instanceId={`item-select-row-${idx}`}
                                            options={filteredOptions}
                                            value={
                                                item.invoiceItemId
                                                    ? {
                                                        value: item.invoiceItemId,
                                                        label: item.itemName || item.itemLabel || item.description,
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
                                                const currentLabel = (item.itemName || item.description || "").trim();
                                                if (typed && typed !== currentLabel) handleServiceText(idx, typed);
                                            }}
                                            placeholder="Search item..."
                                            noOptionsMessage={() => null}
                                            isClearable
                                            isSearchable={!item.invoiceItemId && !item.description}
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
                                                    borderColor: (submitAttempted && (errs.itemId || errs.description)) ? "#ef4444" : "#d1d5db",
                                                    fontSize: "0.875rem",
                                                    boxShadow: "none",
                                                    "&:hover": { borderColor: (submitAttempted && (errs.itemId || errs.description)) ? "#ef4444" : "#3b82f6" },
                                                }),
                                            }}
                                            menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                        />
                                        {submitAttempted && errs.itemId && errs.itemId.includes("already selected") && (
                                            <p className="text-[10px] text-red-600 mt-1 leading-tight px-1">{errs.itemId}</p>
                                        )}
                                        {submitAttempted && errs.description && (
                                            <p className="text-[10px] text-red-600 mt-1 leading-tight px-1">{errs.description}</p>
                                        )}
                                    </td>

                                    <td className="px-3 py-4 min-w-[160px]">
                                        <FormattedNumberInput
                                            min="0"
                                            step={item.isDecimalAllowed ? "0.01" : "1"}
                                            value={item.quantity}
                                            onChange={(e) => handleFieldChange(idx, "quantity", e.target.value)}
                                            className={`no-spinner w-full rounded-lg border px-2 py-1.5 text-sm text-right outline-none focus:ring-1 ${submitAttempted && errs.quantity
                                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                                                }`}
                                        />
                                        {submitAttempted && errs.quantity && errs.quantity.includes("exceed") && (
                                            <p className="text-[10px] text-red-600 text-right mt-1 leading-tight px-1">{errs.quantity}</p>
                                        )}
                                    </td>

                                    <td className="px-3 py-4 min-w-[180px]">
                                        <FormattedNumberInput
                                            min="0"
                                            step="0.0001"
                                            value={item.unitPrice}
                                            onChange={(e) => handleFieldChange(idx, "unitPrice", e.target.value)}
                                            className={`no-spinner w-full rounded-lg border px-2 py-1.5 text-sm text-right outline-none focus:ring-1 ${submitAttempted && errs.unitPrice
                                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                                                }`}
                                        />
                                    </td>

                                    <td className="px-3 py-4 text-right font-medium text-gray-700 whitespace-nowrap min-w-[110px]">
                                        {fmtNum(item.amount)}
                                    </td>

                                    <td className="px-3 py-4 min-w-[200px]">
                                        <select
                                            value={item.taxCalculation}
                                            onChange={(e) => handleTaxCalcChange(idx, e.target.value)}
                                            className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none cursor-pointer disabled:bg-gray-50 ${submitAttempted && errs.taxCalculation
                                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                                                }`}
                                        >
                                            {TAX_CALC_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>{formatTaxCalcLabel(opt)}</option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="px-3 py-4 min-w-[240px]">
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
                                            isDisabled={item.taxCalculation === "NA"}
                                            isClearable
                                            placeholder="-- Tax Group --"
                                            classNamePrefix="react-select"
                                            styles={{
                                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                control: (base, state) => ({
                                                    ...base,
                                                    borderRadius: "0.5rem",
                                                    borderColor: (submitAttempted && errs.taxGroupId) ? "#ef4444" : "#d1d5db",
                                                    minHeight: "34px",
                                                    fontSize: "0.875rem",
                                                    boxShadow: "none",
                                                    "&:hover": { borderColor: (submitAttempted && errs.taxGroupId) ? "#ef4444" : "#3b82f6" },
                                                }),
                                            }}
                                            menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                        />
                                        {submitAttempted && errs.taxGroupId && (
                                            <p className="text-[10px] text-red-600 mt-1 leading-tight px-1">{errs.taxGroupId}</p>
                                        )}
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
        </div>
    );
}
