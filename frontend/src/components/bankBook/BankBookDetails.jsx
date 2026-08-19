"use client";

import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import Header from "../Header";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import BankBookFormSidePanel from "./BankBookFormSidePanel";
import UserSidePanel from "../user/UserSidePanel";
import { Pencil } from "lucide-react";

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

function statusBadge(status) {
    const s = String(status).toLowerCase();
    if (s === "active") return "inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
    if (s === "inactive") return "inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
    return "inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700";
}

export default function BankBookDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [bankBook, setBankBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditPanel, setShowEditPanel] = useState(false);
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);

    useEffect(() => {
        fetchBankBook();
    }, [id]);

    const handleEditClose = () => {
        setShowEditPanel(false);
        fetchBankBook();
    };

    const fetchBankBook = async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `bank-book-details/${id}`,
                    module: "bank-book",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setBankBook(data?.bankBookId ? data : null);
        } catch (err) {
            console.error(err);
            setBankBook(null);
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
                <Header page="bank-book-details" />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading bank book details..." />
                </div>
            </div>
        );
    }

    if (!bankBook) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="bank-book-details" />
                <div className="p-8 text-red-500 text-lg font-semibold">
                    Bank book not found.
                </div>
            </div>
        );
    }

    const currencyDisplay = bankBook.currencyCode
        ? `${bankBook.currencyCode}${bankBook.currencySymbol ? ` (${bankBook.currencySymbol})` : ""}`
        : "-";

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page="bank-book-details" />

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 pb-20">
                {/* Breadcrumbs */}
                <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span
                        className="cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/")}
                    >
                        Home
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span
                        className="cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/bank-book-list")}
                    >
                        Bank Books
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">{bankBook.bankBookName}</span>
                </nav>

                {/* Top Profile Header Card */}
                <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-xl shadow-md">
                                {bankBook.bankBookCode?.substring(0, 2) || "BB"}
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        {bankBook.bankBookName}
                                    </h1>
                                    <span className={statusBadge(bankBook.status)}>
                                        {bankBook.status}
                                    </span>
                                </div>
                                <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded-md text-gray-700 font-medium">
                                        {bankBook.bankBookCode || "-"}
                                    </span>
                                    <span>•</span>
                                    <span>Bank: <strong className="text-gray-700">{bankBook.bankName || bankBook.bank?.bankName || "-"}</strong></span>
                                </div>
                            </div>
                        </div>

                        {can && can("bankBookUpdate") && (
                            <button
                                onClick={() => setShowEditPanel(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition shadow-xs cursor-pointer"
                            >
                                <Pencil className="h-4 w-4" />
                                Edit Bank Book
                            </button>
                        )}
                    </div>
                </div>

                {/* Info Grid Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Details Card */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Primary Information */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
                                Primary Information
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Beneficiary Name
                                    </label>
                                    <span className="text-base font-semibold text-gray-900">
                                        {bankBook.beneficiaryName || "-"}
                                    </span>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Bank Name
                                    </label>
                                    <span className="text-base font-medium text-gray-800">
                                        {bankBook.bankName || bankBook.bank?.bankName || "-"}
                                    </span>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Company
                                    </label>
                                    <LinkedCompanyCell
                                        companyId={bankBook.companyId}
                                        companyName={bankBook.companyName || bankBook.company?.companyName}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Currency
                                    </label>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                        {currencyDisplay}
                                    </span>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Remarks
                                    </label>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {bankBook.remarks || "No remarks provided."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Account & Branch Details */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
                                Account & Branch Details
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Account Number
                                    </label>
                                    <span className="text-base font-mono font-semibold text-gray-900">
                                        {bankBook.accountNumber || "-"}
                                    </span>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Branch Name
                                    </label>
                                    <span className="text-sm font-medium text-gray-800">
                                        {bankBook.branchName || "-"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Audit Side Card */}
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
                                Audit Trail
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Added By
                                    </label>
                                    {bankBook.addedBy ? (
                                        <span
                                            onClick={() => setSelectedUserPanelId(bankBook.addedBy)}
                                            className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer"
                                        >
                                            {bankBook.addedByName || `User #${bankBook.addedBy}`}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-500">-</span>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Added Date
                                    </label>
                                    <span className="text-sm text-gray-700">
                                        {formatDate(bankBook.addedDate)}
                                    </span>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Updated By
                                    </label>
                                    {bankBook.updatedBy ? (
                                        <span
                                            onClick={() => setSelectedUserPanelId(bankBook.updatedBy)}
                                            className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer"
                                        >
                                            {bankBook.updatedByName || `User #${bankBook.updatedBy}`}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-500">-</span>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                                        Updated Date
                                    </label>
                                    <span className="text-sm text-gray-700">
                                        {formatDate(bankBook.updatedDate)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Form Side Panel */}
            {typeof document !== "undefined" &&
                createPortal(
                    <BankBookFormSidePanel
                        isOpen={showEditPanel}
                        onClose={handleEditClose}
                        context="bank-book-update"
                        id={bankBook.bankBookId}
                        onSuccess={fetchBankBook}
                    />,
                    document.body
                )}

            {/* User Drawer Side Panel */}
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
