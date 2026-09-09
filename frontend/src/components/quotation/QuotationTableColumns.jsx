"use client";

import { MoreVertical, Copy, RefreshCw, ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const STATUS_COLORS = {
    DRAFT: "bg-amber-100 text-amber-700",
    SUBMITTED: "bg-blue-100 text-blue-700",
    CONFIRMED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-100 text-gray-600",
    CANCELLED: "bg-red-100 text-red-600",
    EXPIRED: "bg-orange-100 text-orange-600",
};

const STATUS_LABELS = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    CONFIRMED: "Confirmed",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
};

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmount(n, symbol) {
    if (n == null) return "—";
    return `${symbol ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

export function getQuotationTableColumns({ can, onStatusUpdate }) {
    const router = () => (typeof window !== "undefined" ? window._nextRouter : null);

    return [
        {
            id: "quotationNumber",
            header: "Quotation No.",
            accessorKey: "quotationNumber",
            cell: ({ row }) => (
                <span
                    className="font-semibold text-blue-600 cursor-pointer hover:underline"
                    onClick={() => window.location.href = `/quotation/${row.original.quotationId}`}
                >
                    {row.original.quotationNumber ?? `QN-${row.original.quotationId}`}
                </span>
            ),
        },
        {
            id: "customerName",
            header: "Customer",
            accessorKey: "customerName",
            cell: ({ row }) => <span className="text-gray-800">{row.original.customerName ?? "—"}</span>,
        },
        {
            id: "issueDate",
            header: "Issue Date",
            accessorKey: "issueDate",
            cell: ({ row }) => fmtDate(row.original.issueDate),
        },
        {
            id: "expiryDate",
            header: "Expiry Date",
            accessorKey: "expiryDate",
            cell: ({ row }) => fmtDate(row.original.expiryDate),
        },
        {
            id: "currencyCode",
            header: "Currency",
            accessorKey: "currencyCode",
            cell: ({ row }) => (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    {row.original.currencyCode ?? "—"}
                </span>
            ),
        },
        {
            id: "finalAmount",
            header: "Final Amount",
            accessorKey: "finalAmount",
            cell: ({ row }) => (
                <span className="font-semibold text-gray-800">
                    {fmtAmount(row.original.finalAmount, row.original.currencySymbol ?? row.original.currencyCode)}
                </span>
            ),
        },
        {
            id: "status",
            header: "Status",
            accessorKey: "status",
            cell: ({ row }) => {
                const s = row.original.status;
                const cls = STATUS_COLORS[s] ?? "bg-gray-100 text-gray-500";
                const label = STATUS_LABELS[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—");
                return (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
                        {label}
                    </span>
                );
            },
        },
        {
            id: "addedByName",
            header: "Added By",
            accessorKey: "addedByName",
            cell: ({ row }) => <span className="text-gray-600">{row.original.addedByName ?? "—"}</span>,
        },
        {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => {
                const q = row.original;
                const isLatestVersion = q.parentQuotationId == null;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer">
                                <MoreVertical className="h-4 w-4" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                            <DropdownMenuItem onClick={() => window.location.href = `/quotation/${q.quotationId}`} className="cursor-pointer text-sm py-2">
                                View Details
                            </DropdownMenuItem>
                            {isLatestVersion && q.status === "DRAFT" && can?.("quotationUpdate") && (
                                <>
                                    <DropdownMenuItem onClick={() => window.location.href = `/quotation/${q.quotationId}?edit=true`} className="cursor-pointer text-sm py-2">
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onStatusUpdate?.(q.quotationId, "SUBMITTED")} className="cursor-pointer text-sm py-2">
                                        Submit
                                    </DropdownMenuItem>
                                </>
                            )}
                            {isLatestVersion && q.status === "SUBMITTED" && can?.("quotationUpdate") && (
                                <>
                                    <DropdownMenuItem onClick={() => window.location.href = `/add-quotation?changeFrom=${q.quotationId}`} className="cursor-pointer text-sm py-2">
                                        Change Quotation
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onStatusUpdate?.(q.quotationId, "CONFIRMED")} className="cursor-pointer text-sm py-2">
                                        Confirm
                                    </DropdownMenuItem>
                                </>
                            )}
                            {isLatestVersion && q.status === "CONFIRMED" && can?.("orderAdd") && (
                                <DropdownMenuItem onClick={() => window.location.href = `/add-order?quotationId=${q.quotationId}`} className="cursor-pointer text-sm py-2">
                                    Convert to Order
                                </DropdownMenuItem>
                            )}
                            {isLatestVersion && can?.("quotationAdd") && (
                                <DropdownMenuItem onClick={() => window.location.href = `/add-quotation?cloneFrom=${q.quotationId}`} className="cursor-pointer text-sm py-2">
                                    Clone Quotation
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
}
