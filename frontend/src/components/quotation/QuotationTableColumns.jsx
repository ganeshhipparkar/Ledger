"use client";
import { toast } from "react-toastify";


import { ChevronDown, Copy, RefreshCw, ClipboardList, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDisplayDate, downloadFile } from "@/lib/utils";

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
    return formatDisplayDate(d);
}

function fmtAmount(n, symbol) {
    if (n == null) return "—";
    return `${symbol ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

export function getQuotationTableColumns({ can, onStatusUpdate, onRegeneratePdf, onCustomerClick, onAddedByClick, onQuotationClick }) {
    const router = () => (typeof window !== "undefined" ? window._nextRouter : null);

    return [
        {
            id: "quotationCode",
            header: "Quotation Code",
            accessorKey: "quotationCode",
            cell: ({ row }) => (
                <span
                    className="font-semibold text-blue-600 cursor-pointer hover:underline"
                    onClick={() => onQuotationClick?.(`${row.original.quotationId}`)}                 >
                    {row.original.quotationCode || "-"}
                </span>
            ),
        },
        {
            id: "customerName",
            header: "Customer",
            accessorKey: "customerName",
            cell: ({ row }) => (
                <span
                    className={row.original.customerId ? "text-blue-600 hover:underline cursor-pointer" : "text-gray-800"}
                    onClick={() => row.original.customerId && onCustomerClick?.(row.original.customerId)}
                >
                    {row.original.customerName ?? "—"}
                </span>
            ),
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
        // {
        //     id: "currencyCode",
        //     header: "Currency",
        //     accessorKey: "currencyCode",
        //     cell: ({ row }) => (
        //         <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
        //             {row.original.currencyCode ?? "—"}
        //         </span>
        //     ),
        // },
        {
            id: "finalAmount",
            header: "Final Amount",
            accessorKey: "finalAmount",
            cell: ({ row }) => (
                <span className="font-semibold text-gray-700">
                    {fmtAmount(row.original.finalAmount, row.original.currency?.symbol ?? row.original.currencyCode)}
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
            cell: ({ row }) => (
                <span
                    className={row.original.addedBy ? "text-blue-600 hover:underline cursor-pointer" : "text-gray-600"}
                    onClick={() => row.original.addedBy && onAddedByClick?.(row.original.addedBy)}
                >
                    {row.original.addedByName ?? "—"}
                </span>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            enableSorting: false,
            cell: ({ row }) => {
                const q = row.original;
                const isLatestVersion = q.parentQuotationId == null;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs ml-auto w-fit"
                            >
                                Actions
                                <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                            {/* <DropdownMenuItem onClick={() => window.location.href = `/quotation/${q.quotationId}`} className="cursor-pointer text-sm py-2">
                                View Details
                            </DropdownMenuItem> */}
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
                            {isLatestVersion && q.status === "CONFIRMED" && (
                                <>
                                    {q.invoicePdfPath && (
                                        <>
                                            <DropdownMenuItem onClick={() => window.open(`http://localhost:4000${q.invoicePdfPath}`, "_blank")} className="cursor-pointer text-sm p-0">
                                                <span className="w-full h-full py-2 px-4" title="View PDF">View Pdf</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    await downloadFile(q.invoicePdfPath, `Invoice_${q.quotationCode ?? q.quotationId}.pdf`);
                                                } catch (err) {
                                                    toast.error("Failed to download invoice", { position: "top-right" });
                                                }
                                            }} className="cursor-pointer text-sm p-0">
                                                <span className="w-full h-full py-2 px-4" title="Download PDF">Download Pdf</span>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    {can?.("quotationUpdate") && (
                                        <DropdownMenuItem onClick={() => onRegeneratePdf?.(q.quotationId)} className="cursor-pointer text-sm p-0">
                                            <span className="w-full h-full py-2 px-4" title="Regenerate PDF">Regenerate PDF</span>
                                        </DropdownMenuItem>
                                    )}
                                </>
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
