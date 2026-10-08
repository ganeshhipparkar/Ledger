"use client";
import Link from "next/link";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Header from "../Header";
import Loader from "../ui/Loader";
import AppPagination from "../ui/AppPagination";
import { DataTable } from "../data-table";
import InvoiceCard, { InvoiceStatusBadge } from "./InvoiceCard";
import { getInvoiceTableColumns } from "./InvoiceTableColumns";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import { ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials, formatDisplayDate, downloadFile } from "@/lib/utils";
import { createPortal } from "react-dom";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import UserSidePanel from "../user/UserSidePanel";
import InvoiceSidePanel from "./InvoiceSidePanel";
import InvoiceDueDatePanel from "./InvoiceDueDatePanel";
import NoteAddPanel from "../notes/NoteAddPanel";
import { handleCreditNoteAddNavigation } from "@/lib/useCreditNoteNavigation";
import { handleDebitNoteAddNavigation } from "@/lib/useDebitNoteNavigation";
import { getCreditNoteMode } from "@/lib/creditNoteMode";

const MySwal = withReactContent(Swal);

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_COLORS = {
    DRAFT: "bg-amber-100 text-amber-700 border-amber-200",
    UNPAID: "bg-blue-100 text-blue-700 border-blue-200",
    PARTIALLY_PAID: "bg-orange-100 text-orange-700 border-orange-200",
    PAID: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_LABELS = {
    DRAFT: "Draft",
    UNPAID: "Unpaid",
    PARTIALLY_PAID: "Partially Paid",
    PAID: "Paid",
};

export { STATUS_COLORS, STATUS_LABELS };

export function InvoiceStatusBadge_({ status }) {
    const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
    const label = STATUS_LABELS[status] ?? status ?? "—";
    return (
        <span className={`inline-flex items-center rounded-sm border px-3 py-0.5 text-xs font-semibold ${cls}`}>
            {label}
        </span>
    );
}

export default function InvoiceList() {
    const router = useRouter();
    const { can, viewModes, setViewModeForPage } = useContext(loginContext) || {};
    const activeView = viewModes?.["invoice-list"] || "table";
    const [expandedRows, setExpandedRows] = useState({});

    const toggleRow = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    const setViewMode = (mode) => setViewModeForPage("invoice-list", mode);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [statusFilter, setStatusFilter] = useState("");
    const [currentFilters, setCurrentFilters] = useState({});

    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [selectedInvoiceIdForPanel, setSelectedInvoiceIdForPanel] = useState(null);
    const [dueDateInvoice, setDueDateInvoice] = useState(null);
    const [creditNoteInvoice, setCreditNoteInvoice] = useState(null);
    const [debitNoteInvoice, setDebitNoteInvoice] = useState(null);
    const [paymentMode, setPaymentMode] = useState("AUTOMATIC");

    useEffect(() => {
        const fetchPaymentMode = async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: { ...authHeaders(), endpoint: "payment-config", module: "vault" }
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (data?.success === 1) {
                    setPaymentMode(data.mode);
                }
            } catch (err) { }
        };
        fetchPaymentMode();
    }, []);

    const fetchList = async (p = page, lim = limit, status = statusFilter, searchParams = currentFilters) => {
        setError("");
        try {
            const filters = searchParams?.filters ? [...searchParams.filters] : [];
            if (status) filters.push({ key: "status", value: status, operator: "eq" });

            const body = { page: p, limit: lim };
            if (filters.length > 0) {
                body.condition = searchParams?.condition || "All";
                body.filters = filters;
            }

            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "invoice-list",
                    module: "invoice",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (res.status === 401 || res.status === 403) {
                toast.error("You don't have permission to view this list.", { position: "top-right" });
                setError("Unauthorized");
                return;
            }

            const payload = await res.json();
            const responseData = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setData(responseData?.data ?? []);
            setTotalPages(Math.ceil((responseData?.total || 1) / lim));
            setTotalRecords(responseData?.total || 0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList(page, limit, statusFilter, currentFilters);
    }, [page, limit, statusFilter, currentFilters]);

    const handleSearch = (searchParams) => {
        setPage(1);
        setCurrentFilters(searchParams);
        fetchList(1, limit, statusFilter, searchParams);
    };

    const handleSubmit = async (invoiceId) => {
        const result = await MySwal.fire({
            title: "Submit this invoice?",
            text: "This will generate the invoice PDF and mark it as Unpaid.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Submit",
            confirmButtonColor: "#2563eb",
        });
        if (!result.isConfirmed) return;

        try {
            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: { ...authHeaders(), endpoint: `invoice-submit/${invoiceId}`, module: "invoice" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success("Invoice submitted successfully.", { position: "top-right" });
                fetchList(page, limit, statusFilter, currentFilters);
            } else {
                toast.error(data?.message || "Failed to submit.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    const handleMarkPaid = async (invoiceId) => {
        const result = await MySwal.fire({
            title: "Mark this invoice as Paid?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Mark as Paid",
            confirmButtonColor: "#16a34a",
        });
        if (!result.isConfirmed) return;

        try {
            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: { ...authHeaders(), "Content-Type": "application/json", endpoint: `invoice-mark-paid/${invoiceId}`, module: "invoice" },
                body: JSON.stringify({})
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                const vaultRes = data.vaultResult;
                if (vaultRes && vaultRes.result === 'PAID') {
                    toast.success("Paid successfully.", { position: "top-right" });
                } else if (vaultRes && vaultRes.result === 'PARTIAL') {
                    toast.info(`Insufficient balance — invoice marked as partially paid.`, { position: "top-right" });
                } else {
                    toast.success("Invoice marked as paid.", { position: "top-right" });
                }
                fetchList(page, limit, statusFilter, currentFilters);
            } else {
                toast.error(data?.message || "Failed to mark as paid.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    const handleDelete = async (invoiceId) => {
        const result = await MySwal.fire({
            title: "Delete this invoice?",
            text: "This action cannot be undone.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
            confirmButtonColor: "#dc2626",
        });
        if (!result.isConfirmed) return;

        try {
            const res = await fetch("/relayapi", {
                method: "DELETE",
                headers: { ...authHeaders(), endpoint: `invoice-delete/${invoiceId}`, module: "invoice" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success("Invoice deleted.", { position: "top-right" });
                fetchList(page, limit, statusFilter, currentFilters);
            } else {
                toast.error(data?.message || "Failed to delete.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    const handleRegeneratePdf = async (invoiceId) => {
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { ...authHeaders(), endpoint: `invoice-regenerate/${invoiceId}`, module: "invoice" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success("Invoice PDF regenerated.", { position: "top-right" });
                fetchList(page, limit, statusFilter, currentFilters);
            } else {
                toast.error(data?.message || "Failed to regenerate PDF.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    const handlePageChange = (p) => setPage(p);
    const handleLimitChange = (e) => { setLimit(Number(e.target.value)); setPage(1); };

    const columns = getInvoiceTableColumns({
        can,
        onSubmit: handleSubmit,
        onMarkPaid: handleMarkPaid,
        onDelete: handleDelete,
        onRegeneratePdf: handleRegeneratePdf,
        onUpdateDueDate: (invoice) => setDueDateInvoice(invoice),
        onAddCreditNote: (invoice) => {
            handleCreditNoteAddNavigation({ router, setShowAddPanel: setCreditNoteInvoice, invoice });
        },
        onAddDebitNote: (invoice) => {
            handleDebitNoteAddNavigation({ router, setShowAddPanel: setDebitNoteInvoice, invoice });
        },
        onCustomerClick: (id) => setSelectedCustomerId(id),
        onAddedByClick: (id) => setSelectedUserId(id),
        onInvoiceClick: (id) => setSelectedInvoiceIdForPanel(id),
        paymentMode,
    });

    const STATUS_TABS = ["", "DRAFT", "UNPAID", "PARTIALLY_PAID", "PAID"];

    return (
        <div className="min-h-screen bg-[#f5f6fa]">
            <Header
                page="invoice-list"
                onAddClick={() => router.push("/add-invoice")}
                onSearch={handleSearch}
                viewMode={activeView}
                onViewModeChange={setViewMode}
            />
            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Invoices</span>
                </nav>
            </div>

            <div className="px-6 py-4 space-y-5">
                {/* <div className="flex flex-wrap gap-2">
                    {STATUS_TABS.map((s) => (
                        <button
                            key={s || "all"}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${statusFilter === s
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                                }`}
                        >
                            {s === "" ? "All" : STATUS_LABELS[s] ?? s}
                        </button>
                    ))}
                </div> */}

                {activeView !== "table" && (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                        <h1 className="text-2xl font-semibold text-[#1f2937]">Invoices</h1>
                    </div>
                )}

                {loading && <div className="flex justify-center py-16"><Loader label="Loading invoices..." /></div>}
                {!loading && error && <p className="text-center text-red-500 py-12">{error}</p>}

                {!loading && !error && activeView === "table" && (
                    <div className="rounded-2xl overflow-hidden">
                        <DataTable
                            columns={columns}
                            title="Invoice"
                            data={data}
                            filterableColumns={[
                                { id: "invoiceCode", label: "Invoice Code", filterKey: "invoiceCode" },
                                { id: "customerName", label: "Customer", filterKey: "customerName" },
                                { id: "currencyCode", label: "Currency", filterKey: "currencyCode" },
                                { id: "status", label: "Status", filterKey: "status" },
                            ]}
                            onColumnFilterChange={handleSearch}
                            emptyMessage="No invoices found."
                        />
                    </div>
                )}

                {!loading && !error && activeView === "list" && (
                    <div className="w-full bg-white rounded-2xl border border-gray-200 grid grid-cols-1 gap-5 p-4 mb-12">
                        {data.length === 0 && <p className="text-center text-gray-400 py-16">No invoices found.</p>}
                        {data.map((q) => (
                            <InvoiceListRow
                                key={q.invoiceId}
                                invoice={q}
                                can={can}
                                onSubmit={handleSubmit}
                                onMarkPaid={handleMarkPaid}
                                onDelete={handleDelete}
                                onRegeneratePdf={handleRegeneratePdf}
                                onUpdateDueDate={(inv) => setDueDateInvoice(inv)}
                                onAddCreditNote={(inv) => handleCreditNoteAddNavigation({ router, setShowAddPanel: setCreditNoteInvoice, invoice: inv })}
                                onAddDebitNote={(inv) => handleDebitNoteAddNavigation({ router, setShowAddPanel: setDebitNoteInvoice, invoice: inv })}
                                onCustomerClick={(id) => setSelectedCustomerId(id)}
                                onAddedByClick={(id) => setSelectedUserId(id)}
                                onInvoiceClick={(id) => setSelectedInvoiceIdForPanel(id)}
                                isOpen={!!expandedRows[q.invoiceId]}
                                onToggle={() => toggleRow(q.invoiceId)}
                                paymentMode={paymentMode}
                            />
                        ))}
                    </div>
                )}

                {!loading && !error && activeView === "grid" && (
                    <div>
                        {data.length === 0 && <p className="text-center text-gray-400 py-16">No invoices found.</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                            {data.map((q) => (
                                <InvoiceCard
                                    key={q.invoiceId}
                                    invoice={q}
                                    can={can}
                                    onSubmit={handleSubmit}
                                    onMarkPaid={handleMarkPaid}
                                    onDelete={handleDelete}
                                    onRegeneratePdf={handleRegeneratePdf}
                                    onUpdateDueDate={(inv) => setDueDateInvoice(inv)}
                                    onAddCreditNote={(inv) => handleCreditNoteAddNavigation({ router, setShowAddPanel: setCreditNoteInvoice, invoice: inv })}
                                    onAddDebitNote={(inv) => handleDebitNoteAddNavigation({ router, setShowAddPanel: setDebitNoteInvoice, invoice: inv })}
                                    onCustomerClick={(id) => setSelectedCustomerId(id)}
                                    onAddedByClick={(id) => setSelectedUserId(id)}
                                    onInvoiceClick={(id) => setSelectedInvoiceIdForPanel(id)}
                                    isExpanded={!!expandedRows[q.invoiceId]}
                                    onToggle={() => toggleRow(q.invoiceId)}
                                    paymentMode={paymentMode}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {!loading && !error && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                        <p className="text-sm text-gray-500">
                            {totalRecords > 0
                                ? `Viewing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalRecords)} of ${totalRecords}`
                                : "No records"}
                        </p>
                        <div className="flex items-center gap-3">
                            <AppPagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                            />
                            <select
                                value={limit}
                                onChange={handleLimitChange}
                                className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 outline-none focus:border-blue-500 cursor-pointer"
                            >
                                {PAGE_SIZE_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {selectedCustomerId && typeof document !== "undefined" &&
                createPortal(
                    <CustomerSidePanel customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />,
                    document.body
                )}
            {selectedUserId && typeof document !== "undefined" &&
                createPortal(
                    <UserSidePanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} />,
                    document.body
                )}
            {selectedInvoiceIdForPanel && typeof document !== "undefined" && createPortal(<InvoiceSidePanel invoiceId={selectedInvoiceIdForPanel} onClose={() => setSelectedInvoiceIdForPanel(null)} />, document.body)}
            {dueDateInvoice && <InvoiceDueDatePanel invoice={dueDateInvoice} onClose={() => setDueDateInvoice(null)} onSuccess={() => { setDueDateInvoice(null); fetchList(page, limit, statusFilter, currentFilters); }} />}
            {creditNoteInvoice && getCreditNoteMode() === "CUSTOMER" && typeof document !== "undefined" && createPortal(
                <NoteAddPanel
                    noteType="CREDIT"
                    lockedCustomerId={creditNoteInvoice.customerId}
                    lockedCustomerName={creditNoteInvoice.customerName}
                    lockedCurrencyId={creditNoteInvoice.currencyId}
                    lockedCurrencyCode={creditNoteInvoice.currencyCode}
                    lockedInvoiceId={creditNoteInvoice.invoiceId}
                    lockedInvoiceCode={creditNoteInvoice.invoiceCode}
                    lockedCompanyId={creditNoteInvoice.companyId}
                    onClose={() => setCreditNoteInvoice(null)}
                    onSuccess={() => setCreditNoteInvoice(null)}
                />,
                document.body
            )}
            {debitNoteInvoice && getCreditNoteMode() === "CUSTOMER" && typeof document !== "undefined" && createPortal(
                <NoteAddPanel
                    noteType="DEBIT"
                    lockedCustomerId={debitNoteInvoice.customerId}
                    lockedCustomerName={debitNoteInvoice.customerName}
                    lockedCurrencyId={debitNoteInvoice.currencyId}
                    lockedCurrencyCode={debitNoteInvoice.currencyCode}
                    lockedInvoiceId={debitNoteInvoice.invoiceId}
                    lockedInvoiceCode={debitNoteInvoice.invoiceCode}
                    lockedCompanyId={debitNoteInvoice.companyId}
                    onClose={() => setDebitNoteInvoice(null)}
                    onSuccess={() => setDebitNoteInvoice(null)}
                />,
                document.body
            )}
        </div>
    );
}

function InvoiceListRow({ invoice: q, can, onSubmit, onMarkPaid, onDelete, onRegeneratePdf, onUpdateDueDate, onAddCreditNote, onAddDebitNote, onCustomerClick, onAddedByClick, onInvoiceClick, isOpen, onToggle, paymentMode }) {
    const router = useRouter();
    const fmtDate = (d) => formatDisplayDate(d);
    const fmtAmt = (n, sym) => n != null ? `${sym ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`.trim() : "—";



    return (
        <div className="px-6 py-6 border border-gray-200 bg-gray-50/2 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                <div className="min-w-0">
                    <div className="text-sm text-gray-500 mb-1">Invoice No.</div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 min-w-[40px] items-center justify-center overflow-hidden rounded-full bg-blue-600 text-base font-bold uppercase text-white">
                            <span className="text-white font-bold">{getInitials(q.invoiceCode || "-")}</span>
                        </div>
                        <div className="min-w-0">
                            <div
                                className={`text-base font-semibold truncate ${can?.("invoiceView") !== false ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                                onClick={() => onInvoiceClick?.(q.invoiceId)}
                            >
                                {q.invoiceCode || "-"}
                            </div>
                            <div className="text-sm text-gray-500 truncate">{q.customerName ?? "—"}</div>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-500 mb-1">Customer</div>
                    <div
                        className={`text-base break-all ${q.customerId ? "cursor-pointer text-blue-600 hover:underline" : "text-gray-800"}`}
                        onClick={() => q.customerId && onCustomerClick?.(q.customerId)}
                    >
                        {q.customerName || "—"}
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-500 mb-1">Status</div>
                    <InvoiceStatusBadge status={q.status} />
                </div>

                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Final Amount</div>
                        <div className="text-base font-semibold text-gray-800">{fmtAmt(q.finalAmount, q.currency?.symbol ?? q?.currencyCode)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                {(() => {
                                    const primaryAction = [
                                        { show: q.status === "DRAFT" && can?.("invoiceUpdate"), label: "Edit" },
                                        { show: q.status === "DRAFT" && can?.("invoiceUpdate"), label: "Submit" },
                                        { show: q.status === "DRAFT" && can?.("invoiceUpdate"), label: "Delete" },
                                        { show: paymentMode === "MANUAL" && (q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate"), label: "Mark as Paid" },
                                        { show: (q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate"), label: "Update Due Date" },
                                        { show: q.status !== "DRAFT" && can?.("creditNoteAdd"), label: "Add Credit Note" },
                                        { show: q.status !== "DRAFT" && can?.("debitNoteAdd"), label: "Add Debit Note" }
                                    ].find((a) => a.show) ?? { label: "View" };
                                    const primaryLabel = primaryAction.label;

                                    return (
                                        <span
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center justify-between gap-1.5 px-3 py-1.5 w-40 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs"
                                        >
                                            <span className="truncate whitespace-nowrap overflow-hidden">{primaryLabel}</span>
                                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                                        </span>
                                    );
                                })()}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border border-gray-100 p-1">
                                {q.status === "DRAFT" && can?.("invoiceUpdate") && (
                                    <>
                                        <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); router.push(`/invoice/${q.invoiceId}?edit=true`); }}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onSubmit(q.invoiceId); }}>Submit</DropdownMenuItem>
                                        <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete(q.invoiceId); }}>Delete</DropdownMenuItem>
                                    </>
                                )}
                                {(q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate") && (
                                    <>
                                        {paymentMode === "MANUAL" && (
                                            <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onMarkPaid(q.invoiceId); }}>Mark as Paid</DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onUpdateDueDate(q); }}>Update Due Date</DropdownMenuItem>
                                    </>
                                )}
                                {q.status !== "DRAFT" && can?.("creditNoteAdd") && (
                                    <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onAddCreditNote?.(q); }}>Add Credit Note</DropdownMenuItem>
                                )}
                                {q.status !== "DRAFT" && can?.("debitNoteAdd") && (
                                    <DropdownMenuItem className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); onAddDebitNote?.(q); }}>Add Debit Note</DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle?.();
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer ml-2"
                        >
                            <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                    </div>
                </div>
            </div>
            {isOpen && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Invoice Date</div>
                            <div className="text-base text-gray-800 break-all">{q.invoiceDate ? fmtDate(q.invoiceDate) : "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Exchange Date</div>
                            <div className="text-base text-gray-800 break-all">{q.deliveryDate ? fmtDate(q.deliveryDate) : "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Added By</div>
                            <div
                                className={`text-base break-all ${q.addedBy ? "cursor-pointer text-blue-600 hover:underline" : "text-gray-800"}`}
                                onClick={() => q.addedBy && onAddedByClick?.(q.addedBy)}
                            >
                                {q.addedByName || "—"}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Currency Details</div>
                            <div className="text-base text-gray-800 break-all">{q.currencyCode || "—"} {q.currencySymbol ? `(${q.currencySymbol})` : ""}</div>
                        </div>
                        {q.invoiceNo && (
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Invoice No.</div>
                                <div className="text-base text-gray-800 break-all">{q.invoiceNo}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
