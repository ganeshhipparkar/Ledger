"use client";

import FormattedNumberInput from "../ui/FormattedNumberInput";
import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { limitDecimals } from "@/lib/utils";


export default function OrderExtraChargeSidePanel({
    isOpen,
    onClose,
    extraCharges = [],
    onSave,
}) {
    const [lines, setLines] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setLines(
                extraCharges.length > 0
                    ? extraCharges.map((ec) => {
                        const desc = ec.extraChargeDescription ?? ec.extraChargesDescription ?? ec.description ?? "";
                        const price = ec.extraChargePrice ?? ec.extraChargesPrice ?? ec.amount ?? "";
                        return {
                            ...ec,
                            extraChargeDescription: desc,
                            extraChargePrice: price,
                            extraChargesDescription: desc,
                            extraChargesPrice: price,
                        };
                    })
                    : [{ extraChargeDescription: "", extraChargePrice: "" }]
            );
        }
    }, [isOpen]);

    const total = lines.reduce((s, l) => s + (parseFloat(l.extraChargePrice || l.extraChargesPrice) || 0), 0);

    const handleChange = (idx, field, value) => {
        let val = value;
        if (field === "extraChargePrice" || field === "extraChargesPrice" || field === "amount") {
            val = limitDecimals(value);
        }
        setLines(lines.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
    };

    const handleAdd = () => {
        setLines([...lines, { extraChargeDescription: "", extraChargePrice: "" }]);
    };

    const handleRemove = (idx) => {
        setLines(lines.filter((_, i) => i !== idx));
    };

    const handleSave = () => {
        const filtered = lines.filter((l) => l.extraChargeDescription || l.extraChargesDescription || l.extraChargePrice || l.extraChargesPrice);
        const mapped = filtered.map((l) => {
            const desc = l.extraChargeDescription || l.extraChargesDescription || l.description || "";
            const price = parseFloat(l.extraChargePrice ?? l.extraChargesPrice ?? l.amount) || 0;
            return {
                ...l,
                extraChargeDescription: desc,
                extraChargePrice: price,
                extraChargesDescription: desc,
                extraChargesPrice: price,
                description: desc,
                amount: price,
            };
        });
        onSave?.(mapped);
        onClose?.();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
                <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-semibold text-gray-800">Extra Charges</h2>
                    <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    {lines.map((line, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Charge #{idx + 1}
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
                                value={line.extraChargeDescription}
                                onChange={(e) => handleChange(idx, "extraChargeDescription", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                            />
                            <FormattedNumberInput
                                placeholder="Amount"
                                min="0"
                                step="0.0001"
                                value={line.extraChargePrice}
                                onChange={(e) => handleChange(idx, "extraChargePrice", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                            />
                        </div>
                    ))}

                    <button type="button" onClick={handleAdd} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition cursor-pointer">
                        <Plus className="h-4 w-4" /> Add Charge
                    </button>

                    <div className="rounded-lg bg-green-50 px-4 py-2 text-sm flex justify-between">
                        <span className="text-gray-600">Total Extra Charges</span>
                        <span className="font-semibold text-green-700">
                            {Number(total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                    </div>
                </div>

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
