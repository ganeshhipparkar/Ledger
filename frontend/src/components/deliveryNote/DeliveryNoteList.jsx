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
import { Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import DeliveryNoteCard from "./DeliveryNoteCard";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import DetailsSidePanel from "../DetailsSidePanel";
import { deliveryNoteSidePanelConfig } from "./configs/deliveryNoteSidePanel.config";

export default function DeliveryNoteList() {
    const router = useRouter();
    const { can, viewModes, setViewModeForPage } = useContext(loginContext) || {};
    const activeView = viewModes?.["delivery-note-list"] || "table";
    const setViewMode = (mode) => setViewModeForPage?.("delivery-note-list", mode);

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentFilters, setCurrentFilters] = useState({});

    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [viewId, setViewId] = useState(null);

    const fetchList = useCallback(async (p = page, lim = limit, searchParams = currentFilters) => {
        setError("");
        setLoading(true);
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
                setError(result?.message || "Failed to fetch delivery notes.");
                setData([]);
            }
        } catch (err) {
            console.error("fetchList error:", err);
            setError("An unexpected error occurred while fetching delivery notes.");
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
        {
            id: "actions",
            header: "Action",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setViewId(row.original.deliveryNoteId)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="View Details"
                    >
                        <Eye className="h-4 w-4" />
                    </button>
                </div>
            ),
        },
    ], [page, limit]);

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <Header
                page="delivery-note-list"
                onSearch={handleSearch}
                onAddClick={() => router.push("/add-delivery-note")}
                viewMode={activeView}
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
                {activeView !== "table" && (
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

                {!loading && !error && activeView === "table" && (
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

                {!loading && !error && activeView === "grid" && (
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
