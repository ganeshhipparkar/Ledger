"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { limitDecimals } from "@/lib/utils";
import { toast } from "sonner";

/**
 * OrderLevelAdjSidePanel
 * Manages quotation-level discount OR extra-charge lines (orderId set, orderItemId null).
 * No cap validation at quotation level.
 *
 * Props:
 *   isOpen    boolean
 *   onClose   () => void
 *   type      'discount' | 'extra-charge'
 *   lines     { id?, description, amount }[]
 *   onSave    (lines) => void
 */
export default function OrderLevelAdjSidePanel({
    isOpen,
    onClose,
    type = "discount",
    lines: initialLines = [],
    maxAmount = 0,
    onSave,
}) {
    const [lines, setLines] = useState([]);

    const isDiscount = type === "discount";
    const title = isDiscount ? "Order Discounts" : "Order Extra Charges";
    const addLabel = isDiscount ? "Add Discount" : "Add Charge";
    const totalLabel = isDiscount ? "Total Discount" : "Total Extra Charges";
    const totalColor = isDiscount ? "text-red-700" : "text-green-700";
    const totalBg = isDiscount ? "bg-red-50" : "bg-green-50";

    useEffect(() => {
        if (isOpen) {
            setLines(
                initialLines.length > 0
                    ? initialLines.map((l) => ({
                        description: l.description ?? l.discountDescription ?? l.extraChargesDescription ?? l.extraChargeDescription ?? "",
                        amount: l.amount ?? l.discountPrice ?? l.extraChargesPrice ?? l.extraChargePrice ?? "",
                    }))
                    : [{ description: "", amount: "" }]
            );
        }
    }, [isOpen]);

    const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

    const handleChange = (idx, field, value) => {
        let val = value;
        if (field === "amount") {
            val = limitDecimals(value);
        }
        setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
    };

    const handleAdd = () => {
        setLines([...lines, { description: "", amount: "" }]);
    };

    const handleRemove = (idx) => {
        if (lines.length === 1) return;
        setLines(lines.filter((_, i) => i !== idx));
    };

    const handleSave = () => {
        if (isDiscount && total > maxAmount) {
            toast.error(`Total discount (${Number(total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}) cannot exceed the order total amount (${Number(maxAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}).`);
            return;
        }

        const filtered = lines.filter((l) => l.description || l.amount);
        const mapped = filtered.map((l) => ({
            description: l.description,
            amount: parseFloat(l.amount) || 0,
            discountDescription: l.description,
            discountPrice: parseFloat(l.amount) || 0,
            extraChargesDescription: l.description,
            extraChargesPrice: parseFloat(l.amount) || 0,
            extraChargeDescription: l.description,
            extraChargePrice: parseFloat(l.amount) || 0,
        }));
        onSave?.(mapped);
        onClose?.();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    {lines.map((line, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Entry #{idx + 1}
                                </span>
                                {lines.length > 1 && (
                                    <button type="button" onClick={() => handleRemove(idx)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <input
                                type="text"
                                placeholder="Description"
                                value={line.description}
                                onChange={(e) => handleChange(idx, "description", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                            />
                            <input
                                type="number"
                                placeholder="Amount"
                                min="0"
                                step="0.0001"
                                value={line.amount}
                                onChange={(e) => handleChange(idx, "amount", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                            />
                        </div>
                    ))}

                    <button type="button" onClick={handleAdd} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition cursor-pointer">
                        <Plus className="h-4 w-4" /> {addLabel}
                    </button>

                    <div className={`rounded-lg ${totalBg} px-4 py-2 text-sm flex justify-between mt-4`}>
                        <span className="text-gray-600">{totalLabel}</span>
                        <span className={`font-semibold ${isDiscount && total > maxAmount ? "text-red-700 font-bold" : totalColor}`}>
                            {Number(total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                    </div>
                    {isDiscount && (
                        <div className={`text-right text-xs mt-1 ${total > maxAmount ? "text-red-600 font-bold" : "text-gray-500"}`}>
                            Max allowed: {Number(maxAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t px-6 py-4 flex gap-3 bg-white">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer">
                        Save
                    </button>
                </div>
            </div>
        </>
    );
}
