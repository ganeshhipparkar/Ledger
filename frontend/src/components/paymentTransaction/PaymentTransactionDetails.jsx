"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import Header from "../Header";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import LinkedCustomerCell from "../common/LinkedCustomerCell";
import LinkedBankBookCell from "../common/LinkedBankBookCell";
import PaymentTransactionStatusSidePanel from "./PaymentTransactionStatusSidePanel";
import ActivityTimeline from "@/components/activity/ActivityTimeline";
import { ChevronDown, CheckCircle, XCircle } from "lucide-react";
import MultiFilePicker from "../common/MultiFilePicker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    const [activeTab, setActiveTab] = useState("summary");

    const [statusModal, setStatusModal] = useState({
        open: false,
        action: "approve",
    });

    useEffect(() => {
        fetchTransaction();
    }, [id]);

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

    const currentStatus = transaction.status || "Pending";
    const isPending = currentStatus === "Pending";

    let statusBadgeClass = "bg-amber-100 text-amber-800 border-amber-200";
    if (currentStatus === "Approved") statusBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (currentStatus === "Cancelled") statusBadgeClass = "bg-red-100 text-red-800 border-red-200";

    const displayCode = transaction.paymentCode || `PT-${transaction.paymentTransactionId}`;

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page="payment-transaction-details" />

            <div className="p-6">
                <nav className="mb-4 flex items-center space-x-2 text-sm font-medium text-gray-500" aria-label="Breadcrumb">
                    <span
                        className="cursor-pointer transition-colors hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/")}
                    >
                        Home
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span
                        className="cursor-pointer transition-colors hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/payment-transaction-list")}
                    >
                        Payment Transactions
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800 font-semibold">{"payment"}</span>
                </nav>

                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-3xl font-semibold text-gray-800">Details</h1>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push("/payment-transaction-list")}
                            className="inline-flex h-11 items-center justify-center rounded-xl bg-gray-200 px-6 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-300 cursor-pointer"
                        >
                            ← Back to List
                        </button>

                        {can && can("paymentTransactionUpdate") && isPending && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div className="inline-flex h-11 items-center gap-1.5 px-6 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs">
                                        Actions
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg rounded-xl p-1">
                                    <DropdownMenuItem
                                        className="cursor-pointer px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-2"
                                        onClick={() => setStatusModal({ open: true, action: "approve" })}
                                    >
                                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                                        Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-2"
                                        onClick={() => setStatusModal({ open: true, action: "cancel" })}
                                    >
                                        <XCircle className="h-4 w-4 text-red-600" />
                                        Cancel
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-2">
                        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
                            <div className="border-b pb-5">
                                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold border mb-2 ${statusBadgeClass}`}>
                                    {currentStatus}
                                </span>
                                <h2 className="text-xl font-semibold capitalize text-gray-800 truncate">
                                    {displayCode}
                                </h2>
                                <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                                    {transaction.narration || "No Narration"}
                                </p>
                            </div>
                            <div className="mt-6 space-y-3">
                                <button
                                    onClick={() => setActiveTab("summary")}
                                    className={`w-full rounded-xl px-4 py-3 text-left font-medium transition cursor-pointer ${activeTab === "summary"
                                        ? "bg-gray-600 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    Summary
                                </button>

                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-10">
                        {activeTab === "summary" && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
                                        <h3 className="text-base font-bold text-gray-800 border-b pb-3 border-gray-100">
                                            General Information
                                        </h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Payment Code</p>
                                                <p className="font-mono font-medium text-blue-600">{displayCode}</p>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Customer</p>
                                                <div className="font-medium text-gray-800">
                                                    <LinkedCustomerCell
                                                        customerId={transaction.customerId}
                                                        customerName={transaction.customerName || transaction.customer?.customerName}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Bank Account</p>
                                                <div className="font-medium text-gray-800">
                                                    <LinkedBankBookCell
                                                        bankBookId={transaction.bankBookId}
                                                        bankBookName={transaction.bankBookName || transaction.bankBook?.bankBookName}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Company</p>
                                                <div className="font-medium text-gray-800">
                                                    <LinkedCompanyCell
                                                        companyId={transaction.companyId}
                                                        companyName={transaction.companyName || transaction.company?.companyName}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Currency</p>
                                                <p className="font-medium text-gray-800">
                                                    {transaction.currencyCode || transaction.currency?.code || "-"}
                                                    {transaction.currencySymbol ? ` (${transaction.currencySymbol})` : ""}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Payment Mode</p>
                                                <p className="font-medium text-gray-800">{transaction.paymentMode || "-"}</p>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Payment Date</p>
                                                <p className="font-medium text-gray-800">{formatDate(transaction.paymentDate)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
                                        <h3 className="text-base font-bold text-gray-800 border-b pb-3 border-gray-100">
                                            Amounts & Conversion
                                        </h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Transaction Amount</p>
                                                <p className="text-gray-800">
                                                    {transaction.currencyCode || ""} {Number(transaction.transactionAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Exchange Rate</p>
                                                <p className="text-gray-800">
                                                    {Number(transaction.exchangeRate || 1).toFixed(6)}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Exchange Date</p>
                                                <p className="font-medium text-gray-800">{formatDate(transaction.exchangeDate)}</p>
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Base Amount</p>
                                                <p className="text-gray-800">
                                                    {Number(transaction.baseAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
                                        <h3 className="text-base font-bold text-gray-800 border-b pb-3 border-gray-100">
                                            Details & Remarks
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
                                            {transaction.statusRemarks && (
                                                <div>
                                                    <p className="text-gray-400 font-medium text-xs">Status Remarks</p>
                                                    <p className="text-gray-700 whitespace-pre-wrap mt-0.5 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                                        {transaction.statusRemarks}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
                                        <MultiFilePicker
                                            readOnly
                                            existingAttachments={transaction.attachments ?? []}
                                            label="Attachments"
                                        />
                                    </div>
                                </div>
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
                        )}

                        {activeTab === "activities" && (
                            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                                <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-3">Activities</h2>
                                <ActivityTimeline />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <PaymentTransactionStatusSidePanel
                isOpen={statusModal.open}
                onClose={() => setStatusModal({ open: false, action: "approve" })}
                transactionId={id}
                action={statusModal.action}
                onSuccess={fetchTransaction}
            />
        </div>
    );
}
