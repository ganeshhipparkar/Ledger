"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, EllipsisVertical, LayoutList } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials, formatDisplayDate } from "@/lib/utils";

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

function fmtDate(d) {
    if (!d) return "—";
    return formatDisplayDate(d);
}

function fmtAmount(n, symbol) {
    if (n == null) return "—";
    return `${symbol ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

export default function InvoiceCard({
    invoice: q,
    can,
    onSubmit,
    onMarkPaid,
    onDelete,
    onRegeneratePdf,
    onUpdateDueDate,
    onAddCreditNote,
    onCustomerClick,
    onAddedByClick,
    onInvoiceClick,
    paymentMode,
}) {
    const router = useRouter();

    const initials = getInitials(q.invoiceCode || "-");





    return (
        <div className="relative bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
            <div className="absolute top-4 right-4 z-10">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <span
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                            title="Navigation"
                        >
                            <EllipsisVertical className="h-5 w-5" />
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
                                <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={(e) => { e.stopPropagation(); window.open(`${API_BASE}${q.invoicePdfPath}`, "_blank"); }}>
                                    <span className="w-full h-full px-4 py-2">View PDF</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={async (e) => { e.stopPropagation(); try { await downloadFile(q.invoicePdfPath, `Invoice_${q.invoiceCode}.pdf`); } catch { toast.error("Failed to download PDF", { position: "top-right" }); } }}>
                                    <span className="w-full h-full px-4 py-2">Download PDF</span>
                                </DropdownMenuItem>
                            </>
                        )} */}
                        {/* {can?.("invoiceUpdate") && q.status !== "DRAFT" && (
                            <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={(e) => { e.stopPropagation(); onRegeneratePdf?.(q.invoiceId); }}>
                                <span className="w-full h-full px-4 py-2">Regenerate PDF</span>
                            </DropdownMenuItem>
                        )} */}
                        <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); router.push(`/invoice/${q.invoiceId}`); }}>View Details</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex items-start gap-4 mb-4">
                <div className="flex h-20 w-20 min-w-[80px] items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold uppercase text-blue-600 shadow-md">
                    <span className="text-blue-600">{initials}</span>
                </div>
                <div className="flex-1 min-w-0 pr-6">
                    <div
                        className={`font-semibold text-lg truncate ${can?.("invoiceView") !== false ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                        onClick={() => onInvoiceClick?.(q.invoiceId)}
                    >
                        {q.invoiceCode || "-"}
                    </div>
                    <div className="text-sm text-gray-600 break-all mt-1">
                        {q.customerName || "—"}
                    </div>

                    <InvoiceStatusBadge status={q.status} />
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
                    {(
                        <div className="mt-1 pt-3 ">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div
                                        type="button"
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center justify-between gap-1.5 w-34 rounded-sm border border-gray-300 bg-white justify-center py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs"
                                    >
                                        {(() => {
                                            const primaryAction = [
                                                { show: q.status === "DRAFT" && can?.("invoiceUpdate"), label: "Edit" },
                                                { show: q.status === "DRAFT" && can?.("invoiceUpdate"), label: "Submit" },
                                                { show: paymentMode === "MANUAL" && (q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate"), label: "Mark as Paid" },
                                                { show: (q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate"), label: "Update Due Date" },
                                                { show: can?.("invoiceView"), label: "View" },
                                            ].find((a) => a.show) ?? { label: "View" };
                                            const primaryLabel = primaryAction.label;
                                            return <span className="truncate whitespace-nowrap overflow-hidden">{primaryLabel}</span>;
                                        })()}
                                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                                    </div>
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
                                    {/* {q.invoicePdfPath && (
                                        <>
                                            <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={(e) => { e.stopPropagation(); window.open(`${API_BASE}${q.invoicePdfPath}`, "_blank"); }}>
                                                <span className="w-full h-full px-4 py-2">View PDF</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={async (e) => { e.stopPropagation(); try { await downloadFile(q.invoicePdfPath, `Invoice_${q.invoiceCode}.pdf`); } catch { toast.error("Failed to download PDF", { position: "top-right" }); } }}>
                                                <span className="w-full h-full px-4 py-2">Download PDF</span>
                                            </DropdownMenuItem>
                                        </>
                                    )} */}
                                    {/* {can?.("invoiceUpdate") && q.status !== "DRAFT" && (
                                        <DropdownMenuItem className="cursor-pointer text-sm text-gray-700 hover:bg-gray-100 p-0" onClick={(e) => { e.stopPropagation(); onRegeneratePdf?.(q.invoiceId); }}>
                                            <span className="w-full h-full px-4 py-2">Regenerate PDF</span>
                                        </DropdownMenuItem>
                                    )} */}
                                    <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); router.push(`/invoice/${q.invoiceId}`); }}>View Details</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2 mt-4">
                <div className="text-sm text-gray-600 break-all">
                    <span className="font-medium">Issue Date:</span>{" "}
                    {fmtDate(q.invoiceDate)}
                </div>
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Expiry Date:</span>{" "}
                    {fmtDate(q.deliveryDate)}
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
