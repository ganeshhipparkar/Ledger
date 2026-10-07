"use client";

import { useEffect } from "react";
import { Paperclip } from "lucide-react";
import MultiFilePicker from "../common/MultiFilePicker";

export default function CreditNoteSummaryPanel({
    items = [],
    vatWithheld = "NO",
    currencyCode = "",
    currencySymbol = "",
    selectedFiles = [],
    onFilesChange,
    onTotalsChange,
}) {
    const priceDecimals = Number.isFinite(parseInt(process.env.NEXT_PUBLIC_PRICE_DECIMAL_ALLOWED, 10))
        ? parseInt(process.env.NEXT_PUBLIC_PRICE_DECIMAL_ALLOWED, 10)
        : 4;

    const grossAmount = items.reduce((s, it) => s + (parseFloat(it.totalAmount) || 0), 0);
    const taxableAmount = items.reduce((s, it) => s + (parseFloat(it.taxableAmount) || 0), 0);
    const taxAmount = items.reduce((s, it) => s + (parseFloat(it.taxAmount) || 0), 0);
    const netAmount = items.reduce((s, it) => s + (parseFloat(it.finalAmount) || 0), 0);
    const vatWithheldAmount = vatWithheld === "YES" ? taxAmount : 0;
    const finalAmount = netAmount - vatWithheldAmount;

    const totals = {
        grossAmount,
        taxableAmount,
        taxAmount,
        nonTaxableAmount: grossAmount - taxableAmount,
        netAmount,
        vatWithheldAmount,
        finalAmount,
    };

    useEffect(() => {
        if (onTotalsChange) {
            onTotalsChange(totals);
        }
    }, [grossAmount, taxableAmount, taxAmount, netAmount, vatWithheldAmount, finalAmount]);

    const fmt = (n) =>
        `${currencySymbol} ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}`.trim();

    const Row = ({ label, value, bold = false, bordered = false }) => (
        <div className={`flex items-center justify-between py-1.5 ${bordered ? "border-t border-gray-200 mt-1 pt-2" : ""}`}>
            <span className={`text-sm ${bold ? "font-semibold text-gray-800" : "text-gray-500"}`}>
                {label}
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
                <div className="flex justify-between text-xs text-gray-400 py-1 px-0 ">
                    <span>{currencyCode}{currencySymbol ? ` (${currencySymbol})` : ""}</span>
                </div>
                <Row label="Gross Amount" value={fmt(grossAmount)} />
                <Row label="Non Taxable Amount" value={fmt(grossAmount - taxableAmount)} />
                <Row label="Taxable Amount" value={fmt(taxableAmount)} />
                <Row label="Tax Amount" value={fmt(taxAmount)} />
                <Row label="Net Amount" value={fmt(netAmount)} bold bordered />

                {vatWithheld === "YES" && (
                    <Row label="VAT Withhold Amount" value={`− ${fmt(vatWithheldAmount)}`} />
                )}

                <Row label="Final Amount" value={fmt(finalAmount)} />
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                <MultiFilePicker
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    selectedFiles={selectedFiles}
                    onFilesChange={onFilesChange}
                    label="Attachments"
                    readOnly={false}
                />
            </div>
        </div>
    );
}
