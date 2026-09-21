"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, MoreVertical } from "lucide-react";
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

export default function InvoiceCard({
    invoice: q,
    can,
    onSubmit,
    onMarkPaid,
    onDelete,
    onRegeneratePdf,
    onUpdateDueDate,
    onCustomerClick,
    onAddedByClick,
    onInvoiceClick,
    isExpanded,
    onToggle,
}) {
    const router = useRouter();
    const fmtDate = (d) => formatDisplayDate(d) || "—";
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    const primaryAction = [
        { show: q.status === "DRAFT" && can?.("invoiceUpdate"), label: "Edit" },
        { show: q.status === "DRAFT" && can?.("invoiceUpdate"), label: "Submit" },
        { show: (q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate"), label: "Mark as Paid" },
        { show: (q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate"), label: "Update Due Date" },
        { show: can?.("invoiceView"), label: "View" },
    ].find((a) => a.show) ?? { label: "View" };

    return (
        <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col gap-3">
            {/* Top actions */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <span className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm cursor-pointer transition-all">
                            {primaryAction.label}
                            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                        </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border border-gray-100 p-1">
                        {q.status === "DRAFT" && can?.("invoiceUpdate") && (
                            <>
                                <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); router.push(`/invoice/${q.invoiceId}?edit=true`); }}>Edit</DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onSubmit?.(q.invoiceId); }}>Submit</DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete?.(q.invoiceId); }}>Delete</DropdownMenuItem>
                            </>
                        )}
                        {(q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate") && (
                            <>
                                <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onMarkPaid?.(q.invoiceId); }}>Mark as Paid</DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onUpdateDueDate?.(q); }}>Update Due Date</DropdownMenuItem>
                            </>
                        )}
                        {q.invoicePdfPath && (
                            <>
                                <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={(e) => { e.stopPropagation(); window.open(`${API_BASE}${q.invoicePdfPath}`, "_blank"); }}>
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
                        )}
                        <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); router.push(`/invoice/${q.invoiceId}`); }}>View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Invoice code (clickable → side panel) */}
            <div className="pr-28">
                <button
                    type="button"
                    onClick={() => onInvoiceClick?.(q.invoiceId)}
                    className="font-bold text-blue-600 hover:underline text-base leading-tight text-left"
                >
                    {q.invoiceCode}
                </button>
                <InvoiceStatusBadge status={q.status} />
            </div>

            {/* Customer */}
            <div
                className={`text-sm font-medium ${q.customerId ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-700"}`}
                onClick={() => q.customerId && onCustomerClick?.(q.customerId)}
            >
                {q.customerName || "—"}
            </div>

            {/* Amounts */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{q.currencyCode}</span>
                <span className="font-semibold text-gray-900">
                    {Number(q.finalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>

            {/* Dates */}
            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Invoice: {fmtDate(q.invoiceDate)}</span>
                <span>Exchange: {fmtDate(q.deliveryDate)}</span>
            </div>

            {/* Expand toggle */}
            <button
                onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                className="flex items-center justify-center gap-1 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1 cursor-pointer"
            >
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                {isExpanded ? "Less" : "More"}
            </button>

            {isExpanded && (
                <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <div className="text-gray-500 text-xs mb-0.5">Tax Amount</div>
                        <div className="text-gray-800 font-medium">{Number(q.taxAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs mb-0.5">Added By</div>
                        <div
                            className={`font-medium ${q.addedBy ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-800"}`}
                            onClick={() => q.addedBy && onAddedByClick?.(q.addedBy)}
                        >
                            {q.addedByName || "—"}
                        </div>
                    </div>
                    {q.bankBookName && (
                        <div className="col-span-2">
                            <div className="text-gray-500 text-xs mb-0.5">Bank Book</div>
                            <div className="text-gray-800">{q.bankBookName}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
