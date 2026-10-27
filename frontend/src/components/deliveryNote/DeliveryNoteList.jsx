"use client";

import Link from "next/link";
import { useCallback, useContext, useEffect, useState, useMemo } from "react";
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
import { Eye, ChevronDown } from "lucide-react";
import { formatDate, getInitials } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import DeliveryNoteCard from "./DeliveryNoteCard";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import DetailsSidePanel from "../DetailsSidePanel";
import { deliveryNoteSidePanelConfig } from "./configs/deliveryNoteSidePanel.config";

function DeliveryNoteListRow({ deliveryNote: dn, isExpanded, onToggle, onCustomerClick, onViewClick }) {
    const initials = getInitials(dn.deliveryNoteCode || "DN");

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
                            <button
                                type="button"
                                onClick={() => onViewClick?.(dn.deliveryNoteId)}
                                className="text-base font-semibold truncate cursor-pointer hover:underline text-[#3563e9] block text-left bg-transparent border-none p-0"
                            >
                                {dn.deliveryNoteCode || "-"}
                            </button>
                            <div className="text-sm text-gray-500 truncate">
                                <span
                                    className="text-blue-600 hover:underline cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dn.customerId && onCustomerClick?.(dn.customerId);
                                    }}
                                >
                                    {dn.customerName || "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-500 mb-1">Order Number</div>
                    <div className="text-base text-gray-800 break-all">
                        {dn.orderCode || "—"}
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-500 mb-1">Delivery Date</div>
                    <div className="text-base text-gray-800 break-all">
                        {formatDate(dn.deliveryDate)}
                    </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Receiver Name</div>
                        <div className="text-base text-gray-800 break-all">{dn.receiverName || "—"}</div>
                    </div>
                    <div className="flex items-center gap-1">

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle?.();
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer ml-2"
                            title={isExpanded ? "Collapse" : "Expand"}
                        >
                            <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Customer</div>
                            <div
                                className={`text-base break-all ${dn.customerId ? "cursor-pointer text-blue-600 hover:underline" : "text-gray-800"}`}
                                onClick={() => dn.customerId && onCustomerClick?.(dn.customerId)}
                            >
                                {dn.customerName || "—"}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Billing Address</div>
                            <div className="text-base text-gray-800 break-words">{dn.billingAddress || "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Added By</div>
                            <div className="text-base text-gray-800 break-all">{dn.addedByName || "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Added Date</div>
                            <div className="text-base text-gray-800 break-all">{formatDate(dn.addedDate)}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DeliveryNoteList() {
    const router = useRouter();
    const { can, viewModes, setViewModeForPage } = useContext(loginContext) || {};
    const activeView = viewModes?.["delivery-note-list"] || "table";
    const currentView = ["grid", "list"].includes(activeView) ? activeView : "table";
    const setViewMode = (mode) => setViewModeForPage?.("delivery-note-list", mode);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

    const [expandedRows, setExpandedRows] = useState({});
    const toggleRow = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentFilters, setCurrentFilters] = useState({});

    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [viewId, setViewId] = useState(null);

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
                    endpoint: "delivery-note-list",
                    module: "delivery-note",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (res.status === 401 || res.status === 403) {
                toast.error("You don't have permission to view delivery notes", { position: "top-right" });
                setError("Access denied.");
                setData([]);
                return;
            }

            const payload = await res.json();
            const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (result && result.success !== 0) {
                const list = result.data || [];
                setData(list);
                const total = result.total || list.length;
                setTotalRecords(total);
                setTotalPages(Math.max(1, Math.ceil(total / lim)));
            } else {
                const msg = result?.message || "Failed to fetch delivery notes.";
                toast.error(msg);
                setError(msg);
                setData([]);
            }
        } catch (err) {
            console.error("fetchList error:", err);
            const msg = "An unexpected error occurred while fetching delivery notes.";
            toast.error(msg);
            setError(msg);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [page, limit, currentFilters]);

    useEffect(() => {
        fetchList(page, limit, currentFilters);
    }, [page, limit, currentFilters, fetchList]);

    const handleSearch = (searchParams) => {
        setCurrentFilters(searchParams);
        setPage(1);
    };

    const columns = useMemo(() => [
        {
            accessorKey: "index",
            header: "#",
            cell: ({ row }) => (page - 1) * limit + row.index + 1,
        },
        {
            accessorKey: "deliveryNoteCode",
            header: "DN Code",
            cell: ({ row }) => (
                <button
                    type="button"
                    onClick={() => setViewId(row.original.deliveryNoteId)}
                    className="font-medium text-blue-600 hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
                >
                    {row.original.deliveryNoteCode || "-"}
                </button>
            ),
        },
        {
            accessorKey: "customerName",
            header: "Customer",
            cell: ({ row }) => (
                <span
                    className="text-blue-600 hover:underline cursor-pointer font-medium"
                    onClick={() => row.original.customerId && setSelectedCustomerId(row.original.customerId)}
                >
                    {row.original.customerName || "-"}
                </span>
            ),
        },
        {
            accessorKey: "orderCode",
            header: "Order Code",
            cell: ({ row }) => row.original.orderCode || "-",
        },
        {
            accessorKey: "deliveryDate",
            header: "Delivery Date",
            cell: ({ row }) => formatDate(row.original.deliveryDate),
        },
        {
            accessorKey: "receiverName",
            header: "Receiver Name",
            cell: ({ row }) => row.original.receiverName || "-",
        },
        {
            accessorKey: "addedDate",
            header: "Added Date",
            cell: ({ row }) => formatDate(row.original.addedDate),
        },

    ], [page, limit]);

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <Header
                page="delivery-note-list"
                onSearch={handleSearch}
                onAddClick={() => router.push("/add-delivery-note")}
                viewMode={currentView}
                onViewModeChange={setViewMode}
            />

            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Delivery Notes</span>
                </nav>
            </div>

            <div className="px-6 py-4 space-y-5">
                {currentView !== "table" && (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                        <h1 className="text-2xl font-semibold text-[#1f2937]">Delivery Notes</h1>
                    </div>
                )}

                {loading && (
                    <div className="flex justify-center py-16">
                        <Loader label="Loading delivery notes..." />
                    </div>
                )}

                {!loading && error && (
                    <p className="text-center text-red-500 py-12">{error}</p>
                )}

                {!loading && !error && currentView === "table" && (
                    <div className="rounded-2xl overflow-hidden">
                        <DataTable
                            columns={columns}
                            title="Delivery Note"
                            data={data}
                            filterableColumns={[
                                { id: "deliveryNoteCode", label: "DN Code", filterKey: "deliveryNoteCode" },
                                { id: "customerName", label: "Customer", filterKey: "customerName" },
                                { id: "orderCode", label: "Order Code", filterKey: "orderCode" },
                                { id: "receiverName", label: "Receiver Name", filterKey: "receiverName" },
                                { id: "deliveryDate", label: "Delivery Date", filterKey: "deliveryDate" },
                            ]}
                            onColumnFilterChange={handleSearch}
                            emptyMessage="No delivery notes found."
                        />
                    </div>
                )}

                {!loading && !error && currentView === "list" && (
                    <div className="w-full bg-white rounded-2xl border border-gray-200 grid grid-cols-1 gap-5 p-4 mb-12">
                        {data.length === 0 && (
                            <p className="text-center text-gray-400 py-16">
                                No delivery notes found.
                            </p>
                        )}
                        {data.map((dn) => (
                            <DeliveryNoteListRow
                                key={dn.deliveryNoteId}
                                deliveryNote={dn}
                                isExpanded={!!expandedRows[dn.deliveryNoteId]}
                                onToggle={() => toggleRow(dn.deliveryNoteId)}
                                onCustomerClick={(id) => setSelectedCustomerId(id)}
                                onViewClick={(id) => setViewId(id)}
                            />
                        ))}
                    </div>
                )}

                {!loading && !error && currentView === "grid" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                        {data.length === 0 && (
                            <p className="text-center text-gray-400 py-16 col-span-full bg-white rounded-2xl border border-gray-200">
                                No delivery notes found.
                            </p>
                        )}
                        {data.map((dn) => (
                            <DeliveryNoteCard
                                key={dn.deliveryNoteId}
                                deliveryNote={dn}
                                onCustomerClick={(id) => setSelectedCustomerId(id)}
                                onViewClick={(id) => setViewId(id)}
                            />
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
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
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

            {selectedCustomerId && typeof document !== "undefined" && createPortal(
                <CustomerSidePanel
                    customerId={selectedCustomerId}
                    onClose={() => setSelectedCustomerId(null)}
                />,
                document.body
            )}

            {viewId && typeof document !== "undefined" && createPortal(
                <DetailsSidePanel
                    config={deliveryNoteSidePanelConfig}
                    id={viewId}
                    onClose={() => setViewId(null)}
                />,
                document.body
            )}
        </div>
    );
}
