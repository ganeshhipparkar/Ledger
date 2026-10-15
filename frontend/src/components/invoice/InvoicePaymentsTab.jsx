"use client";
import React, { useEffect, useState, useContext, useMemo, useRef } from "react";
import { loginContext } from "../hooks/LoginContext";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import Loader from "../ui/Loader";
import AppPagination from "../ui/AppPagination";
import TabFilterPanel from "../common/TabFilterPanel";
import { limitPriceDecimals } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";

function PaymentTransactionStatusBadge({ status }) {
    let badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    if (status === "Approved") badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "Cancelled") badgeClass = "bg-red-50 text-red-700 border-red-200";

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
            {status || "Pending"}
        </span>
    );
}

const PAYMENT_FILTER_FIELDS = [
    { id: "paymentCode", label: "Payment Code" },
    {
        id: "paymentMode",
        label: "Mode",
        options: [
            { value: "", label: "All Modes" },
            { value: "Cash", label: "Cash" },
            { value: "Credit Card", label: "Credit Card" },
            { value: "Debit Card", label: "Debit Card" },
            { value: "Digital Wallet", label: "Digital Wallet" },
            { value: "Bank Transfer", label: "Bank Transfer" },
            { value: "UPI", label: "UPI" },
            { value: "Buy Now Pay Later", label: "Buy Now Pay Later" },
        ],
    },
    {
        id: "status",
        label: "Status",
        options: [
            { value: "", label: "All Statuses" },
            { value: "Pending", label: "Pending" },
            { value: "Approved", label: "Approved" },
            { value: "Cancelled", label: "Cancelled" },
        ],
    },
];

export default function InvoicePaymentsTab({ invoiceId, refreshKey, onSelectPayment }) {
    const { can, displayUser } = useContext(loginContext) || {};
    const [data, setData] = useState([]);
    const [totalApplied, setTotalApplied] = useState(0);
    const [finalAmount, setFinalAmount] = useState(0);
    const [currencySymbol, setCurrencySymbol] = useState("");
    const [initialLoading, setInitialLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [error, setError] = useState("");

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    const initialFilters = useMemo(() => {
        const obj = {};
        PAYMENT_FILTER_FIELDS.forEach((f) => {
            obj[f.id] = "";
        });
        return obj;
    }, []);

    const [filterValues, setFilterValues] = useState(initialFilters);
    const [debouncedFilters, setDebouncedFilters] = useState(initialFilters);
    const debounceRef = useRef(null);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const handleFilterChange = (key, value) => {
        setPage(1);
        setFilterValues((prev) => {
            const next = { ...prev, [key]: value };
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                setDebouncedFilters(next);
            }, 400);
            return next;
        });
    };

    const handleReset = () => {
        setPage(1);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const obj = {};
        PAYMENT_FILTER_FIELDS.forEach((f) => {
            obj[f.id] = "";
        });
        setFilterValues(obj);
        setDebouncedFilters(obj);
    };

    const handleLimitChange = (e) => {
        const newLimit = Number(e.target.value);
        setLimit(newLimit);
        setPage(1);
    };

    const hasActiveFilters = useMemo(() => {
        return (
            Object.values(filterValues).some((v) => typeof v === "string" && v.trim() !== "") ||
            Object.values(debouncedFilters).some((v) => typeof v === "string" && v.trim() !== "")
        );
    }, [filterValues, debouncedFilters]);

    useEffect(() => {
        if (!invoiceId) return;

        const fetchPayments = async () => {
            setIsFetching(true);
            setError("");
            try {
                const apiFilters = [];
                for (const key in debouncedFilters) {
                    const val = debouncedFilters[key];
                    if (val && typeof val === "string" && val.trim() !== "") {
                        apiFilters.push({
                            key,
                            operator: key === "status" || key === "paymentMode" ? "eq" : "contains",
                            value: val.trim(),
                        });
                    }
                }

                const response = await fetch("/relayapi", {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        endpoint: `invoice-payments/${invoiceId}`,
                        module: "invoice",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        filters: apiFilters,
                        limit,
                        page,
                    }),
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch payments");
                }
                const payload = await response.json();
                const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (result.success === 1) {
                    const records = result.data || [];
                    const total = Number(result.total ?? records.length ?? 0);

                    if (page > 1 && records.length === 0) {
                        setPage((prev) => Math.max(1, prev - 1));
                        return;
                    }

                    setData(records);
                    setTotalRecords(total);
                    setTotalPages(Math.ceil(total / limit) || 1);
                    setTotalApplied(result.totalApplied || 0);
                    setFinalAmount(result.finalAmount || 0);
                    setCurrencySymbol(result.currencySymbol || result.currencyCode || "");
                } else {
                    setError(result.message || "Failed to load payments");
                    setData([]);
                    setTotalRecords(0);
                    setTotalPages(1);
                }
            } catch (err) {
                setError(err.message);
                setData([]);
                setTotalRecords(0);
                setTotalPages(1);
            } finally {
                setInitialLoading(false);
                setIsFetching(false);
            }
        };

        fetchPayments();
    }, [invoiceId, refreshKey, debouncedFilters, page, limit]);

    if (error && initialLoading) {
        return <div className="p-6 text-red-500">{error}</div>;
    }

    return (
        <div className="flex flex-col h-[70vh] max-h-[70vh] lg:h-[calc(100vh-270px)] lg:max-h-[calc(100vh-270px)] min-h-[420px] gap-4">
            {/* Totals pinned above the table card */}
            <div className="shrink-0 rounded-2xl bg-white p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-base font-bold text-gray-800">
                    Payments Applied
                </h3>
                <div className="text-sm">
                    <span className="text-gray-500">Total Paid: </span>
                    <span className="font-bold text-green-600">
                        {currencySymbol} {Number(limitPriceDecimals(totalApplied)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="mx-2 text-gray-300">/</span>
                    <span className="text-gray-500">Invoice Total: </span>
                    <span className="font-bold text-gray-800">
                        {currencySymbol} {Number(limitPriceDecimals(finalAmount)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* List block card */}
            <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                {/* Pinned Toolbar at top */}
                <div className="flex-shrink-0 px-5 py-3 border-b border-gray-100 flex items-center justify-end bg-white">
                    <button
                        type="button"
                        onClick={() => setIsFilterOpen((prev) => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition shadow-sm cursor-pointer ${
                            hasActiveFilters
                                ? "border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-500/20"
                                : isFilterOpen
                                    ? "border-blue-400 bg-blue-50 text-blue-600"
                                    : "border-gray-200 bg-white text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                        title="Filters"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2z" />
                        </svg>
                        <span>Filters</span>
                        {hasActiveFilters && (
                            <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
                        )}
                    </button>
                </div>

                {/* Middle: Scrollable table rows or Loading / Empty state */}
                {initialLoading ? (
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center">
                        <Loader label="Loading payments..." />
                    </div>
                ) : data.length === 0 ? (
                    hasActiveFilters ? (
                        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center">
                            <p className="text-gray-700 font-semibold text-base">No results match your filters</p>
                            <p className="text-gray-400 text-sm mt-1">Try clearing or adjusting your filters to find what you are looking for.</p>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="mt-4 inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 cursor-pointer transition"
                            >
                                Reset Filters
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center text-gray-500">
                            No payments applied for this invoice.
                        </div>
                    )
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative max-h-full">
                        {isFetching && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center transition-opacity">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm border border-gray-200 text-xs font-medium text-gray-600">
                                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                                    <span>Loading...</span>
                                </div>
                            </div>
                        )}
                        <table className="min-w-full text-sm text-left">
                            <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 text-xs uppercase font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 bg-gray-50">Payment Code</th>
                                    <th className="px-4 py-3 bg-gray-50">Payment Date</th>
                                    <th className="px-4 py-3 bg-gray-50">Mode</th>
                                    <th className="px-4 py-3 bg-gray-50">Payment Amount</th>
                                    <th className="px-4 py-3 bg-gray-50">Applied to Invoice</th>
                                    <th className="px-4 py-3 bg-gray-50">Applied On</th>
                                    <th className="px-4 py-3 bg-gray-50">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.map((pay) => (
                                    <tr 
                                        key={pay.paymentTransactionId} 
                                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        onClick={() => onSelectPayment && onSelectPayment(pay.paymentTransactionId)}
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {(can && can("paymentTransactionView")) || displayUser?.isSuperAdmin ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onSelectPayment) onSelectPayment(pay.paymentTransactionId);
                                                    }}
                                                    className="text-blue-600 hover:underline bg-transparent border-none p-0 text-left cursor-pointer"
                                                >
                                                    {pay.paymentCode}
                                                </button>
                                            ) : (
                                                pay.paymentCode
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {new Date(pay.paymentDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {pay.paymentMode}
                                        </td>
                                        <td className="px-4 py-3 font-mono">
                                            {Number(limitPriceDecimals(pay.transactionAmount)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-gray-600 font-medium">
                                            {Number(limitPriceDecimals(pay.amountApplied)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {new Date(pay.appliedDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <PaymentTransactionStatusBadge status={pay.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pinned Pagination at the bottom */}
                {totalRecords > 0 && (
                    <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-3 border-t border-gray-100 bg-white">
                        <p className="text-sm text-gray-500">
                            {`Viewing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalRecords)} of ${totalRecords}`}
                        </p>
                        <div className="flex items-center gap-3">
                            <AppPagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={(p) => setPage(p)}
                            />
                            <select
                                value={limit}
                                onChange={handleLimitChange}
                                className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 outline-none focus:border-blue-500 cursor-pointer"
                            >
                                {PAGE_SIZE_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            <TabFilterPanel
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                fieldsConfig={PAYMENT_FILTER_FIELDS}
                filters={filterValues}
                onChange={handleFilterChange}
                onReset={handleReset}
            />
        </div>
    );
}
