"use client";
import Link from "next/link";

import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import Header from "../Header";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import CustomerUpdate from "./CustomerUpdate";
import UserSidePanel from "../user/UserSidePanel";
import { useSearchParams } from "next/navigation";

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

function EmbeddedTable({ endpoint, module, customerId, columns, renderRow, emptyMessage }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch("/relayapi", {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        endpoint,
                        module,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        filters: [{ key: "customerId", value: customerId, operator: "eq" }],
                        limit: 100,
                        page: 1
                    }),
                });
                const payload = await res.json();
                const json = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                setData(json.data || []);
            } catch (err) {
                console.error(err);
                setData([]);
            } finally {
                setLoading(false);
            }
        };
        if (customerId) fetchData();
    }, [customerId, endpoint, module]);

    if (loading) {
        return (
            <div className="rounded-2xl bg-white p-6 shadow-sm flex items-center justify-center py-10">
                <Loader label="Loading..." />
            </div>
        );
    }

    if (!data.length) {
        return (
            <div className="rounded-2xl bg-white p-6 shadow-sm text-center text-gray-500 py-10">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                        <tr>
                            {columns.map((c, i) => (
                                <th key={i} className="px-6 py-4">{c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                        {data.map(renderRow)}
                    </tbody>
                </table>
            </div>
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

                <div className="grid grid-cols-12 gap-6">
                    {/* Left sidebar */}
                    <div className="col-span-12 lg:col-span-3">
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
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
                                    { key: "summary", label: "Summary" },
                                    { key: "orders", label: "Orders" },
                                    { key: "quotations", label: "Quotations" },
                                    { key: "payments", label: "Payments" },
                                    { key: "invoices", label: "Invoices" },
                                ].map(({ key, label }) => (
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

                    {/* Right column */}
                    <div className="col-span-12 lg:col-span-9 space-y-6">
                        {activeTab === "summary" && (
                            <div className="grid gap-6 lg:grid-cols-2">
                            {/* Details card */}
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
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => router.push(`/order/${q.orderId}`)}>
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
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => router.push(`/quotation/${q.quotationId}`)}>
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
                                module="paymentTransaction"
                                customerId={customer.customerId}
                                emptyMessage="No payment transactions found for this customer."
                                columns={["Payment Code", "Payment Date", "Amount", "Status"]}
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => router.push(`/payment-transaction/${q.paymentTransactionId}`)}>
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
                                renderRow={(q, i) => (
                                    <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => router.push(`/invoice/${q.invoiceId}`)}>
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
        </div>
    );
}
