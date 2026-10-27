"use client";

import Select from "react-select";
import { Trash2, Plus } from "lucide-react";

let rowCounter = 0;
export function generateRowId() {
    rowCounter += 1;
    return `dn-row-${rowCounter}`;
}

export function newEmptyDeliveryNoteItem(id) {
    return {
        _id: id || generateRowId(),
        orderItemId: "",
        itemId: null,
        itemName: "",
        itemCode: "",
        description: "",
        requestedQuantity: "",
        deliveredQuantity: "",
        pendingQuantity: "",
        deliverQuantity: "",
    };
}

export function validateDeliveryNoteItems(items = []) {
    return { itemErrors: {}, validItems: items, hasErrors: false };
}


const itemSelectStyles = (hasError) => ({
    menuPortal: (base) => ({
        ...base,
        zIndex: 9999,
    }),
    menu: (base) => ({
        ...base,
        minWidth: "420px",
        width: "max-content",
        maxWidth: "600px",
        zIndex: 9999,
    }),
    control: (base) => ({
        ...base,
        minHeight: "38px",
        height: "38px",
        borderRadius: "0.75rem",
        borderColor: hasError ? "#ef4444" : "#d1d5db",
        fontSize: "0.875rem",
        boxShadow: "none",
        "&:hover": {
            borderColor: hasError ? "#ef4444" : "#3b82f6",
        },
    }),
    valueContainer: (base) => ({
        ...base,
        height: "36px",
        padding: "0 8px",
        overflow: "hidden",
        flexWrap: "nowrap",
    }),
    singleValue: (base) => ({
        ...base,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    }),
    input: (base) => ({
        ...base,
        margin: "0px",
        padding: "0px",
    }),
    indicatorsContainer: (base) => ({
        ...base,
        height: "36px",
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
            ? base.backgroundColor
            : state.isFocused
                ? "#eff6ff"
                : "white",
        color: state.isSelected ? base.color : "#111827",
    }),
});

const formatOptionLabel = (opt, { context }) => {
    const fullText = opt.itemName || opt.label || "";
    if (context === "value") {
        return (
            <span
                title={fullText}
                className="font-medium text-gray-900 truncate block whitespace-nowrap overflow-hidden text-ellipsis"
            >
                {fullText}
            </span>
        );
    }
    return (
        <div className="py-1">
            <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-gray-900 text-sm truncate">
                    {fullText}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    Pending: {opt.pendingQuantity}
                </span>
            </div>
            {(opt.itemCode || opt.description) && (
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                    {opt.itemCode && (
                        <span className="font-mono text-gray-400 font-medium">
                            [{opt.itemCode}]
                        </span>
                    )}
                    {opt.description && (
                        <span className="truncate text-gray-500">
                            {opt.description}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default function DeliveryNoteItemsTable({
    items = [],
    onChange,
    deliverableLines = [],
    isOrderSelected = false,
    rowErrors = {},
    tableError = null,
    onClearRowError,
    loadingItems = false,
}) {
    const usedOrderItemIds = new Set(
        items.filter((it) => it.orderItemId).map((it) => String(it.orderItemId))
    );
    const canAddItem = isOrderSelected && !loadingItems && deliverableLines.length > usedOrderItemIds.size;

    const handleAddRow = () => {
        if (!canAddItem) return;
        onChange([...items, newEmptyDeliveryNoteItem()]);
    };

    const handleRemoveRow = (idx) => {
        if (items.length <= 1) {
            onChange([newEmptyDeliveryNoteItem()]);
            return;
        }
        onChange(items.filter((_, i) => i !== idx));
    };

    const handleItemSelect = (idx, selectedOption) => {
        const rowId = items[idx]?._id;
        if (rowId && onClearRowError) {
            onClearRowError(rowId, "orderItemId");
        }

        if (!selectedOption) {
            const next = items.map((it, i) =>
                i === idx ? { ...newEmptyDeliveryNoteItem(it._id) } : it
            );
            onChange(next);
            return;
        }

        const raw = selectedOption.raw;
        if (!raw) return;

        const next = items.map((it, i) => {
            if (i !== idx) return it;
            return {
                ...it,
                orderItemId: raw.orderItemId,
                itemId: raw.itemId,
                itemName: raw.itemName || raw.description || `Item #${raw.orderItemId}`,
                itemCode: raw.itemCode || "",
                description: raw.description || "",
                requestedQuantity: raw.requestedQuantity,
                deliveredQuantity: raw.deliveredQuantity || 0,
                pendingQuantity: raw.pendingQuantity,
                deliverQuantity: String(raw.pendingQuantity),
            };
        });
        onChange(next);
    };

    const handleQuantityChange = (idx, value) => {
        const currentItem = items[idx];
        const rowId = currentItem?._id;
        if (rowId && onClearRowError) {
            onClearRowError(rowId, "deliverQuantity");
        }

        const pending = currentItem?.pendingQuantity;

        if (value === "" || value === undefined || value === null) {
            const next = items.map((it, i) =>
                i === idx ? { ...it, deliverQuantity: "" } : it
            );
            onChange(next);
            return;
        }

        let sanitized = String(value).replace(/[^0-9.]/g, "");

        const parts = sanitized.split(".");
        if (parts.length > 2) {
            return;
        }

        if (parts.length === 2 && parts[1].length > 4) {
            return;
        }

        const num = Number(sanitized);
        const maxPending = Number(pending);
        if (
            !isNaN(num) &&
            pending !== "" &&
            pending !== undefined &&
            pending !== null &&
            !isNaN(maxPending)
        ) {
            if (num > maxPending) {
                return;
            }
        }

        const next = items.map((it, i) =>
            i === idx ? { ...it, deliverQuantity: sanitized } : it
        );
        onChange(next);
    };

    const fmtNum = (n) => {
        if (n === "" || n === undefined || n === null) return "—";
        const val = Number(n);
        return isNaN(val)
            ? "—"
            : val.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 4,
            });
    };

    return (
        <div
            data-error-field="deliveryNoteItems"
            className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 space-y-4"
        >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="space-y-1">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        Item(s) List <span className="text-red-500">*</span>
                    </h3>
                    {tableError && (
                        <p className="text-red-500 text-xs font-medium">
                            {tableError}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleAddRow}
                    disabled={!canAddItem}
                    title={
                        !isOrderSelected
                            ? "Select an order first"
                            : loadingItems
                                ? "Loading items..."
                                : !canAddItem
                                    ? "All deliverable items have been added"
                                    : "Add Item"
                    }
                    className="flex items-center gap-1.5 rounded-sm bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    <Plus className="h-4 w-4" /> Add Item
                </button>
            </div>

            <div className="max-h-[480px] overflow-x-auto overflow-y-auto border border-gray-200 rounded-xl">
                <table className="w-full table-fixed min-w-[830px] text-left text-sm text-gray-700">
                    <colgroup>
                        <col style={{ width: "48px" }} />
                        <col style={{ width: "29%", minWidth: "220px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "140px" }} />
                        <col style={{ width: "64px" }} />
                    </colgroup>
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-600 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="py-3 px-2 w-[48px] text-center font-semibold align-middle">#</th>
                            <th className="py-3 px-3 min-w-[220px] font-semibold align-middle">
                                Description <span className="text-red-500">*</span>
                            </th>
                            <th className="py-3 px-3 w-[120px] text-right font-semibold align-middle">
                                Requested Qty
                            </th>
                            <th className="py-3 px-3 w-[120px] text-right font-semibold align-middle">
                                Delivered Qty
                            </th>
                            <th className="py-3 px-3 w-[120px] text-right font-semibold align-middle">
                                Pending Qty
                            </th>
                            <th className="py-3 px-3 w-[140px] text-right font-semibold align-middle">
                                Deliver Qty <span className="text-red-500">*</span>
                            </th>
                            <th className="py-3 px-2 w-[64px] text-center font-semibold align-middle">
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {items.map((row, idx) => {
                            const rowErrs = rowErrors[row._id] || {};
                            const descErr = rowErrs.orderItemId || rowErrs.description;
                            const qtyErr = rowErrs.deliverQuantity;

                            const usedOtherRowIds = new Set(
                                items
                                    .filter((otherItem, i) => i !== idx && otherItem.orderItemId)
                                    .map((otherItem) => String(otherItem.orderItemId))
                            );

                            const lineOptions = deliverableLines
                                .filter((l) => !usedOtherRowIds.has(String(l.orderItemId)))
                                .map((l) => ({
                                    value: l.orderItemId,
                                    label:
                                        l.itemName ||
                                        l.description ||
                                        `Item #${l.orderItemId}`,
                                    itemName:
                                        l.itemName ||
                                        l.description ||
                                        `Item #${l.orderItemId}`,
                                    itemCode: l.itemCode,
                                    description: l.description,
                                    pendingQuantity: l.pendingQuantity,
                                    raw: l,
                                }));

                            const selectedOpt = row.orderItemId
                                ? lineOptions.find(
                                    (o) => String(o.value) === String(row.orderItemId)
                                ) || {
                                    value: row.orderItemId,
                                    label: row.itemName,
                                    itemName: row.itemName,
                                    itemCode: row.itemCode,
                                    description: row.description,
                                    pendingQuantity: row.pendingQuantity,
                                }
                                : null;

                            return (
                                <tr
                                    key={row._id}
                                    data-row-id={row._id}
                                    suppressHydrationWarning
                                    className="hover:bg-gray-50/50"
                                >
                                    <td className="py-2 px-2 text-center font-mono text-xs text-gray-500 align-middle">
                                        {idx + 1}
                                    </td>
                                    <td
                                        className="py-2 px-3 align-middle"
                                        title={descErr || undefined}
                                    >
                                        <Select
                                            instanceId={`row-item-select-${idx}`}
                                            value={selectedOpt}
                                            onChange={(opt) => handleItemSelect(idx, opt)}
                                            options={lineOptions}
                                            isDisabled={!isOrderSelected || loadingItems}
                                            isLoading={loadingItems}
                                            placeholder={
                                                !isOrderSelected
                                                    ? "Select an order first"
                                                    : loadingItems
                                                        ? "Loading items..."
                                                        : lineOptions.length === 0
                                                            ? "No items remaining"
                                                            : "Select an item..."
                                            }
                                            isClearable
                                            formatOptionLabel={formatOptionLabel}
                                            classNamePrefix="react-select"
                                            styles={itemSelectStyles(Boolean(descErr))}
                                            menuPortalTarget={
                                                typeof document !== "undefined"
                                                    ? document.body
                                                    : null
                                            }
                                        />
                                        {descErr && (
                                            <p className="text-red-500 text-xs mt-1 font-medium">
                                                {descErr}
                                            </p>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-gray-700 align-middle whitespace-nowrap">
                                        {fmtNum(row.requestedQuantity)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-gray-600 align-middle whitespace-nowrap">
                                        {fmtNum(row.deliveredQuantity)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-semibold text-amber-600 align-middle whitespace-nowrap">
                                        {fmtNum(row.pendingQuantity)}
                                    </td>
                                    <td
                                        className="py-2 px-3 align-middle"
                                        title={qtyErr || undefined}
                                    >
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            max={
                                                row.pendingQuantity !== "" &&
                                                    row.pendingQuantity !== undefined &&
                                                    row.pendingQuantity !== null
                                                    ? row.pendingQuantity
                                                    : undefined
                                            }
                                            inputMode="decimal"
                                            disabled={!row.orderItemId}
                                            value={row.deliverQuantity ?? ""}
                                            onKeyDown={(e) => {
                                                if (["e", "E", "+", "-"].includes(e.key)) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onChange={(e) =>
                                                handleQuantityChange(idx, e.target.value)
                                            }
                                            placeholder="0.00"
                                            className={`w-full rounded-xl border px-3 py-1.5 text-sm text-right outline-none transition disabled:bg-gray-50 disabled:text-gray-400 h-[38px] ${qtyErr
                                                ? "border-red-500 focus:border-red-500"
                                                : "border-gray-300 focus:border-blue-500"
                                                }`}
                                        />
                                        {qtyErr && (
                                            <p className="text-red-500 text-xs mt-1 font-medium text-right">
                                                {qtyErr}
                                            </p>
                                        )}
                                    </td>
                                    <td className="py-2 px-2 text-center align-middle">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRow(idx)}
                                            disabled={items.length <= 1}
                                            title={
                                                items.length <= 1
                                                    ? "Cannot remove last row"
                                                    : "Remove Row"
                                            }
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center"
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
