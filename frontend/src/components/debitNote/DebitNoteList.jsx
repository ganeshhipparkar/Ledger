"use client";

import Link from "next/link";
import { useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Header from "../Header";
import Loader from "../ui/Loader";
import AppPagination from "../ui/AppPagination";
import { DataTable } from "../data-table";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import { createPortal } from "react-dom";
import { ChevronDown, FileText } from "lucide-react";
import { getInitials } from "@/lib/utils";
import NoteAddPanel from "../notes/NoteAddPanel";
import DebitNoteCard from "./DebitNoteCard";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import { handleDebitNoteAddNavigation } from "@/lib/useDebitNoteNavigation";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_COLORS = {
    SUBMITTED: "bg-blue-100 text-blue-700 border-blue-200",
};

export function DebitNoteStatusBadge({ status }) {
    const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
    const label = status ? status.charAt(0) + status.slice(1).toLowerCase() : "—";
    return (
        <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold ${cls}`}>
            {label}
        </span>
    );
}

function getDebitNoteTableColumns({ can, onViewClick }) {
    return [
        {
            id: "debitNoteCode",
            header: "DN Code",
            cell: ({ row }) => {
                const r = row.original;
                return (
                    <button
                        type="button"
                        onClick={() => onViewClick?.(r.id)}
                        className="font-semibold text-blue-600 hover:underline text-sm whitespace-nowrap"
                    >
                        {r.debitNoteCode}
                    </button>
                );
            },
        },
        {
            id: "customerName",
            header: "Customer",
            cell: ({ row }) => {
                const r = row.original;
                return (
                    <span
                        className="text-sm text-blue-600 hover:underline cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); r.customerId && onCustomerClick?.(r.customerId); }}
                    >
                        {r.customerName || "—"}
                    </span>
                );
            },
        },
        {
            id: "invoiceCode",
            header: "Invoice",
            cell: ({ row }) => (
                <span className="text-sm text-gray-700">{row.original.invoiceCode || "—"}</span>
            ),
        },
        {
            id: "currencyCode",
            header: "Currency",
            cell: ({ row }) => (
                <span className="text-sm text-gray-600">{row.original.currencyCode || "—"}</span>
            ),
        },
        {
            id: "customerCharges",
            header: "Customer Charges",
            cell: ({ row }) => (
                <span className="text-sm text-gray-600">{row.original.customerCharges || "—"}</span>
            ),
        },
        {
            id: "narration",
            header: "Narration",
            cell: ({ row }) => (
                <span className="text-sm text-gray-600 truncate max-w-[200px] inline-block" title={row.original.narration || ""}>
                    {row.original.narration || "—"}
                </span>
            ),
        },
        {
            id: "totalAmount",
            header: "Total Amount",
            cell: ({ row }) => (
                <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
                    {Number(row.original.totalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            id: "taxAmount",
            header: "Tax Amount",
            cell: ({ row }) => (
                <span className="text-sm text-gray-700 whitespace-nowrap">
                    {Number(row.original.taxAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            id: "finalAmount",
            header: "Final Amount",
            cell: ({ row }) => (
                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {Number(row.original.finalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            id: "status",
            header: "Status",
            cell: ({ row }) => <DebitNoteStatusBadge status={row.original.status} />,
        },
        {
            id: "addedByName",
            header: "Added By",
            cell: ({ row }) => (
                <span className="text-sm text-gray-600">{row.original.addedByName || "—"}</span>
            ),
        },
        // {
        //     id: "actions",
        //     header: "Actions",
        //     cell: ({ row }) => {
        //         const r = row.original;
        //         return (
        //             <button
        //                 type="button"
        //                 onClick={() => onViewClick?.(r.id)}
        //                 className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm cursor-pointer"
        //             >
        //                 View Details
        //             </button>
        //         );
        //     },
        // },
    ];
}

function DebitNoteListRow({ debitNote: cn, isOpen, onToggle, onCustomerClick }) {
    const sym = cn.currencyCode;
    const fmtAmt = (n, s) => n != null ? `${s ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim() : "—";
    const initials = getInitials(cn.debitNoteCode || "-");

    return (
        <div className="px-6 py-6 border border-gray-200 bg-gray-50/2 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                <div className="min-w-0">
                    <div className="text-sm text-gray-500 mb-1">DN Code</div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 min-w-[40px] items-center justify-center overflow-hidden rounded-full bg-blue-600 text-base font-bold uppercase text-white">
                            <span className="text-white font-bold">{initials}</span>
                        </div>
                        <div className="min-w-0">
                            <Link
                                href={`/debit-note/${cn.id}`}
                                className="text-base font-semibold truncate cursor-pointer hover:underline text-[#3563e9] block"
                            >
                                {cn.debitNoteCode || "-"}
                            </Link>
                            <div className="text-sm text-gray-500 truncate">
                                <span
                                    className="text-blue-600 hover:underline cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); cn.customerId && onCustomerClick?.(cn.customerId); }}
                                >
                                    {cn.customerName || "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-500 mb-1">Invoice Code</div>
                    <div className="text-base text-gray-800 break-all">
                        {cn.invoiceCode || "—"}
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-500 mb-1">Status</div>
                    <DebitNoteStatusBadge status={cn.status} />
                </div>

                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Final Amount</div>
                        <div className="text-base font-semibold text-gray-800">{fmtAmt(cn.finalAmount, sym)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* <Link
                            href={`/debit-note/${cn.id}`}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                        >
                            View Details
                        </Link> */}
                        <button
                            onClick={onToggle}
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
                            <div className="text-sm text-gray-500 mb-1">Customer Charges</div>
                            <div className="text-base text-gray-800 break-all">{cn.customerCharges || "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Added By</div>
                            <div className="text-base text-gray-800 break-all">{cn.addedByName || "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Total Amount</div>
                            <div className="text-base text-gray-800 break-all">{fmtAmt(cn.totalAmount, sym)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Tax Amount</div>
                            <div className="text-base text-gray-800 break-all">{fmtAmt(cn.taxAmount, sym)}</div>
                        </div>
                        <div className="sm:col-span-4">
                            <div className="text-sm text-gray-500 mb-1">Narration</div>
                            <div className="text-base text-gray-800 break-words">{cn.narration || "—"}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DebitNoteList() {
    const router = useRouter();
    const { can, viewModes, setViewModeForPage } = useContext(loginContext) || {};
    const activeView = viewModes?.["debit-note-list"] || "table";
    const setViewMode = (mode) => setViewModeForPage?.("debit-note-list", mode);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    const [expandedRows, setExpandedRows] = useState({});
    const toggleRow = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentFilters, setCurrentFilters] = useState({});

    const [showAddPanel, setShowAddPanel] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);

    const fetchList = useCallback(async (p = page, lim = limit, searchParams = currentFilters) => {
        setError("");
        try {
            const filters = searchParams?.filters ? [...searchParams.filters] : [];
            const body = { page: p, limit: lim };
            if (filters.length > 0) {
                body.condition = searchParams?.condition || "All";
                body.filters = filters;
            }

            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "debit-note-list",
                    module: "debit-note",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (res.status === 401 || res.status === 403) {
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
    }, [page, limit, currentFilters]);

    useEffect(() => { fetchList(page, limit, currentFilters); }, [page, limit, currentFilters]);

    const handleSearch = (searchParams) => {
        setPage(1);
        setCurrentFilters(searchParams);
        fetchList(1, limit, searchParams);
    };

    const columns = getDebitNoteTableColumns({
        can,
        onViewClick: (id) => router.push(`/debit-note/${id}`),
        onCustomerClick: (id) => setSelectedCustomerId(id),
    });

    return (
        <div className="min-h-screen bg-[#f5f6fa]">
            <Header
                page="debit-note-list"
                onAddClick={can?.("debitNoteAdd") ? () => handleDebitNoteAddNavigation({ router, setShowAddPanel }) : undefined}
                onSearch={handleSearch}
                viewMode={activeView}
                onViewModeChange={setViewMode}
            />

            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Debit Notes</span>
                </nav>
            </div>

            <div className="px-6 py-4 space-y-5">
                {activeView !== "table" && (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                        <h1 className="text-2xl font-semibold text-[#1f2937]">Debit Notes</h1>
                    </div>
                )}

                {loading && <div className="flex justify-center py-16"><Loader label="Loading credit notes..." /></div>}
                {!loading && error && <p className="text-center text-red-500 py-12">{error}</p>}

                {!loading && !error && activeView === "table" && (
                    <div className="rounded-2xl overflow-hidden">
                        <DataTable
                            columns={columns}
                            title="Debit Note"
                            data={data}
                            filterableColumns={[
                                { id: "debitNoteCode", label: "DN Code", filterKey: "debitNoteCode" },
                                { id: "customerName", label: "Customer", filterKey: "customerName" },
                                { id: "invoiceCode", label: "Invoice Code", filterKey: "invoiceCode" },
                                { id: "status", label: "Status", filterKey: "status" },
                            ]}
                            onColumnFilterChange={handleSearch}
                            emptyMessage="No credit notes found."
                        />
                    </div>
                )}

                {!loading && !error && activeView === "list" && (
                    <div className="w-full bg-white rounded-2xl border border-gray-200 grid grid-cols-1 gap-5 p-4 mb-12">
                        {data.length === 0 && <p className="text-center text-gray-400 py-16">No credit notes found.</p>}
                        {data.map((cn) => (
                            <DebitNoteListRow
                                key={cn.id}
                                debitNote={cn}
                                isOpen={!!expandedRows[cn.id]}
                                onToggle={() => toggleRow(cn.id)}
                                onCustomerClick={(id) => setSelectedCustomerId(id)}
                            />
                        ))}
                    </div>
                )}

                {!loading && !error && activeView === "grid" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                        {data.length === 0 && <p className="text-center text-gray-400 py-16 col-span-full bg-white rounded-2xl border border-gray-200">No credit notes found.</p>}
                        {data.map((cn) => (
                            <DebitNoteCard key={cn.id} debitNote={cn} onCustomerClick={(id) => setSelectedCustomerId(id)} />
                        ))}
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
                            <AppPagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
                            <select
                                value={limit}
                                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                                className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 outline-none focus:border-blue-500 cursor-pointer"
                            >
                                {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {showAddPanel && typeof document !== "undefined" && createPortal(
                <NoteAddPanel
                    noteType="DEBIT"
                    onClose={() => setShowAddPanel(false)}
                    onSuccess={() => { setShowAddPanel(false); fetchList(page, limit, currentFilters); }}
                />,
                document.body
            )}

            {selectedCustomerId && typeof document !== "undefined" && createPortal(
                <CustomerSidePanel customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />,
                document.body
            )}
        </div>
    );
}
