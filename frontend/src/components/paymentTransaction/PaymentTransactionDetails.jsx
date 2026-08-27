"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import Header from "../Header";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import PaymentTransactionFormSidePanel from "./PaymentTransactionFormSidePanel";
import { Paperclip } from "lucide-react";

function formatDate(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

export default function PaymentTransactionDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [transaction, setTransaction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditPanel, setShowEditPanel] = useState(false);

    useEffect(() => {
        fetchTransaction();
    }, [id]);

    const handleEditClose = () => {
        setShowEditPanel(false);
        fetchTransaction();
    };

    const fetchTransaction = async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `payment-transaction-details/${id}`,
                    module: "payment-transaction",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setTransaction(data?.paymentTransactionId ? data : null);
        } catch (err) {
            console.error(err);
            setTransaction(null);
        } finally {
            setLoading(false);
        }
    };

    const gotoPages = (e, url) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(url);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="payment-transaction-details" />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading payment transaction details..." />
                </div>
            </div>
        );
    }

    if (!transaction) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="payment-transaction-details" />
                <div className="p-8 text-red-500 text-lg font-semibold">
                    Payment transaction not found.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f6f8]">
            <Header page="payment-transaction-details" />

            <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
                {/* Navigation and actions bar */}
                <div className="flex items-center justify-between">
                    <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                        <span
                            className="cursor-pointer hover:text-blue-600 hover:underline"
                            onClick={(e) => gotoPages(e, "/")}
                        >
                            Home
                        </span>
                        <span className="text-gray-400">{">>"}</span>
                        <span
                            className="cursor-pointer hover:text-blue-600 hover:underline"
                            onClick={(e) => gotoPages(e, "/payment-transaction-list")}
                        >
                            Payment Transactions
                        </span>
                        <span className="text-gray-400">{">>"}</span>
                        <span className="text-gray-800 font-semibold">
                            {transaction.narration || `PT #${transaction.paymentTransactionId}`}
                        </span>
                    </nav>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push("/payment-transaction-list")}
                            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 transition cursor-pointer"
                        >
                            ← Back to List
                        </button>
                        {can && can("paymentTransactionUpdate") && (
                            <button
                                onClick={() => setShowEditPanel(true)}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm cursor-pointer"
                            >
                                Edit Transaction
                            </button>
                        )}
                    </div>
                </div>

                {/* Header info card */}
                <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">
                                {transaction.narration || `PT #${transaction.paymentTransactionId}`}
                            </h1>
                            <span className="inline-block rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-semibold">
                                {transaction.paymentMode}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Customer: <span className="font-semibold text-gray-700">{transaction.customerName || transaction.customer?.customerName || "-"}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400 font-medium">Transaction Amount</p>
                        <p className="text-2xl font-bold text-gray-900 font-mono">
                            {transaction.currencyCode || ""} {Number(transaction.transactionAmount || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                            Base: <span className="font-mono font-semibold">{Number(transaction.baseAmount || 0).toFixed(2)}</span>
                        </p>
                    </div>
                </div>

                {/* Main Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* General Information */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
                        <h3 className="text-base font-bold text-gray-800 border-b pb-3 border-gray-100">
                            General Information
                        </h3>
                        <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Customer</dt>
                                <dd className="text-gray-800 font-semibold mt-0.5">
                                    {transaction.customerName || transaction.customer?.customerName || "-"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Bank Account</dt>
                                <dd className="text-gray-800 font-semibold mt-0.5">
                                    {transaction.bankBookName || transaction.bankBook?.bankBookName || "-"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Company</dt>
                                <dd className="mt-0.5">
                                    <LinkedCompanyCell
                                        companyId={transaction.companyId}
                                        companyName={transaction.companyName || transaction.company?.companyName}
                                    />
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Currency</dt>
                                <dd className="text-gray-800 font-semibold mt-0.5">
                                    {transaction.currencyCode || transaction.currency?.code || "-"}
                                    {transaction.currencySymbol ? ` (${transaction.currencySymbol})` : ""}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Payment Mode</dt>
                                <dd className="text-gray-800 font-semibold mt-0.5">{transaction.paymentMode || "-"}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Payment Date</dt>
                                <dd className="text-gray-800 font-semibold mt-0.5">{formatDate(transaction.paymentDate)}</dd>
                            </div>
                        </dl>
                    </div>

                    {/* Amounts & Conversion */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
                        <h3 className="text-base font-bold text-gray-800 border-b pb-3 border-gray-100">
                            Amounts & Conversion
                        </h3>
                        <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Transaction Amount</dt>
                                <dd className="text-gray-900 font-bold font-mono text-base mt-0.5">
                                    {Number(transaction.transactionAmount || 0).toFixed(4)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Exchange Rate</dt>
                                <dd className="text-gray-800 font-semibold font-mono mt-0.5">
                                    {Number(transaction.exchangeRate || 1).toFixed(6)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Exchange Date</dt>
                                <dd className="text-gray-800 font-semibold mt-0.5">{formatDate(transaction.exchangeDate)}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-400 font-medium text-xs">Base Amount</dt>
                                <dd className="text-gray-900 font-bold font-mono text-base mt-0.5">
                                    {Number(transaction.baseAmount || 0).toFixed(4)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                {/* Details & Attachments Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Narration & Description */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
                        <h3 className="text-base font-bold text-gray-800 border-b pb-3 border-gray-100">
                            Details & Description
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-gray-400 font-medium text-xs">Narration</p>
                                <p className="text-gray-800 font-semibold mt-0.5">{transaction.narration || "-"}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 font-medium text-xs">Description</p>
                                <p className="text-gray-700 whitespace-pre-wrap mt-0.5 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    {transaction.description || "No description provided."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Attachments */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
                        <h3 className="text-base font-bold text-gray-800 border-b pb-3 border-gray-100">
                            Attachments
                        </h3>
                        {Array.isArray(transaction.attachments) && transaction.attachments.length > 0 ? (
                            <div className="space-y-2">
                                {transaction.attachments.map((att) => {
                                    const fileName = att.attachmentUrl ? att.attachmentUrl.split("/").pop() : "Attachment";
                                    return (
                                        <a
                                            key={att.paymentTransactionAttachmentId}
                                            href={att.attachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-blue-50/60 border border-gray-200 hover:border-blue-300 transition text-sm text-gray-700 group"
                                        >
                                            <div className="flex items-center gap-2 truncate max-w-[80%]">
                                                <Paperclip className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                                                <span className="truncate font-medium group-hover:text-blue-600">{fileName}</span>
                                            </div>
                                            <span className="text-xs text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition">
                                                View →
                                            </span>
                                        </a>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">No attachments uploaded.</p>
                        )}
                    </div>
                </div>

                {/* Audit card */}
                <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-gray-800 border-b pb-3 border-gray-100 mb-3">
                        Audit Information
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-gray-400 font-medium text-xs">Added By</p>
                            <p className="text-gray-700 font-semibold mt-0.5">{transaction.addedByName || "-"}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 font-medium text-xs">Added Date</p>
                            <p className="text-gray-700 font-semibold mt-0.5">{formatDate(transaction.addedDate)}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 font-medium text-xs">Updated By</p>
                            <p className="text-gray-700 font-semibold mt-0.5">{transaction.updatedByName || "-"}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 font-medium text-xs">Updated Date</p>
                            <p className="text-gray-700 font-semibold mt-0.5">{formatDate(transaction.updatedDate)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit form side panel */}
            <PaymentTransactionFormSidePanel
                isOpen={showEditPanel}
                onClose={() => setShowEditPanel(false)}
                context="payment-transaction-update"
                id={id}
                onSuccess={handleEditClose}
            />
        </div>
    );
}
