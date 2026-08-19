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
import BankFormSidePanel from "./BankFormSidePanel";
import UserSidePanel from "../user/UserSidePanel";

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

export default function BankDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [bank, setBank] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditPanel, setShowEditPanel] = useState(false);
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);

    useEffect(() => {
        fetchBank();
    }, [id]);

    const handleEditClose = () => {
        setShowEditPanel(false);
        fetchBank();
    };

    const fetchBank = async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `bank-details/${id}`,
                    module: "bank",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setBank(data?.bankId ? data : null);
        } catch (err) {
            console.error(err);
            setBank(null);
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
                <Header page="bank-details" />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading bank details..." />
                </div>
            </div>
        );
    }

    if (!bank) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="bank-details" />
                <div className="p-8 text-red-500 text-lg font-semibold">
                    Bank not found.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page="bank-details" />

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
                        onClick={(e) => gotoPages(e, "/bank-list")}
                    >
                        Banks
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Bank</span>
                </nav>

                {/* Title + action buttons */}
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">
                        Details
                    </h1>
                    <div className="flex items-center gap-4">
                        {can("bankUpdate") && (
                            <button
                                id="edit-bank-btn"
                                className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-8 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 active:scale-[0.98] cursor-pointer"
                                onClick={() => setShowEditPanel(true)}
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
                            <div className="border-b pb-5">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    {bank.bankName || "N/A"}
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    {bank.bankCode || "N/A"}
                                </p>
                            </div>
                            <div className="mt-6 space-y-3">
                                <button className="w-full rounded-xl px-4 py-3 text-left font-medium transition bg-gray-600 text-white">
                                    Summary
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="col-span-12 lg:col-span-9">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Details card */}
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <div className="flex items-center gap-4 border-b pb-5">
                                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-50 shadow-md">
                                        <span className="text-2xl font-bold text-blue-600 uppercase">
                                            {bank.bankCode?.substring(0, 2) || "BK"}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-[#888888] font-bold text-base">
                                            Bank Info
                                        </div>
                                        <div className="mt-2 text-2xl font-extrabold text-blue-600">
                                            {bank.bankName || "N/A"}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <div className="text-sm text-gray-500">Bank Code</div>
                                        <div className="text-[#101010] font-bold text-[#374151] mt-1 font-mono">
                                            {bank.bankCode || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Company</div>
                                        <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                            <LinkedCompanyCell
                                                companyId={bank.companyId}
                                                companyName={bank.companyName || bank.company?.companyName}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Remarks</div>
                                        <div className="text-[#101010] font-semibold text-gray-800 mt-1">
                                            {bank.remarks || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Status</div>
                                        <div className="mt-1">
                                            <span className={statusBadge(bank.status)}>
                                                {bank.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Audit Card */}
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <div className="flex items-center gap-4 border-b pb-5">
                                    <div className="text-[#888888] font-bold text-base">Audit Logs</div>
                                </div>
                                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <div className="text-sm text-gray-500">Added By</div>
                                        <div className="mt-1 text-sm font-semibold text-gray-800">
                                            {bank.addedByName ? (
                                                <span
                                                    className="text-blue-600 cursor-pointer hover:underline"
                                                    onClick={() => setSelectedUserPanelId(bank.addedBy)}
                                                >
                                                    {bank.addedByName}
                                                </span>
                                            ) : (
                                                "-"
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Added Date</div>
                                        <div className="mt-1 text-sm font-semibold text-gray-800">
                                            {formatDate(bank.addedDate)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Updated By</div>
                                        <div className="mt-1 text-sm font-semibold text-gray-800">
                                            {bank.updatedByName ? (
                                                <span
                                                    className="text-blue-600 cursor-pointer hover:underline"
                                                    onClick={() => setSelectedUserPanelId(bank.updatedBy)}
                                                >
                                                    {bank.updatedByName}
                                                </span>
                                            ) : (
                                                "-"
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Updated Date</div>
                                        <div className="mt-1 text-sm font-semibold text-gray-800">
                                            {formatDate(bank.updatedDate)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit form side panel */}
            {typeof document !== "undefined" &&
                createPortal(
                    <BankFormSidePanel
                        isOpen={showEditPanel}
                        onClose={handleEditClose}
                        context="bank-update"
                        id={id}
                        onSuccess={handleEditClose}
                    />,
                    document.body
                )}

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
