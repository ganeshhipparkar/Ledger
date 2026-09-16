"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials, formatDisplayDate } from "@/lib/utils";

export const QUOTATION_STATUS_COLORS = {
    DRAFT: "mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700 font-medium",
    SUBMITTED: "mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 font-medium",
    CONFIRMED: "mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 font-medium",
    CLOSED: "mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 font-medium",
    CANCELLED: "mt-2 inline-block rounded-full bg-red-100 px-3 py-1 text-sm text-red-700 font-medium",
    EXPIRED: "mt-2 inline-block rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700 font-medium",
};

export const QUOTATION_STATUS_LABELS = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    CONFIRMED: "Confirmed",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
};

export function QuotationStatusBadge({ status }) {
    const cls = QUOTATION_STATUS_COLORS[status] ?? "mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 font-medium";
    const label = QUOTATION_STATUS_LABELS[status] ?? status;
    return (
        <span className={cls}>
            {label}
        </span>
    );
}

function fmtDate(d) {
    if (!d) return "—";
    return formatDisplayDate(d);
}

function fmtAmount(n, symbol) {
    if (n == null) return "—";
    return `${symbol ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

export default function QuotationCard({ quotation: q, onStatusUpdate, can, onCustomerClick, onAddedByClick }) {
    const router = useRouter();

    const handleView = () => router.push(`/quotation/${q.quotationId}`);
    const handleEdit = () => router.push(`/quotation/${q.quotationId}?edit=true`);
    const handleClone = () => router.push(`/add-quotation?cloneFrom=${q.quotationId}`);
    const handleChange = () => router.push(`/add-quotation?changeFrom=${q.quotationId}`);
    const handleConfirm = () => onStatusUpdate?.(q.quotationId, "CONFIRMED");
    const handleSubmit = () => onStatusUpdate?.(q.quotationId, "SUBMITTED");

    const initials = getInitials(q.quotationCode || "-");

    const isLatestVersion = q.parentQuotationId == null;



    return (
        <div className="relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">


            <div className="flex items-start gap-4 mb-4">
                <div className="flex h-20 w-20 min-w-[80px] items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold uppercase text-blue-600 shadow-md">
                    <span className="text-blue-600">{initials}</span>
                </div>
                <div className="flex-1 min-w-0 pr-6">
                    <div
                        className={`font-semibold text-lg truncate ${can?.("quotationView") !== false ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                        onClick={handleView}
                    >
                        {q.quotationCode || "-"}
                    </div>
                    <div className="text-sm text-gray-600 break-all mt-1">
                        {q.customerName || "—"}
                    </div>

                    <QuotationStatusBadge status={q.status} />
                </div>
            </div>

            <div className="text-sm text-gray-600 pt-3 pb-3 border-y border-gray-200 py-1 flex flex-row">
                <div>
                    <span className="text-[#71717b] text-xs uppercase tracking-wide">
                        Customer
                    </span>
                    <p
                        className={`font-semibold mt-1 break-words ${q.customerId ? "cursor-pointer text-blue-600 hover:underline" : ""}`}
                        onClick={() => q.customerId && onCustomerClick?.(q.customerId)}
                    >
                        {q.customerName || "—"}
                    </p>
                </div>
                <div className="ml-auto">
                    {isLatestVersion && (
                        <div className="mt-4 pt-3 ">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div
                                        type="button"
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center justify-center gap-1.5 w-full rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs"
                                    >
                                        Actions
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg rounded-xl">
                                    {q.status === "DRAFT" && can?.("quotationUpdate") && (
                                        <>
                                            <DropdownMenuItem
                                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit();
                                                }}
                                            >
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSubmit();
                                                }}
                                            >
                                                Submit
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    {q.status === "SUBMITTED" && can?.("quotationUpdate") && (
                                        <DropdownMenuItem
                                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleChange();
                                            }}
                                        >
                                            Change Quotation
                                        </DropdownMenuItem>
                                    )}
                                    {can?.("quotationAdd") && (
                                        <DropdownMenuItem
                                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleClone();
                                            }}
                                        >
                                            Clone Quotation
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2 mt-4">
                <div className="text-sm text-gray-600 break-all">
                    <span className="font-medium">Issue Date:</span>{" "}
                    {fmtDate(q.issueDate)}
                </div>
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Expiry Date:</span>{" "}
                    {fmtDate(q.expiryDate)}
                </div>
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Added By:</span>{" "}
                    <span
                        className={q.addedBy ? "cursor-pointer text-blue-600 hover:underline" : ""}
                        onClick={() => q.addedBy && onAddedByClick?.(q.addedBy)}
                    >
                        {q.addedByName || "—"}
                    </span>
                </div>
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Final Amount:</span>{" "}
                    <span className="font-semibold text-gray-800">{fmtAmount(q.finalAmount, q.currency?.symbol ?? q.currencyCode)}</span>
                </div>
            </div>

        </div>
    );
}
