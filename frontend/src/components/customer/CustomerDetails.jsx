"use client";
import Link from "next/link";

import { useContext, useEffect, useRef, useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import Header from "../Header";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import AppPagination from "../ui/AppPagination";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import CustomerFormPage from "./CustomerFormPage";
import UserSidePanel from "../user/UserSidePanel";
import { useSearchParams } from "next/navigation";
import TabFilterPanel from "../common/TabFilterPanel";
import EmbeddedTable from "../common/EmbeddedRelatedTable";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";

import OrderSidePanel from "../order/OrderSidePanel";
import QuotationSidePanel from "../quotation/QuotationSidePanel";
import InvoiceSidePanel from "../invoice/InvoiceSidePanel";
import DetailsSidePanel from "../DetailsSidePanel";
import NoteAddPanel from "../notes/NoteAddPanel";
import { creditNoteSidePanelConfig } from "../creditNote/configs/creditNoteSidePanel.config";
import { debitNoteSidePanelConfig } from "../debitNote/configs/debitNoteSidePanel.config";
import { paymentTransactionSidePanelConfig } from "../paymentTransaction/configs/paymentTransactionSidePanelConfig";
import { deliveryNoteSidePanelConfig } from "../deliveryNote/configs/deliveryNoteSidePanel.config";
import { handleCreditNoteAddNavigation } from "@/lib/useCreditNoteNavigation";
import { handleDebitNoteAddNavigation } from "@/lib/useDebitNoteNavigation";
import { getCreditNoteMode } from "@/lib/creditNoteMode";

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

const DELIVERY_NOTE_FILTER_FIELDS = [
    { id: "deliveryNoteCode", label: "Delivery Note Code" },
    { id: "orderCode", label: "Order Number" },
    { id: "receiverName", label: "Receiver Name" },
    { id: "deliveryDate", label: "Delivery Date", type: "date", operator: "eq" },
];

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
    const [addNoteType, setAddNoteType] = useState(null);
    const [noteRefreshKey, setNoteRefreshKey] = useState(0);

    const VALID_CUSTOMER_TABS = [
        "summary",
        "orders",
        "delivery-notes",
        "quotations",
        "payments",
        "invoices",
        "credit-notes",
        "debit-notes",
    ];

    useEffect(() => {
        const apply = () => {
            const h = window.location.hash.replace("#", "");
            if (VALID_CUSTOMER_TABS.includes(h)) {
                setActiveTab(h);
            }
        };
        apply();
        window.addEventListener("hashchange", apply);
        return () => window.removeEventListener("hashchange", apply);
    }, []);

    const changeTab = (key) => {
        setActiveTab(key);
        window.history.replaceState(null, "", `#${key}`);
    };

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

    const renderAddButton = (permission, label, target) => {
        if (!customer?.customerId || (!can?.(permission) && !isSuperAdmin)) return null;
        return (
            <button
                type="button"
                onClick={() => {
                    if (typeof target === "function") {
                        target();
                    } else {
                        router.push(target);
                    }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition cursor-pointer"
            >
                <Plus className="h-4 w-4" />
                <span>{label}</span>
            </button>
        );
    };

    if (showEdit) {
        return <CustomerFormPage context="customer-update" id={id} onBack={handleEditClose} />;
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
                                    { key: "delivery-notes", label: "Delivery Notes", show: can("deliveryNoteList") || isSuperAdmin },
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
                                            onClick={() => changeTab(key)}
                                            className={`w-full rounded-xl px-4 py-3 text-left font-medium transition cursor-pointer ${activeTab === key ? "bg-gray-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
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
                                toolbarActions={renderAddButton("orderAdd", "Add Order", `/add-order?customerId=${customer.customerId}`)}
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
                        {activeTab === "delivery-notes" && (
                            <EmbeddedTable
                                endpoint="delivery-note-list"
                                module="delivery-note"
                                customerId={customer.customerId}
                                emptyMessage="No delivery notes for this customer."
                                columns={["Delivery Note Code", "Order Number", "Delivery Date", "Receiver Name", "Added By", "Added Date"]}
                                fieldsConfig={DELIVERY_NOTE_FILTER_FIELDS}
                                sidebarHeight={sidebarHeight}
                                isLg={isLg}
                                toolbarActions={renderAddButton("deliveryNoteAdd", "Add Delivery Note", `/add-delivery-note?customerId=${customer.customerId}`)}
                                renderRow={(q, i) => (
                                    <tr
                                        key={i}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => setSidePanel({ type: "deliveryNote", id: q.deliveryNoteId })}
                                    >
                                        <td className="px-6 py-4 font-medium text-blue-600">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSidePanel({ type: "deliveryNote", id: q.deliveryNoteId });
                                                }}
                                                className="font-medium text-blue-600 hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
                                            >
                                                {q.deliveryNoteCode || "-"}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{q.orderCode || "-"}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{formatDateOnly(q.deliveryDate)}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{q.receiverName || "-"}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{q.addedByName || "-"}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{formatDateOnly(q.addedDate)}</td>
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
                                toolbarActions={renderAddButton("quotationAdd", "Add Quotation", `/add-quotation?customerId=${customer.customerId}`)}
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
                                toolbarActions={renderAddButton("paymentTransactionAdd", "Add Payment", `/payment-transaction-add?customerId=${customer.customerId}`)}
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
                                toolbarActions={renderAddButton("invoiceAdd", "Add Invoice", `/add-invoice?customerId=${customer.customerId}`)}
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
                                refreshKey={noteRefreshKey}
                                toolbarActions={renderAddButton("creditNoteAdd", "Add Credit Note", () =>
                                    handleCreditNoteAddNavigation({
                                        router,
                                        setShowAddPanel: () => setAddNoteType("CREDIT"),
                                        customer,
                                    })
                                )}
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
                                refreshKey={noteRefreshKey}
                                toolbarActions={renderAddButton("debitNoteAdd", "Add Debit Note", () =>
                                    handleDebitNoteAddNavigation({
                                        router,
                                        setShowAddPanel: () => setAddNoteType("DEBIT"),
                                        customer,
                                    })
                                )}
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
            {sidePanel?.type === "deliveryNote" && typeof document !== "undefined" && createPortal(
                <DetailsSidePanel config={deliveryNoteSidePanelConfig} id={sidePanel.id} onClose={() => setSidePanel(null)} />,
                document.body
            )}

            {addNoteType && typeof document !== "undefined" && createPortal(
                <NoteAddPanel
                    noteType={addNoteType}
                    presetCustomerId={customer.customerId}
                    presetCustomerName={customer.customerName}
                    lockedCompanyId={customer.companyId}
                    onClose={() => setAddNoteType(null)}
                    onSuccess={() => {
                        setAddNoteType(null);
                        setNoteRefreshKey((prev) => prev + 1);
                    }}
                />,
                document.body
            )}
        </div>
    );
}
