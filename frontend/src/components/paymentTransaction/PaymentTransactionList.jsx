"use client";

import { decryptResponse } from "@/app/lib/crypto";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { loginContext } from "../hooks/LoginContext";
import Header from "../Header";
import { toast } from "react-toastify";
import { authHeaders } from "@/app/lib/auth";
import AppPagination from "../ui/AppPagination";
import Loader from "../ui/Loader";
import { DataTable } from "../data-table";
import { getPaymentTransactionColumns } from "./PaymentTransactionColumn";
import DetailsSidePanel from "../DetailsSidePanel";
import { paymentTransactionSidePanelConfig } from "./configs/paymentTransactionSidePanelConfig";
import PaymentTransactionStatusSidePanel from "./PaymentTransactionStatusSidePanel";
import { createPortal } from "react-dom";
import { Plus, MoreVertical, CheckCircle, XCircle, ChevronDown } from "lucide-react";
import LinkedCustomerCell from "../common/LinkedCustomerCell";
import LinkedBankBookCell from "../common/LinkedBankBookCell";
import { formatDate } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function PaymentTransactionList() {
    const router = useRouter();
    const { can, viewModes, setViewModeForPage } = useContext(loginContext);

    const [paymentTransactions, setPaymentTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [limit, setLimit] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentFilters, setCurrentFilters] = useState({});

    const [viewId, setViewId] = useState(null);
    const activeView = viewModes?.["payment-transactions"] || "table";
    const [expandedRows, setExpandedRows] = useState({});

    const toggleRow = (id) => {
        setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Status action side panel state (Approve / Cancel)
    const [statusModal, setStatusModal] = useState({
        open: false,
        transactionId: null,
        action: "approve",
    });

    useEffect(() => {
        fetchData(1, {});
    }, []);

    async function fetchData(
        page = currentPage,
        searchParams = currentFilters,
        limitOverride = limit
    ) {
        setError("");
        try {
            const body = { page, limit: limitOverride };
            if (searchParams?.filters?.length > 0) {
                body.condition = searchParams.condition || "All";
                body.filters = searchParams.filters;
            }
            const response = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "payment-transaction-list",
                    module: "payment-transaction",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (response.status === 401 || response.status === 403) {
                toast.error("You don't have permission to view this list", {
                    position: "top-right",
                });
                setError("Access denied.");
                return;
            }

            const payload = await response.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setPaymentTransactions(data?.data ?? []);
            setTotalPages(Math.ceil((data?.total || 1) / limitOverride));
            setTotalRecords(data?.total || 0);
        } catch (err) {
            toast.error(`${err}`, { position: "top-right" });
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleSearch = (searchParams) => {
        setCurrentPage(1);
        setCurrentFilters(searchParams);
        fetchData(1, searchParams);
    };

    const handleLimitChange = (newLimit) => {
        setLimit(newLimit);
        setCurrentPage(1);
        fetchData(1, currentFilters, newLimit);
    };

    const goToPage = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        fetchData(page, currentFilters);
    };

    const gotoPages = (e, url) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(url);
    };

    const openAdd = () => {
        router.push("/payment-transaction-add");
    };

    const handleAction = (id, actionType) => {
        setStatusModal({ open: true, transactionId: id, action: actionType });
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-[#f5f6fa] overflow-hidden">
            <Header page="payment-transactions" onSearch={handleSearch} onAddClick={openAdd} viewMode={activeView} onViewModeChange={(m) => setViewModeForPage("payment-transactions", m)} />

            <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col min-h-0 overflow-hidden">
                <nav className="mb-4 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span
                        className="cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/")}
                    >
                        Home
                    </span>

                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800 font-semibold">Payment Transaction</span>
                </nav>

                {activeView !== "table" && (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                        <h1 className="text-2xl font-semibold text-[#1f2937]">
                            {"Payment Transactions"}
                        </h1>
                    </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {loading && (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
                            <Loader label="Loading payment transactions..." />
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center justify-center py-20 text-red-500 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {!loading && !error && activeView === "table" && (
                        <DataTable
                            title="Payment Transactions"
                            columns={getPaymentTransactionColumns(
                                (id) => setViewId(id),
                                handleAction
                            )}
                            data={paymentTransactions}
                            filterableColumns={[
                                { id: "paymentCode", label: "Payment Code", filterKey: "paymentCode" },
                                { id: "narration", label: "Narration", filterKey: "narration" },
                                { id: "customerName", label: "Customer", filterKey: "customerName" },
                                { id: "bankBookName", label: "Bank Account", filterKey: "bankBookName" },
                                { id: "companyName", label: "Company", filterKey: "companyName" },
                                { id: "currencyCode", label: "Currency", filterKey: "currencyCode" },
                                { id: "paymentMode", label: "Payment Mode", filterKey: "paymentMode" },
                                { id: "status", label: "Status", filterKey: "status" },
                            ]}
                            onColumnFilterChange={handleSearch}
                            loading={loading}
                            emptyMessage="No payment transactions found."
                            containerClassName="flex-1 overflow-y-auto"
                        />
                    )}

                    {!loading && !error && activeView === "list" && (
                        <div className="w-full bg-white rounded-2xl border border-gray-200 grid grid-cols-1 gap-5 p-4 mb-12 overflow-y-auto">
                            {paymentTransactions.length === 0 && (
                                <p className="text-center text-gray-400 py-16">No payment transactions found.</p>
                            )}
                            {paymentTransactions.map((q) => (
                                <PaymentTransactionListRow
                                    key={q.paymentTransactionId}
                                    transaction={q}
                                    can={can}
                                    onView={(id) => setViewId(id)}
                                    onAction={handleAction}
                                    isOpen={!!expandedRows[q.paymentTransactionId]}
                                    onToggle={() => toggleRow(q.paymentTransactionId)}
                                />
                            ))}
                        </div>
                    )}

                    {!loading && !error && activeView === "grid" && (
                        <div className="overflow-y-auto pb-12">
                            {paymentTransactions.length === 0 && <p className="text-center text-gray-400 py-16">No payment transactions found.</p>}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                                {paymentTransactions.map((q) => (
                                    <PaymentTransactionCard
                                        key={q.paymentTransactionId}
                                        transaction={q}
                                        can={can}
                                        onView={(id) => setViewId(id)}
                                        onAction={handleAction}
                                        isOpen={!!expandedRows[q.paymentTransactionId]}
                                        onToggle={() => toggleRow(q.paymentTransactionId)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full flex items-center justify-between bg-white border-t border-gray-200 px-6 py-3 z-30">
                <div className="text-sm font-medium text-gray-800">
                    {totalRecords > 0
                        ? `View ${(currentPage - 1) * limit + 1} - ${Math.min(
                            currentPage * limit,
                            totalRecords
                        )} of ${totalRecords}`
                        : "View 0 of 0"}
                </div>
                <div className="flex items-center gap-3">
                    <AppPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={goToPage}
                    />
                    <select
                        value={limit}
                        onChange={(e) => handleLimitChange(Number(e.target.value))}
                        className="h-9 rounded-lg border border-blue-500 bg-white px-3 text-sm text-gray-700 outline-none cursor-pointer"
                    >
                        <option value={5}>5</option>
                        <option value={8}>8</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            {viewId &&
                typeof document !== "undefined" &&
                createPortal(
                    <DetailsSidePanel
                        config={paymentTransactionSidePanelConfig}
                        id={viewId}
                        onClose={() => setViewId(null)}
                    />,
                    document.body
                )}

            <PaymentTransactionStatusSidePanel
                isOpen={statusModal.open}
                onClose={() => setStatusModal({ open: false, transactionId: null, action: "approve" })}
                transactionId={statusModal.transactionId}
                action={statusModal.action}
                onSuccess={() => fetchData(currentPage, currentFilters)}
            />
        </div>
    );
}

function PaymentTransactionStatusBadge({ status }) {
    let badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    if (status === "Approved") badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "Cancelled") badgeClass = "bg-red-50 text-red-700 border-red-200";
    return (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badgeClass}`}>
            {status || "Pending"}
        </span>
    );
}

function PaymentTransactionListRow({ transaction: q, can, onView, onAction, isOpen, onToggle }) {
    const isPending = (q.status || "Pending") === "Pending";
    const fmtAmt = (n, code, sym) => {
        if (n == null) return "—";
        return `${code || ""} ${sym ? `(${sym})` : ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`.trim();
    };

    return (
        <div className="px-6 py-6 border border-gray-200 bg-gray-50/2 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-start">
                <div className="min-w-0">
                    <div className="text-sm text-gray-500 mb-1">Payment Code</div>
                    <div
                        className="text-base font-semibold text-blue-600 hover:underline cursor-pointer truncate"
                        onClick={() => onView?.(q.paymentTransactionId)}
                    >
                        {q.paymentCode || "-"}
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-500 mb-1">Customer</div>
                    <div className="text-sm truncate">
                        <LinkedCustomerCell
                            customerId={q.customerId}
                            customerName={q.customerName || q.customer?.customerName}
                        />
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-500 mb-1">Bank Account</div>
                    <div className="text-sm truncate">
                        <LinkedBankBookCell
                            bankBookId={q.bankBookId}
                            bankBookName={q.bankBookName || q.bankBook?.bankBookName}
                        />
                    </div>
                </div>

                <div>
                    <div className="text-sm text-gray-500 mb-1">Status</div>
                    <PaymentTransactionStatusBadge status={q.status} />
                </div>

                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Amount</div>
                        <div className="text-base font-semibold text-gray-800">
                            {fmtAmt(q.transactionAmount, q.currencyCode || q.currency?.code, q.currencySymbol || q.currency?.symbol)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{formatDate(q.paymentDate)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                        {can?.("paymentTransactionUpdate") && isPending && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <span
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs"
                                    >
                                        Actions <ChevronDown className="h-4 w-4 text-gray-500" />
                                    </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg rounded-xl">
                                    {/* <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onView?.(q.paymentTransactionId);
                                    }}
                                >
                                    View Details
                                </DropdownMenuItem> */}

                                    <DropdownMenuItem
                                        className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-emerald-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAction?.(q.paymentTransactionId, "approve");
                                        }}
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-red-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAction?.(q.paymentTransactionId, "cancel");
                                        }}
                                    >
                                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                                    </DropdownMenuItem>


                                </DropdownMenuContent>

                            </DropdownMenu>
                        )}
                        {!can?.("paymentTransactionUpdate") || !isPending && (
                            <span>-</span>
                        )}

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
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Company</div>
                            <div className="text-base text-gray-800 break-all">{q.companyName || q.company?.companyName || "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Payment Mode</div>
                            <div className="text-base text-gray-800 break-all">{q.paymentMode || "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Base Amount</div>
                            <div className="text-base text-gray-800 break-all">{q.baseAmount != null ? Number(q.baseAmount).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Narration</div>
                            <div className="text-base text-gray-800 break-all">{q.narration || "—"}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PaymentTransactionCard({ transaction: q, can, onView, onAction }) {
    const isPending = (q.status || "Pending") === "Pending";
    const fmtAmt = (n, code, sym) => {
        if (n == null) return "—";
        return `${code || ""} ${sym ? `(${sym})` : ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`.trim();
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div
                        className="text-base font-bold text-blue-600 truncate hover:text-blue-600 hover:underline cursor-pointer"
                        onClick={() => onView?.(q.paymentTransactionId)}
                    >
                        {q.paymentCode || "-"}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5 truncate">{q.narration || "-"}</div>
                </div>
                {can?.("paymentTransactionUpdate") && isPending && (

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <span
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs"
                            >
                                Actions <ChevronDown className="h-4 w-4 text-gray-500" />
                            </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg rounded-xl">
                            {/* <DropdownMenuItem
                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                onView?.(q.paymentTransactionId);
                            }}
                        >
                            View Details
                        </DropdownMenuItem> */}

                            <DropdownMenuItem
                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-emerald-600"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction?.(q.paymentTransactionId, "approve");
                                }}
                            >
                                <CheckCircle className="mr-2 h-4 w-4" /> Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-red-600"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction?.(q.paymentTransactionId, "cancel");
                                }}
                            >
                                <XCircle className="mr-2 h-4 w-4" /> Cancel
                            </DropdownMenuItem>


                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            <div className="px-5 py-4 flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="col-span-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Customer</div>
                        <div className="text-sm truncate">
                            <LinkedCustomerCell
                                customerId={q.customerId}
                                customerName={q.customerName || q.customer?.customerName}
                            />
                        </div>
                    </div>
                    <div className="col-span-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Bank Account</div>
                        <div className="text-sm truncate">
                            <LinkedBankBookCell
                                bankBookId={q.bankBookId}
                                bankBookName={q.bankBookName || q.bankBook?.bankBookName}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Amount</div>
                        <div className="text-sm font-semibold text-gray-800">
                            {fmtAmt(q.transactionAmount, q.currencyCode || q.currency?.code, q.currencySymbol || q.currency?.symbol)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Date</div>
                        <div className="text-sm text-gray-800">{formatDate(q.paymentDate)}</div>
                    </div>
                </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-50 bg-gray-50/50 rounded-b-2xl">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Status</span>
                    <PaymentTransactionStatusBadge status={q.status} />
                </div>
            </div>
        </div>
    );
}
