"use client";

import Link from "next/link";
import { getInitials } from "@/lib/utils";
import { DebitNoteStatusBadge } from "./DebitNoteList";

function fmtAmount(n, symbol) {
    if (n == null) return "—";
    return `${symbol ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

export default function DebitNoteCard({ debitNote: cn, onCustomerClick }) {
    const initials = getInitials(cn.debitNoteCode || "-");
    const sym = cn.currencyCode;

    return (
        <div className="relative bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
            <div className="flex items-start gap-4 mb-4">
                <div className="flex h-20 w-20 min-w-[80px] items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold uppercase text-blue-600 shadow-md">
                    <span className="text-blue-600">{initials}</span>
                </div>
                <div className="flex-1 min-w-0 pr-2">
                    <Link
                        href={`/debit-note/${cn.id}`}
                        className="font-semibold text-lg truncate cursor-pointer hover:underline text-[#3563e9] block"
                    >
                        {cn.debitNoteCode || "-"}
                    </Link>
                    <div className="text-sm text-gray-600 break-all mt-1">
                        <span
                            className="text-blue-600 hover:underline cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); cn.customerId && onCustomerClick?.(cn.customerId); }}
                        >
                            {cn.customerName || "—"}
                        </span>
                    </div>
                    <div className="mt-1">
                        <DebitNoteStatusBadge status={cn.status} />
                    </div>
                </div>
            </div>

            <div className="text-sm text-gray-600 pt-3 pb-3 py-1 flex flex-row">
                <div className="flex-1 pr-2">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                        Invoice Code
                    </span>
                    <span className="font-semibold break-words">
                        {cn.invoiceCode || "—"}
                    </span>
                </div>
                <div className="flex-1 pl-2 border-l border-gray-200">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                        Currency
                    </span>
                    <span className="font-semibold break-words">
                        {cn.currencyCode || "—"}
                    </span>
                </div>
            </div>

            <div className="text-sm text-gray-600 py-1 flex flex-row">
                <div className="flex-1 pr-2">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                        Customer Charges
                    </span>
                    <span className="font-semibold break-words">
                        {cn.customerCharges || "—"}
                    </span>
                </div>
                <div className="flex-1 pl-2 border-l border-gray-200">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                        Added By
                    </span>
                    <span className="font-semibold break-words">
                        {cn.addedByName || "—"}
                    </span>
                </div>
            </div>

            <div className="text-sm text-gray-600 pt-3 pb-3 border-b border-gray-200 py-1">
                <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                    Narration
                </span>
                <span className="font-semibold break-words truncate block" title={cn.narration || ""}>
                    {cn.narration || "—"}
                </span>
            </div>

            <div className="space-y-2 mt-4 flex-1">
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Total Amount:</span>{" "}
                    {fmtAmount(cn.totalAmount, sym)}
                </div>

                <div className="text-sm text-gray-600">
                    <span className="font-medium">Final Amount:</span>{" "}
                    <span className="font-semibold text-gray-800">{fmtAmount(cn.finalAmount, sym)}</span>
                </div>
            </div>

        </div>
    );
}
