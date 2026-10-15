"use client";
import Link from "next/link";

import { useContext, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import Header from "../Header";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import AppPagination from "../ui/AppPagination";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import CustomerUpdate from "./CustomerUpdate";
import UserSidePanel from "../user/UserSidePanel";
import { useSearchParams } from "next/navigation";
import TabFilterPanel from "../common/TabFilterPanel";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";

import OrderSidePanel from "../order/OrderSidePanel";
import QuotationSidePanel from "../quotation/QuotationSidePanel";
import InvoiceSidePanel from "../invoice/InvoiceSidePanel";
import DetailsSidePanel from "../DetailsSidePanel";
import { creditNoteSidePanelConfig } from "../creditNote/configs/creditNoteSidePanel.config";
import { debitNoteSidePanelConfig } from "../debitNote/configs/debitNoteSidePanel.config";
import { paymentTransactionSidePanelConfig } from "../paymentTransaction/configs/paymentTransactionSidePanelConfig";

function formatDate(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

function formatDateOnly(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function statusBadge(status) {
    const s = String(status).toLowerCase();
    if (s === "active") return "inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
    if (s === "inactive") return "inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
    return "inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700";
}

function fmtAmount(amount, symbol) {
    if (amount == null) return "-";
    const val = Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return symbol ? `${symbol} ${val}` : val;
}

const ORDER_FILTER_FIELDS = [
    { id: "orderCode", label: "Order Code" },
    {
        id: "status",
        label: "Status",
        options: [
            { value: "", label: "All Statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "PLACED", label: "Placed" },
            { value: "DELIVERED", label: "Delivered" },
            { value: "PARTIAL_DELIVERED", label: "Partial Delivered" },
            { value: "CLOSED", label: "Closed" },
        ],
    },
];

const QUOTATION_FILTER_FIELDS = [
    { id: "quotationCode", label: "Quotation Code" },
    {
        id: "status",
        label: "Status",
        options: [
            { value: "", label: "All Statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "SUBMITTED", label: "Submitted" },
            { value: "CONFIRMED", label: "Confirmed" },
            { value: "CLOSED", label: "Closed" },
            { value: "CANCELLED", label: "Cancelled" },
            { value: "EXPIRED", label: "Expired" },
        ],
    },
];

const INVOICE_FILTER_FIELDS = [
    { id: "invoiceCode", label: "Invoice Code" },
    {
        id: "status",
        label: "Status",
        options: [
            { value: "", label: "All Statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "UNPAID", label: "Unpaid" },
            { value: "PARTIALLY_PAID", label: "Partially Paid" },
            { value: "PAID", label: "Paid" },
        ],
    },
];

const PAYMENT_FILTER_FIELDS = [
    { id: "paymentCode", label: "Payment Code" },
    { id: "narration", label: "Narration" },
    { id: "bankBookName", label: "Bank Account" },
    { id: "paymentMode", label: "Payment Mode" },
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

const CREDIT_NOTE_FILTER_FIELDS = [
    { id: "creditNoteCode", label: "Credit Note Code" },
    { id: "invoiceCode", label: "Invoice Code" },
    {
        id: "status",
        label: "Status",
        options: [
            { value: "", label: "All Statuses" },
            { value: "SUBMITTED", label: "Submitted" },
        ],
    },
];

const DEBIT_NOTE_FILTER_FIELDS = [
    { id: "debitNoteCode", label: "Debit Note Code" },
    { id: "invoiceCode", label: "Invoice Code" },
    {
        id: "status",
        label: "Status",
        options: [
            { value: "", label: "All Statuses" },
            { value: "SUBMITTED", label: "Submitted" },
        ],
    },
];

function EmbeddedTable({ endpoint, module, customerId, columns, renderRow, emptyMessage, fieldsConfig = [], sidebarHeight, isLg }) {
    const [data, setData] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    const initialFilters = useMemo(() => {
        const obj = {};
        (fieldsConfig || []).forEach((f) => {
            obj[f.id] = "";
        });
        return obj;
    }, [fieldsConfig]);

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
        (fieldsConfig || []).forEach((f) => {
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
        const fetchData = async () => {
            setIsFetching(true);
            try {
                const apiFilters = [
                    { key: "customerId", value: customerId, operator: "eq" }
                ];

                for (const key in debouncedFilters) {
                    const val = debouncedFilters[key];
                    if (val && typeof val === "string" && val.trim() !== "") {
                        apiFilters.push({
                            key,
                            operator: "contains",
                            value: val.trim(),
                        });
                    }
                }

                const res = await fetch("/relayapi", {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        endpoint,
                        module,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        filters: apiFilters,
                        condition: "All",
                        limit,
                        page,
                    }),
                });
                const payload = await res.json();
                const json = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const records = json.data || [];
                const total = Number(json.total ?? records.length ?? 0);

                if (page > 1 && records.length === 0) {
                    setPage((prev) => Math.max(1, prev - 1));
                    return;
                }

                setData(records);
                setTotalRecords(total);
                setTotalPages(Math.ceil(total / limit) || 1);
            } catch (err) {
                console.error(err);
                setData([]);
                setTotalRecords(0);
                setTotalPages(1);
            } finally {
                setInitialLoading(false);
                setIsFetching(false);
            }
        };

        if (customerId) fetchData();
    }, [customerId, endpoint, module, debouncedFilters, page, limit]);

    const containerStyle = useMemo(() => {
        if (isLg && sidebarHeight) {
            return {
                height: `${sidebarHeight}px`,
                maxHeight: `${sidebarHeight}px`,
            };
        }
        return undefined;
    }, [isLg, sidebarHeight]);

    return (
        <div
            style={containerStyle}
            className="w-full rounded-2xl bg-white shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[70vh] lg:h-full max-h-[70vh] lg:max-h-none"
        >
            <div className="flex-shrink-0 px-5 py-3 border-b border-gray-100 flex items-center justify-end bg-white">
                <button
                    type="button"
                    onClick={() => setIsFilterOpen((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition shadow-sm cursor-pointer ${hasActiveFilters
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

            {initialLoading ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center">
                    <Loader label="Loading..." />
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
                        {emptyMessage}
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
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                {columns.map((c, i) => (
                                    <th key={i} className="px-6 py-4 bg-gray-50">{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {data.map(renderRow)}
                        </tbody>
                    </table>
                </div>
            )}

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

            <TabFilterPanel
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                fieldsConfig={fieldsConfig}
                filters={filterValues}
                onChange={handleFilterChange}
                onReset={handleReset}
            />
        </div>
    );
}

export default function CustomerDetails({ id }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { can, displayUser, activeAssignment } = useContext(loginContext) || {};
    const isSuperAdmin = displayUser?.primaryProfile?.groupCode === "admin" || activeAssignment?.groupCode === "admin";
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEdit, setShowEdit] = useState(false);
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);
    const [activeTab, setActiveTab] = useState("summary");
    const [sidePanel, setSidePanel] = useState(null);

    const sidebarRef = useRef(null);
    const [sidebarHeight, setSidebarHeight] = useState(null);
    const [isLg, setIsLg] = useState(false);

    useEffect(() => {
        const checkLg = () => {
            setIsLg(window.innerWidth >= 1024);
        };
        checkLg();
        window.addEventListener("resize", checkLg);
        return () => window.removeEventListener("resize", checkLg);
    }, []);

    useEffect(() => {
        const el = sidebarRef.current;
        if (!el) return;

        const updateHeight = () => {
            if (el) {
                const h = el.offsetHeight;
                if (h > 0) setSidebarHeight(h);
            }
        };

        updateHeight();

        let ro = null;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(() => {
                updateHeight();
            });
            ro.observe(el);
        }

        return () => {
            if (ro) ro.disconnect();
        };
    }, [customer, activeTab]);

    useEffect(() => {
        if (searchParams && searchParams.get("edit") === "true") {
            setShowEdit(true);
        }
    }, [searchParams]);

    useEffect(() => {
        fetchCustomer();
    }, [id]);

    const handleEditClose = () => {
        setShowEdit(false);
        fetchCustomer();
    };

    const fetchCustomer = async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `customer-details/${id}`,
                    module: "customer",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setCustomer(data?.customerId ? data : null);
            console.log(data, "coantg")
        } catch (err) {
            console.error(err);
            setCustomer(null);
        } finally {
            setLoading(false);
        }
    };

    const gotoPages = (e, url) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(url);
    };

    if (showEdit) {
        return <CustomerUpdate id={id} onBack={handleEditClose} />;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="customer-details" />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading customer details..." />
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="customer-details" />
                <div className="p-8 text-red-500 text-lg font-semibold">
                    Customer not found.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page="customer-details" />

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 pb-20">
                <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600 hover:underline">
                        Home
                    </Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/customer-list" className="cursor-pointer hover:text-blue-600 hover:underline">
                        Customers
                    </Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Details</span>
                </nav>

                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">
                        Details
                    </h1>
                    <div className="flex items-center gap-4">
                        {can("customerUpdate") && (
                            <button
                                id="edit-customer-btn"
                                className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-8 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 active:scale-[0.98] cursor-pointer"
                                onClick={() => setShowEdit(true)}
                            >
                                Edit
                            </button>
                        )}
                        <button
                            className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-8 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 active:scale-[0.98] cursor-pointer"
                            onClick={() => router.back()}
                        >
                            Back
                        </button>
                    </div>
                </div>

                <div className={`grid grid-cols-12 gap-6 ${activeTab === "summary" ? "" : "items-start"}`}>
                    <div className="col-span-12 lg:col-span-3">
                        <div ref={sidebarRef} className="rounded-2xl bg-white p-5 shadow-sm">
                            <div className="border-b pb-5 flex flex-col items-center text-center">
                                {customer.customerLogo ? (
                                    <div className="h-24 w-24 rounded-full overflow-hidden mb-3 border shadow-sm">
                                        <img
                                            src={`http://localhost:4000/upload/customer/${customer.customerId}/${customer.customerLogo}`}
                                            alt={customer.customerName}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="h-24 w-24 rounded-full bg-blue-50 text-blue-600 font-bold text-2xl flex items-center justify-center mb-3 shadow-inner">
                                        {customer.customerCode?.substring(0, 2) || "CU"}
                                    </div>
                                )}
                                <h2 className="text-xl font-semibold text-gray-800">
                                    {customer.customerName || "N/A"}
                                </h2>
                                <p className="text-sm font-mono text-gray-400 mt-1">
                                    {customer.customerCode || "N/A"}
                                </p>
                            </div>
                            <div className="mt-6 space-y-3">
                                {[
                                    { key: "summary", label: "Summary", show: true },
                                    { key: "orders", label: "Orders", show: can("orderList") || isSuperAdmin },
                                    { key: "quotations", label: "Quotations", show: can("quotationList") || isSuperAdmin },
                                    { key: "payments", label: "Payments", show: can("paymentTransactionList") || isSuperAdmin },
                                    { key: "invoices", label: "Invoices", show: can("invoiceList") || isSuperAdmin },
                                    { key: "credit-notes", label: "Credit Notes", show: can("creditNoteList") || isSuperAdmin },
                                    { key: "debit-notes", label: "Debit Notes", show: can("debitNoteList") || isSuperAdmin },
                                ]
                                    .filter(t => t.show)
                                    .map(({ key, label }) => (
                                        <button
                                            key={key}
                                            onClick={() => setActiveTab(key)}
                                            className={`w-full rounded-xl px-4 py-3 text-left font-medium transition ${activeTab === key ? "bg-gray-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>

                    <div className={`col-span-12 lg:col-span-9 ${activeTab === "summary" ? "space-y-6" : ""}`}>
                        {activeTab === "summary" && (
                            <div className="grid gap-6 lg:grid-cols-2">
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-4 border-b pb-5">
                                        <div>
                                            <div className="text-[#888888] font-bold text-base">
                                                Customer Information
                                            </div>
                                            <div className="mt-2 text-2xl font-extrabold text-blue-600">
                                                {customer.customerName || "N/A"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                        <div>
                                            <div className="text-sm text-gray-500">Customer Code</div>
                                            <div className="text-[#101010] font-bold text-[#374151] mt-1 font-mono">
                                                {customer.customerCode || "-"}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">Email</div>
                                            <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                {customer.customerEmail || "-"}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">Phone</div>
                                            <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                {customer.phone ? `${customer.dialCode ? `+${customer.dialCode} ` : ""}${customer.phone}` : "-"}
                                            </div>
                                        </div>
                                        {isSuperAdmin && (
                                            <div>
                                                <div className="text-sm text-gray-500">Company</div>
                                                <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                    <LinkedCompanyCell
                                                        companyId={customer.companyId}
                                                        companyName={customer.companyName || customer.company?.companyName}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-sm text-gray-500">Incorporation Date</div>
                                            <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                {formatDateOnly(customer.customerIncorporationDate)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">Location</div>
                                            <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                {`${customer.city ? `${customer.city}, ` : ""}${customer.state || ""}, ${customer.country || ""}`}
                                            </div>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <div className="text-sm text-gray-500">Address Line 1</div>
                                            <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                {customer.AddressLineOne || "-"}
                                            </div>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <div className="text-sm text-gray-500 mb-1">Currencies</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {customer.currencies?.length > 0 ? (
                                                    customer.currencies.map((curr) => (
                                                        <span
                                                            key={curr.curId}
                                                            className="inline-block rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200"
                                                        >
                                                            ({curr.code}) {curr.symbol}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-400 text-sm">-</span>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">Status</div>
                                            <div className="mt-1">
                                                <span className={statusBadge(customer.status)}>
                                                    {customer.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="rounded-2xl bg-white p-6 shadow-sm">
                                        <div className="border-b pb-5">
                                            <div className="text-[#888888] font-bold text-base">
                                                Owner Information
                                            </div>
                                        </div>
                                        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                            <div>
                                                <div className="text-sm text-gray-500">Owner Name</div>
                                                <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                    {`${customer.ownerFirstName || ""} ${customer.ownerLastName || ""}`.trim() || "-"}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500">Owner Email</div>
                                                <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                    {customer.ownerEmail || "-"}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500">Owner Phone</div>
                                                <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                    {customer.ownerPhone ? `${customer.ownerDialCode ? `+${customer.ownerDialCode} ` : ""}${customer.ownerPhone}` : "-"}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500">Owner DOB</div>
                                                <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                                    {formatDateOnly(customer.ownerDob)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-white p-6 shadow-sm">
                                        <div className="border-b pb-5">
                                            <div className="text-[#888888] font-bold text-base">
                                                Audit Logs
                                            </div>
                                        </div>
                                        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                            <div>
                                                <div className="text-sm text-gray-500">Added By</div>
                                                <div className="mt-1 text-sm font-semibold text-gray-800">
                                                    {customer.addedByName ? (
                                                        <span
                                                            className="text-blue-600 cursor-pointer hover:underline"
                                                            onClick={() => setSelectedUserPanelId(customer.addedBy)}
                                                        >
                                                            {customer.addedByName}
                                                        </span>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500">Created Date</div>
                                                <div className="mt-1 text-sm font-semibold text-gray-800">
                                                    {formatDate(customer.createdDate)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500">Updated By</div>
                                                <div className="mt-1 text-sm font-semibold text-gray-800">
                                                    {customer.updatedByName ? (
                                                        <span
                                                            className="text-blue-600 cursor-pointer hover:underline"
                                                            onClick={() => setSelectedUserPanelId(customer.updatedBy)}
                                                        >
                                                            {customer.updatedByName}
                                                        </span>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500">Updated Date</div>
                                                <div className="mt-1 text-sm font-semibold text-gray-800">
                                                    {formatDate(customer.updatedDate)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === "orders" && (
                            <EmbeddedTable
                                endpoint="order-list"
                                module="order"
                                customerId={customer.customerId}
                                emptyMessage="No orders found for this customer."
                                columns={["Order Code", "Order Date", "Final Amount", "Status"]}
                                fieldsConfig={ORDER_FILTER_FIELDS}
                                sidebarHeight={sidebarHeight}
                                isLg={isLg}
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSidePanel({ type: "order", id: q.orderId })}>
                                        <td className="px-6 py-4 font-medium text-blue-600">{q.orderCode || "-"}</td>
                                        <td className="px-6 py-4">{formatDateOnly(q.orderDate)}</td>
                                        <td className="px-6 py-4">{fmtAmount(q.finalAmount, q.currency?.symbol ?? q.currencyCode)}</td>
                                        <td className="px-6 py-4">
                                            <span className={statusBadge(q.status)}>{q.status || "-"}</span>
                                        </td>
                                    </tr>
                                )}
                            />
                        )}
                        {activeTab === "quotations" && (
                            <EmbeddedTable
                                endpoint="quotation-list"
                                module="quotation"
                                customerId={customer.customerId}
                                emptyMessage="No quotations found for this customer."
                                columns={["Quotation Code", "Quotation Date", "Final Amount", "Status"]}
                                fieldsConfig={QUOTATION_FILTER_FIELDS}
                                sidebarHeight={sidebarHeight}
                                isLg={isLg}
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSidePanel({ type: "quotation", id: q.quotationId })}>
                                        <td className="px-6 py-4 font-medium text-blue-600">{q.quotationCode || "-"}</td>
                                        <td className="px-6 py-4">{formatDateOnly(q.quotationDate)}</td>
                                        <td className="px-6 py-4">{fmtAmount(q.finalAmount, q.currency?.symbol ?? q.currencyCode)}</td>
                                        <td className="px-6 py-4">
                                            <span className={statusBadge(q.status)}>{q.status || "-"}</span>
                                        </td>
                                    </tr>
                                )}
                            />
                        )}
                        {activeTab === "payments" && (
                            <EmbeddedTable
                                endpoint="payment-transaction-list"
                                module="payment-transaction"
                                customerId={customer.customerId}
                                emptyMessage="No payment transactions found for this customer."
                                columns={["Payment Code", "Payment Date", "Amount", "Status"]}
                                fieldsConfig={PAYMENT_FILTER_FIELDS}
                                sidebarHeight={sidebarHeight}
                                isLg={isLg}
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSidePanel({ type: "payment", id: q.paymentTransactionId })}>
                                        <td className="px-6 py-4 font-medium text-blue-600">{q.paymentCode || "-"}</td>
                                        <td className="px-6 py-4">{formatDateOnly(q.paymentDate)}</td>
                                        <td className="px-6 py-4">{fmtAmount(q.transactionAmount, q.currency?.symbol ?? q.currencyCode)}</td>
                                        <td className="px-6 py-4">
                                            <span className={statusBadge(q.status)}>{q.status || "-"}</span>
                                        </td>
                                    </tr>
                                )}
                            />
                        )}
                        {activeTab === "invoices" && (
                            <EmbeddedTable
                                endpoint="invoice-list"
                                module="invoice"
                                customerId={customer.customerId}
                                emptyMessage="No invoices found for this customer."
                                columns={["Invoice Code", "Invoice Date", "Final Amount", "Status"]}
                                fieldsConfig={INVOICE_FILTER_FIELDS}
                                sidebarHeight={sidebarHeight}
                                isLg={isLg}
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSidePanel({ type: "invoice", id: q.invoiceId })}>
                                        <td className="px-6 py-4 font-medium text-blue-600">{q.invoiceCode || "-"}</td>
                                        <td className="px-6 py-4">{formatDateOnly(q.invoiceDate)}</td>
                                        <td className="px-6 py-4">{fmtAmount(q.finalAmount, q.currency?.symbol ?? q.currencyCode)}</td>
                                        <td className="px-6 py-4">
                                            <span className={statusBadge(q.status)}>{q.status || "-"}</span>
                                        </td>
                                    </tr>
                                )}
                            />
                        )}
                        {activeTab === "credit-notes" && (
                            <EmbeddedTable
                                endpoint="credit-note-list"
                                module="credit-note"
                                customerId={customer.customerId}
                                emptyMessage="No credit notes found for this customer."
                                columns={["Credit Note Code", "Date", "Final Amount", "Status"]}
                                fieldsConfig={CREDIT_NOTE_FILTER_FIELDS}
                                sidebarHeight={sidebarHeight}
                                isLg={isLg}
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSidePanel({ type: "creditNote", id: q.id })}>
                                        <td className="px-6 py-4 font-medium text-blue-600">{q.creditNoteCode || "-"}</td>
                                        <td className="px-6 py-4">{formatDateOnly(q.addedDate)}</td>
                                        <td className="px-6 py-4">{fmtAmount(q.finalAmount, q.currency?.symbol ?? q.currencyCode)}</td>
                                        <td className="px-6 py-4">
                                            <span className={statusBadge(q.status)}>{q.status || "-"}</span>
                                        </td>
                                    </tr>
                                )}
                            />
                        )}
                        {activeTab === "debit-notes" && (
                            <EmbeddedTable
                                endpoint="debit-note-list"
                                module="debit-note"
                                customerId={customer.customerId}
                                emptyMessage="No debit notes found for this customer."
                                columns={["Debit Note Code", "Date", "Final Amount", "Status"]}
                                fieldsConfig={DEBIT_NOTE_FILTER_FIELDS}
                                sidebarHeight={sidebarHeight}
                                isLg={isLg}
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSidePanel({ type: "debitNote", id: q.id })}>
                                        <td className="px-6 py-4 font-medium text-blue-600">{q.debitNoteCode || "-"}</td>
                                        <td className="px-6 py-4">{formatDateOnly(q.addedDate)}</td>
                                        <td className="px-6 py-4">{fmtAmount(q.finalAmount, q.currency?.symbol ?? q.currencyCode)}</td>
                                        <td className="px-6 py-4">
                                            <span className={statusBadge(q.status)}>{q.status || "-"}</span>
                                        </td>
                                    </tr>
                                )}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* User detail side panel */}
            {selectedUserPanelId &&
                typeof document !== "undefined" &&
                createPortal(
                    <UserSidePanel
                        userId={selectedUserPanelId}
                        onClose={() => setSelectedUserPanelId(null)}
                    />,
                    document.body
                )}

            {sidePanel?.type === "order" && typeof document !== "undefined" && createPortal(
                <OrderSidePanel id={sidePanel.id} onClose={() => setSidePanel(null)} />,
                document.body
            )}
            {sidePanel?.type === "quotation" && typeof document !== "undefined" && createPortal(
                <QuotationSidePanel id={sidePanel.id} onClose={() => setSidePanel(null)} />,
                document.body
            )}
            {sidePanel?.type === "invoice" && typeof document !== "undefined" && createPortal(
                <InvoiceSidePanel invoiceId={sidePanel.id} onClose={() => setSidePanel(null)} />,
                document.body
            )}
            {sidePanel?.type === "creditNote" && typeof document !== "undefined" && createPortal(
                <DetailsSidePanel config={creditNoteSidePanelConfig} id={sidePanel.id} onClose={() => setSidePanel(null)} />,
                document.body
            )}
            {sidePanel?.type === "debitNote" && typeof document !== "undefined" && createPortal(
                <DetailsSidePanel config={debitNoteSidePanelConfig} id={sidePanel.id} onClose={() => setSidePanel(null)} />,
                document.body
            )}
            {sidePanel?.type === "payment" && typeof document !== "undefined" && createPortal(
                <DetailsSidePanel config={paymentTransactionSidePanelConfig} id={sidePanel.id} onClose={() => setSidePanel(null)} />,
                document.body
            )}
        </div>
    );
}
