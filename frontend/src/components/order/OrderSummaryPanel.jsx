"use client";

import { useState, useEffect } from "react";
import { Plus, Paperclip } from "lucide-react";
import OrderLevelAdjSidePanel from "./OrderLevelAdjSidePanel";
import MultiFilePicker from "../common/MultiFilePicker";

export default function OrderSummaryPanel({
    items = [],
    orderDiscounts = [],
    orderExtraCharges = [],
    vatWithheld = "NO",
    currencyCode = "",
    currencySymbol = "",
    onDiscountsChange,
    onExtraChargesChange,
    selectedFiles = [],
    onFilesChange,
    existingAttachments = [],
    onDeleteExisting,
    readOnly = false,
    staticTotals = null,
    onTotalsChange,
}) {
    const [discountPanelOpen, setDiscountPanelOpen] = useState(false);
    const [extraChargePanelOpen, setExtraChargePanelOpen] = useState(false);

    const grossAmount = items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
    const taxableAmount = items.reduce((s, it) => s + (parseFloat(it.taxableAmount) || 0), 0);
    const taxAmount = items.reduce((s, it) => s + (parseFloat(it.taxAmount) || 0), 0);
    const oDiscount = orderDiscounts.reduce((s, d) => s + (parseFloat(d.amount ?? d.discountPrice) || 0), 0);
    const oExtraCharge = orderExtraCharges.reduce((s, ec) => s + (parseFloat(ec.amount ?? ec.extraChargesPrice) || 0), 0);
    const itemsFinalTotal = items.reduce((s, it) => s + (parseFloat(it.finalAmount) || 0), 0);
    const netAmount = itemsFinalTotal + oExtraCharge - oDiscount;
    const vatWithheldAmount = vatWithheld === "YES" ? taxAmount : 0;
    const finalAmount = netAmount - vatWithheldAmount;

    const totals = staticTotals ?? {
        grossAmount,
        taxableAmount,
        taxAmount,
        nonTaxableAmount: grossAmount - taxableAmount,
        oDiscount,
        oExtraCharge,
        netAmount,
        vatWithheldAmount,
        finalAmount,
    };

    useEffect(() => {
        if (onTotalsChange && !staticTotals) {
            onTotalsChange(totals);
        }
    }, [grossAmount, taxableAmount, taxAmount, oDiscount, oExtraCharge, netAmount, vatWithheldAmount, finalAmount]);

    const fmt = (n) =>
        `${currencySymbol} ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`.trim();

    const Row = ({ label, value, bold = false, bordered = false, action }) => (
        <div className={`flex items-center justify-between py-1.5 ${bordered ? "border-t border-gray-200 mt-1 pt-2" : ""}`}>
            <span className={`text-sm ${bold ? "font-semibold text-gray-800" : "text-gray-500"} flex items-center gap-1`}>
                {label}
                {action && !readOnly && (
                    <button
                        type="button"
                        onClick={action}
                        className="ml-1 h-5 w-5 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition cursor-pointer"
                        title="Manage"
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                )}
            </span>
            <span className={`text-sm font-medium text-right ${bold ? "text-gray-900 font-bold text-base" : "text-gray-700"}`}>
                {value}
            </span>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <Paperclip className="h-4 w-4 text-gray-500" />
                    <h3 className="text-base font-semibold text-gray-800">Summary</h3>
                </div>

                <Row label="Gross Amount" value={fmt(totals.grossAmount ?? grossAmount)} />
                <div className="flex justify-between text-xs text-gray-400 py-1 px-0">
                    <span>Details</span>
                    <span>{currencyCode}{currencySymbol ? ` (${currencySymbol})` : ""}</span>
                </div>
                <Row label="Non Taxable Amount" value={fmt(totals.nonTaxableAmount ?? (grossAmount - taxableAmount))} />
                <Row label="Taxable Amount" value={fmt(totals.taxableAmount ?? taxableAmount)} />
                <Row label="Tax Amount" value={fmt(totals.taxAmount ?? taxAmount)} />
                <Row
                    label="Add / Extra Charge"
                    value={fmt(totals.oExtraCharge ?? oExtraCharge)}
                    action={() => setExtraChargePanelOpen(true)}
                />
                <Row
                    label="Less / Discount"
                    value={`− ${fmt(totals.oDiscount ?? oDiscount)}`}
                    action={() => setDiscountPanelOpen(true)}
                />

                <Row label="Net Amount" value={fmt(totals.netAmount ?? netAmount)} bold bordered />

                {vatWithheld === "YES" && (
                    <Row label="VAT Withhold Amount" value={`− ${fmt(totals.vatWithheldAmount ?? vatWithheldAmount)}`} />
                )}

                <Row label="Final Amount" value={fmt(totals.finalAmount ?? finalAmount)} />

                <div className="mt-3 pt-3 border-t-2 border-gray-800 flex items-center justify-between">
                    <span className="text-base font-bold text-gray-900">Receivable</span>
                    <span className="text-base font-bold text-gray-900">{fmt(totals.finalAmount ?? finalAmount)}</span>
                </div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                <MultiFilePicker
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                    selectedFiles={selectedFiles}
                    onFilesChange={onFilesChange}
                    existingAttachments={existingAttachments}
                    onDeleteExisting={onDeleteExisting}
                    label="Attachments"
                    readOnly={readOnly}
                />
            </div>

            <OrderLevelAdjSidePanel
                isOpen={discountPanelOpen}
                onClose={() => setDiscountPanelOpen(false)}
                type="discount"
                lines={orderDiscounts}
                maxAmount={grossAmount + taxAmount + oExtraCharge}
                onSave={onDiscountsChange}
            />

            <OrderLevelAdjSidePanel
                isOpen={extraChargePanelOpen}
                onClose={() => setExtraChargePanelOpen(false)}
                type="extra-charge"
                lines={orderExtraCharges}
                onSave={onExtraChargesChange}
            />
        </div>
    );
}
