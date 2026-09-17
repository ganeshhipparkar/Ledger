"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Header from "../Header";
import Loader from "../ui/Loader";
import AppPagination from "../ui/AppPagination";
import { DataTable } from "../data-table";
import OrderCard, { OrderStatusBadge } from "./OrderCard";
import { getOrderTableColumns } from "./OrderTableColumns";
import OrderUpdatePriceSidePanel from "./OrderUpdatePriceSidePanel";
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
import { getInitials } from "@/lib/utils";
import { createPortal } from "react-dom";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import UserSidePanel from "../user/UserSidePanel";
import OrderSidePanel from "./OrderSidePanel";

const MySwal = withReactContent(Swal);

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function OrderList() {
    const router = useRouter();
    const { can, viewModes, setViewModeForPage } = useContext(loginContext) || {};
    const activeView = viewModes?.["order-list"] || "table";
    const [expandedRows, setExpandedRows] = useState({});

    const toggleRow = (id) => {
        setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };
    const setViewMode = (mode) => setViewModeForPage("order-list", mode);

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
    const [selectedOrderIdForPanel, setSelectedOrderIdForPanel] = useState(null);

    const [pricePanelOpen, setPricePanelOpen] = useState(false);
    const [pricePanelOrder, setPricePanelOrder] = useState(null);

    const fetchList = useCallback(async (p = page, lim = limit, status = statusFilter, searchParams = currentFilters) => {
        setError("");
        try {
            const filters = searchParams?.filters ? [...searchParams.filters] : [];
            if (status) {
                filters.push({ key: "status", value: status, operator: "eq" });
            }

            const body = { page: p, limit: lim };
            if (filters.length > 0) {
                body.condition = searchParams?.condition || "All";
                body.filters = filters;
            }

            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "order-list",
                    module: "order",
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
    }, [page, limit, statusFilter, currentFilters]);

    useEffect(() => {
        fetchList(page, limit, statusFilter, currentFilters);
    }, [page, limit, statusFilter, currentFilters]);

    const handleSearch = (searchParams) => {
        setPage(1);
        setCurrentFilters(searchParams);
        fetchList(1, limit, statusFilter, searchParams);
    };

    const handleStatusUpdate = async (orderId, actionType) => {
        let title = "";
        let confirmText = "";
        let confirmColor = "";
        let endpoint = "";

        if (actionType === "SUBMIT" || actionType === "SUBMITTED") {
            title = "Submit this order?";
            confirmText = "Submit";
            confirmColor = "#2563eb";
            endpoint = `order-submit/${orderId}`;
        } else if (actionType === "CANCEL") {
            title = "Cancel this order?";
            confirmText = "Cancel";
            confirmColor = "#dc2626";
            endpoint = `order-cancel/${orderId}`;
        } else if (actionType === "CLOSE") {
            title = "Close this order?";
            confirmText = "Close";
            confirmColor = "#4b5563";
            endpoint = `order-close/${orderId}`;
        } else if (actionType === "DELETE") {
            title = "Delete this draft order?";
            confirmText = "Delete";
            confirmColor = "#dc2626";
            endpoint = `order-delete/${orderId}`;
        } else {
            return;
        }

        const result = await MySwal.fire({
            title,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: confirmText,
            confirmButtonColor: confirmColor,
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch("/relayapi", {
                method: actionType === "DELETE" ? "DELETE" : "PUT",
                headers: { ...authHeaders(), endpoint, module: "order" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1 || data?.status === true) {
                toast.success(`Order ${confirmText.toLowerCase()}ted successfully.`, { position: "top-right" });
                fetchList(page, limit, statusFilter, currentFilters);
            } else {
                toast.error(data?.message || `Failed to ${confirmText.toLowerCase()}.`, { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    const handleRegeneratePdf = async (orderId) => {
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { ...authHeaders(), endpoint: `order-invoice-regenerate/${orderId}`, module: "order" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success("Order PDF regenerated.", { position: "top-right" });
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

    const columns = getOrderTableColumns({
        can,
        onStatusUpdate: handleStatusUpdate,
        onRegeneratePdf: handleRegeneratePdf,
        onUpdatePrice: (order) => { setPricePanelOrder(order); setPricePanelOpen(true); },
        onCustomerClick: (id) => setSelectedCustomerId(id),
        onAddedByClick: (id) => setSelectedUserId(id),
        onOrderClick: (id) => setSelectedOrderIdForPanel(id)
    });

    return (
        <div className="min-h-screen bg-[#f5f6fa]">
            <Header
                page="order-list"
                onAddClick={() => router.push("/add-order")}
                onSearch={handleSearch}
                viewMode={activeView}
                onViewModeChange={setViewMode}
            />
            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Orders</span>
                </nav>
            </div>

            <div className="px-6 py-4 space-y-5">

                {activeView !== "table" && (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                        <h1 className="text-2xl font-semibold text-[#1f2937]">
                            {"Order"}
                        </h1>
                    </div>
                )}

                {loading && <div className="flex justify-center py-16"><Loader label="Loading orders..." /></div>}
                {!loading && error && <p className="text-center text-red-500 py-12">{error}</p>}

                {!loading && !error && activeView === "table" && (
                    <div className="rounded-2xl overflow-hidden">
                        <DataTable
                            columns={columns}
                            data={data}
                            title={"Order"}
                            filterableColumns={[
                                { id: "orderCode", label: "Order No.", filterKey: "orderCode" },
                                { id: "customerName", label: "Customer", filterKey: "customerName" },
                                { id: "currencyCode", label: "Currency", filterKey: "currencyCode" },
                            ]}
                            onColumnFilterChange={handleSearch}
                            emptyMessage="No orders found."
                        />
                    </div>
                )}

                {!loading && !error && activeView === "list" && (
                    <div className="w-full bg-white rounded-2xl border border-gray-200 grid grid-cols-1 gap-5 p-4 mb-12">
                        {data.length === 0 && (
                            <p className="text-center text-gray-400 py-16">No orders found.</p>
                        )}
                        {data.map((q) => (
                            <OrderListRow
                                key={q.orderId}
                                order={q}
                                onStatusUpdate={handleStatusUpdate}
                                onRegeneratePdf={handleRegeneratePdf}
                                onUpdatePrice={(order) => { setPricePanelOrder(order); setPricePanelOpen(true); }}
                                can={can}
                                onCustomerClick={(id) => setSelectedCustomerId(id)}
                                onAddedByClick={(id) => setSelectedUserId(id)}
                                onOrderClick={(id) => setSelectedOrderIdForPanel(id)}
                            />
                        ))}
                    </div>
                )}

                {!loading && !error && activeView === "grid" && (
                    <div>
                        {data.length === 0 && <p className="text-center text-gray-400 py-16">No orders found.</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                            {data.map((q) => (
                                <OrderCard
                                    key={q.orderId}
                                    order={q}
                                    onStatusUpdate={handleStatusUpdate}
                                    onUpdatePrice={(order) => { setPricePanelOrder(order); setPricePanelOpen(true); }}
                                    can={can}
                                    onCustomerClick={(id) => setSelectedCustomerId(id)}
                                    onAddedByClick={(id) => setSelectedUserId(id)}
                                    isExpanded={!!expandedRows[q.orderId]}
                                    onToggle={() => toggleRow(q.orderId)}
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

            <OrderUpdatePriceSidePanel
                isOpen={pricePanelOpen}
                onClose={() => setPricePanelOpen(false)}
                order={pricePanelOrder}
                onSuccess={() => {
                    fetchList();
                }}
            />

            {selectedCustomerId && typeof document !== "undefined" &&
                createPortal(
                    <CustomerSidePanel
                        customerId={selectedCustomerId}
                        onClose={() => setSelectedCustomerId(null)}
                    />,
                    document.body
                )}

            {selectedUserId && typeof document !== "undefined" &&
                createPortal(
                    <UserSidePanel
                        userId={selectedUserId}
                        onClose={() => setSelectedUserId(null)}
                    />,
                    document.body
                )}

            {selectedOrderIdForPanel && (
                <OrderSidePanel
                    id={selectedOrderIdForPanel}
                    onClose={() => setSelectedOrderIdForPanel(null)}
                />
            )}
        </div>
    );
}

function OrderListRow({ order: q, onStatusUpdate, onUpdatePrice, onRegeneratePdf, can, onCustomerClick, onAddedByClick, isExpanded, onToggle }) {
    const router = useRouter();
    const fmtAmt = (n, sym) => `${sym ?? ""} ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`.trim();
    const fmtDate = (d) => {
        if (!d) return "—";
        const date = new Date(d);
        return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    const handleView = () => router.push(`/order/${q.orderId}`);
    const handleEdit = () => router.push(`/order/${q.orderId}?edit=true`);
    const handleSubmit = () => onStatusUpdate?.(q.orderId, "SUBMIT");
    const handleCancel = () => onStatusUpdate?.(q.orderId, "CANCEL");
    const handleClose = () => onStatusUpdate?.(q.orderId, "CLOSE");
    const handleDelete = () => onStatusUpdate?.(q.orderId, "DELETE");

    const isOpen = q.orderStatus === "OPEN" || !q.orderStatus;

    return (
        <div className="px-6 py-6 border border-gray-200 bg-gray-50/2 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                <div className="min-w-0">
                    <div className="text-sm text-gray-500 mb-1">Order No.</div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 min-w-[40px] items-center justify-center overflow-hidden rounded-full bg-blue-600 text-base font-bold uppercase text-white">
                            <span className="text-white font-bold">{getInitials(q.orderCode ?? `OD-${q.orderId}`)}</span>
                        </div>
                        <div className="min-w-0">
                            <div
                                className={`text-base font-semibold truncate ${can?.("orderView") !== false ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                                onClick={handleView}
                            >
                                {q.orderCode ?? `OD-${q.orderId}`}
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
                    <div className="flex flex-col gap-1 w-fit">
                        <OrderStatusBadge status={q.status} />
                        {q.orderStatus === "CLOSED" && (
                            <span className="mt-1 inline-block rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-600 font-medium">
                                Lifecycle: Closed
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Final Amount</div>
                        <div className="text-base font-semibold text-gray-800">{fmtAmt(q.finalAmount, q?.currency?.symbol ?? q?.currencyCode)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                    <span
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs"
                                    >
                                        Actions <ChevronDown className="h-4 w-4 text-gray-500" />
                                    </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 bg-white border border-gray-200 shadow-lg rounded-xl">
                                <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleView();
                                    }}
                                >
                                    View Details
                                </DropdownMenuItem>
                                {isOpen && q.status === "DRAFT" && can?.("orderUpdate") !== false && (
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
                                            Submit Order
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="cursor-pointer px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete();
                                            }}
                                        >
                                            Delete
                                        </DropdownMenuItem>
                                    </>
                                )}
                                {isOpen && q.status === "PLACED" && (
                                    <>
                                        {q.invoicePdfPath && (
                                            <>
                                                <DropdownMenuItem
                                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                    onClick={(e) => { e.stopPropagation(); window.open(`http://localhost:4000${q.invoicePdfPath}`, "_blank"); }}
                                                >
                                                    View Invoice
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            await downloadFile(q.invoicePdfPath, `Invoice_${q.orderCode ?? q.orderId}.pdf`);
                                                        } catch (err) {
                                                            toast.error("Failed to download invoice", { position: "top-right" });
                                                        }
                                                    }}
                                                >
                                                    Download Invoice
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        {can?.("orderUpdate") !== false && (
                                            <>
                                                <DropdownMenuItem
                                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRegeneratePdf?.(q.orderId);
                                                    }}
                                                >
                                                    Regenerate PDF
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onUpdatePrice?.(q);
                                                    }}
                                                >
                                                    Update Price
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="cursor-pointer px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCancel();
                                                    }}
                                                >
                                                    Cancel Order
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </>
                                )}
                                {isOpen && (q.status === "PARTIAL_DELIVERED" || q.status === "DELIVERED") && can?.("orderUpdate") !== false && (
                                    <>
                                        <DropdownMenuItem
                                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onUpdatePrice?.(q);
                                            }}
                                        >
                                            Update Price
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleClose();
                                            }}
                                        >
                                            Close Order
                                        </DropdownMenuItem>
                                    </>
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
                            <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Order Date</div>
                            <div className="text-base text-gray-800 break-all">{q.orderDate ? fmtDate(q.orderDate) : "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Delivery Date</div>
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
                    </div>
                </div>
            )}
        </div>
    );
}
