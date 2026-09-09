"use client";

import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";

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
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmount(n, symbol) {
    if (n == null) return "—";
    return `${symbol ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

export default function QuotationCard({ quotation, onStatusUpdate, can }) {
    const router = useRouter();
    const q = quotation;

    const handleView = () => router.push(`/quotation/${q.quotationId}`);
    const handleEdit = () => router.push(`/quotation/${q.quotationId}?edit=true`);
    const handleClone = () => router.push(`/add-quotation?cloneFrom=${q.quotationId}`);
    const handleChange = () => router.push(`/add-quotation?changeFrom=${q.quotationId}`);
    const handleConfirm = () => onStatusUpdate?.(q.quotationId, "CONFIRMED");
    const handleSubmit = () => onStatusUpdate?.(q.quotationId, "SUBMITTED");

    const initials = getInitials(q.quotationNumber ?? `QN-${q.quotationId}`);

    const isLatestVersion = q.parentQuotationId == null;

    let primaryBtn = null;
    if (isLatestVersion && q.status === "DRAFT") {
        if (can?.("quotationUpdate")) {
            primaryBtn = (
                <button
                    type="button"
                    onClick={handleEdit}
                    className="w-full rounded-full border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                >
                    Edit Quotation
                </button>
            );
        }
    } else if (isLatestVersion && q.status === "SUBMITTED") {
        if (can?.("quotationUpdate")) {
            primaryBtn = (
                <button
                    type="button"
                    onClick={handleConfirm}
                    className="w-full rounded-full border border-green-600 px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 transition cursor-pointer"
                >
                    Confirm Quotation
                </button>
            );
        }
    } else if (isLatestVersion) {
        primaryBtn = (
            <button
                type="button"
                onClick={handleClone}
                className="w-full rounded-full border border-blue-500 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition cursor-pointer"
            >
                Clone Quotation
            </button>
        );
    }

    return (
        <div className="relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
            {/* Actions Menu */}
            <div className="absolute top-4 right-4 z-10">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <span
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                            title="Actions"
                        >
                            <MoreVertical className="h-5 w-5" />
                        </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg rounded-xl">
                        <DropdownMenuItem
                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleView();
                            }}
                        >
                            View Details
                        </DropdownMenuItem>
                        {isLatestVersion && q.status === "DRAFT" && can?.("quotationUpdate") && (
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
                        {isLatestVersion && q.status === "SUBMITTED" && can?.("quotationUpdate") && (
                            <>
                                <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleChange();
                                    }}
                                >
                                    Change Quotation
                                </DropdownMenuItem>
                            </>
                        )}
                        {isLatestVersion && can?.("quotationAdd") && (
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

            {/* Header row: avatar + info */}
            <div className="flex items-start gap-4 mb-4">
                <div className="flex h-20 w-20 min-w-[80px] items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold uppercase text-blue-600 shadow-md">
                    <span className="text-blue-600">{initials}</span>
                </div>
                <div className="flex-1 min-w-0 pr-6">
                    <div
                        className={`font-semibold text-lg truncate ${can?.("quotationView") !== false ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                        onClick={handleView}
                    >
                        {q.quotationNumber ?? `QN-${q.quotationId}`}
                    </div>
                    <div className="text-sm text-gray-600 break-all mt-1">
                        {q.customerName || "—"}
                    </div>

                    <QuotationStatusBadge status={q.status} />
                </div>
            </div>

            {/* Divider section for Customer */}
            <div className="text-sm text-gray-600 pt-3 pb-3 border-y border-gray-200 py-1">
                <span className="text-[#71717b] text-xs uppercase tracking-wide">
                    Customer
                </span>
                <p className="font-semibold mt-1 break-words">
                    {q.customerName || "—"}
                </p>
            </div>

            {/* Detail rows */}
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
                    {q.addedByName || "—"}
                </div>
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Final Amount:</span>{" "}
                    <span className="font-semibold text-gray-800">{fmtAmount(q.finalAmount, q.currencySymbol ?? q.currencyCode)}</span>
                </div>
            </div>

            {/* Bottom action button */}
            {primaryBtn && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    {primaryBtn}
                </div>
            )}
        </div>
    );
}
