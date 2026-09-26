"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "react-toastify";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDisplayDate, downloadFile } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "./InvoiceList";

export function InvoiceStatusBadge({ status }) {
    const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
    const label = STATUS_LABELS[status] ?? status ?? "—";
    return (
        <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold ${cls}`}>
            {label}
        </span>
    );
}

export function getInvoiceTableColumns({ can, onSubmit, onMarkPaid, onDelete, onRegeneratePdf, onUpdateDueDate, onCustomerClick, onAddedByClick, onInvoiceClick, onAddCreditNote, paymentMode }) {
    const router = useRouter?.();

    return [
        {
            id: "invoiceCode",
            header: "Invoice Code",
            cell: ({ row }) => {
                const q = row.original;
                return (
                    <button
                        type="button"
                        onClick={() => onInvoiceClick?.(q.invoiceId)}
                        className="font-semibold text-blue-600 hover:underline text-sm whitespace-nowrap"
                    >
                        {q.invoiceCode}
                    </button>
                );
            },
        },
        {
            id: "customerName",
            header: "Customer",
            cell: ({ row }) => {
                const q = row.original;
                return (
                    <span
                        className={`text-sm ${q.customerId ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-600"}`}
                        onClick={() => q.customerId && onCustomerClick?.(q.customerId)}
                    >
                        {q.customerName || "—"}
                    </span>
                );
            },
        },
        {
            id: "invoiceDate",
            header: "Invoice Date",
            cell: ({ row }) => <span className="text-sm text-gray-600 whitespace-nowrap">{formatDisplayDate(row.original.invoiceDate) || "—"}</span>,
        },
        {
            id: "deliveryDate",
            header: "Exchange Date",
            cell: ({ row }) => <span className="text-sm text-gray-600 whitespace-nowrap">{formatDisplayDate(row.original.deliveryDate) || "—"}</span>,
        },
        {
            id: "currencyCode",
            header: "Currency",
            cell: ({ row }) => <span className="text-sm text-gray-600">{row.original.currencyCode || "—"}</span>,
        },
        {
            id: "finalAmount",
            header: "Final Amount",
            cell: ({ row }) => (
                <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
                    {Number(row.original.finalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            id: "status",
            header: "Status",
            cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
        },
        {
            id: "addedByName",
            header: "Added By",
            cell: ({ row }) => {
                const q = row.original;
                return (
                    <span
                        className={`text-sm ${q.addedBy ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-600"}`}
                        onClick={() => q.addedBy && onAddedByClick?.(q.addedBy)}
                    >
                        {q.addedByName || "—"}
                    </span>
                );
            },
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const q = row.original;

                const primaryAction = [
                    { show: q.status === "DRAFT" && can?.("invoiceUpdate"), label: "Edit" },
                    { show: q.status === "DRAFT" && can?.("invoiceUpdate"), label: "Submit" },
                    { show: paymentMode === "MANUAL" && (q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate"), label: "Mark as Paid" },
                    { show: (q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate"), label: "Update Due Date" },
                    { show: can?.("invoiceView"), label: "View" },
                ].find((a) => a.show) ?? { label: "View" };

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm cursor-pointer">
                                {primaryAction.label}
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border border-gray-100 p-1">
                            {q.status === "DRAFT" && can?.("invoiceUpdate") && (
                                <>
                                    <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); router?.push(`/invoice/${q.invoiceId}?edit=true`); }}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onSubmit?.(q.invoiceId); }}>Submit</DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete?.(q.invoiceId); }}>Delete</DropdownMenuItem>
                                </>
                            )}
                            {(q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate") && (
                                <>
                                    {paymentMode === "MANUAL" && (
                                        <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onMarkPaid?.(q.invoiceId); }}>Mark as Paid</DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onUpdateDueDate?.(q); }}>Update Due Date</DropdownMenuItem>
                                </>
                            )}
                            {/* {(q.status === "UNPAID" || q.status === "PAID" || q.status === "PARTIALLY_PAID") && can?.("creditNoteAdd") && (
                                <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onAddCreditNote?.(q); }}>Add Credit Note</DropdownMenuItem>
                            )} */}
                            {/* {q.invoicePdfPath && (
                                <>
                                    <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={(e) => { e.stopPropagation(); window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}${q.invoicePdfPath}`, "_blank"); }}>
                                        <span className="w-full h-full px-4 py-2">View PDF</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={async (e) => { e.stopPropagation(); try { await downloadFile(q.invoicePdfPath, `Invoice_${q.invoiceCode}.pdf`); } catch { toast.error("Failed to download PDF", { position: "top-right" }); } }}>
                                        <span className="w-full h-full px-4 py-2">Download PDF</span>
                                    </DropdownMenuItem>
                                </>
                            )}
                            {can?.("invoiceUpdate") && q.status !== "DRAFT" && (
                                <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={(e) => { e.stopPropagation(); onRegeneratePdf?.(q.invoiceId); }}>
                                    <span className="w-full h-full px-4 py-2">Regenerate PDF</span>
                                </DropdownMenuItem>
                            )} */}
                            <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); router?.push(`/invoice/${q.invoiceId}`); }}>View Details</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
}
