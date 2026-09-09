"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { limitDecimals } from "@/lib/utils";

/**
 * QuotationDiscountSidePanel
 * Manages item-level discount lines (quotationItemId set, quotationId null).
 * Enforces: sum of all discount amounts <= itemGrossAmount.
 *
 * Props:
 *   isOpen         boolean
 *   onClose        () => void
 *   discounts      { id?, discountDescription, discountPrice }[]  – existing lines
 *   itemGrossAmount  number   – qty * unitPrice ceiling
 *   onSave         (discounts) => void  – called when panel closes with Save
 */
export default function QuotationDiscountSidePanel({
    isOpen,
    onClose,
    discounts = [],
    itemGrossAmount = 0,
    onSave,
}) {
    const [lines, setLines] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            setLines(
                discounts.length > 0
                    ? discounts.map((d) => ({
                        ...d,
                        discountDescription: d.discountDescription ?? d.description ?? "",
                        discountPrice: d.discountPrice ?? d.amount ?? "",
                    }))
                    : [{ discountDescription: "", discountPrice: "" }]
            );
            setError("");
        }
    }, [isOpen]);

    const total = lines.reduce((s, l) => s + (parseFloat(l.discountPrice) || 0), 0);

    const handleChange = (idx, field, value) => {
        let val = value;
        if (field === "discountPrice") {
            val = limitDecimals(value);
        }
        const updated = lines.map((l, i) => (i === idx ? { ...l, [field]: val } : l));
        setLines(updated);
        setError("");
    };

    const handleAdd = () => {
        setLines([...lines, { discountDescription: "", discountPrice: "" }]);
    };

    const handleRemove = (idx) => {
        setLines(lines.filter((_, i) => i !== idx));
    };

    const fmtNum = (n) => {
        const val = Number(n ?? 0);
        return (isNaN(val) ? 0 : val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };

    const handleSave = () => {
        const sum = lines.reduce((s, l) => s + (parseFloat(l.discountPrice) || 0), 0);
        if (sum > itemGrossAmount) {
            setError(
                `Total discount (${fmtNum(sum)}) cannot exceed item gross amount (${fmtNum(itemGrossAmount)}).`
            );
            return;
        }
        const filtered = lines.filter((l) => l.discountDescription || l.discountPrice);
        const mapped = filtered.map((l) => ({
            ...l,
            discountDescription: l.discountDescription,
            discountPrice: parseFloat(l.discountPrice) || 0,
            description: l.discountDescription,
            amount: parseFloat(l.discountPrice) || 0,
        }));
        onSave?.(mapped);
        onClose?.();
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-semibold text-gray-800">Item Discounts</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    {lines.map((line, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Discount #{idx + 1}
                                </span>
                                {lines.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(idx)}
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <input
                                type="text"
                                placeholder="Description"
                                value={line.discountDescription}
                                onChange={(e) => handleChange(idx, "discountDescription", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                            />
                            <input
                                type="number"
                                placeholder="Amount"
                                min="0"
                                step="0.0001"
                                value={line.discountPrice}
                                onChange={(e) => handleChange(idx, "discountPrice", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                            />
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={handleAdd}
                        className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition cursor-pointer"
                    >
                        <Plus className="h-4 w-4" /> Add Discount
                    </button>

                    {/* Running total */}
                    <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm flex justify-between">
                        <span className="text-gray-600">Total Discount</span>
                        <span className={`font-semibold ${total > itemGrossAmount ? "text-red-600" : "text-blue-700"}`}>
                            {fmtNum(total)}
                        </span>
                    </div>
                    <div className="text-xs text-gray-400">
                        Max allowed: {fmtNum(itemGrossAmount)}
                    </div>

                    {error && (
                        <p className="text-xs text-red-600 font-medium">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t px-6 py-4 flex gap-3 bg-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
                    >
                        Save
                    </button>
                </div>
            </div>
        </>
    );
}
