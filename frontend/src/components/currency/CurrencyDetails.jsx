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
import CurrencyFormRenderer from "./CurrencyFormRenderer";
import UserSidePanel from "../user/UserSidePanel";

export default function CurrencyDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [currency, setCurrency] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEdit, setShowEdit] = useState(false);
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);

    useEffect(() => {
        fetchCurrency();
    }, [id, showEdit]);

    const fetchCurrency = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/relayapi`, {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `currency-details/${id}`,
                    module: "currency",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setCurrency(data);
            console.log(data, "currency details ")
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const gotoPages = (e, url) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(url);
    };

    function formatDate(dateString) {
        if (!dateString) return "-";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "-";
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const strTime = String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;
        return `${day}/${month}/${year} ${strTime}`;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="currency-details" />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading currency details..." />
                </div>
            </div>
        );
    }

    if (showEdit) {
        return <CurrencyFormRenderer context="currency-update" id={id} onBack={() => setShowEdit(false)} />;
    }

    if (!currency) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="currency-details" />
                <div className="p-8 text-red-500 text-lg font-semibold">Currency not found.</div>
            </div>
        );
    }

    const statusBadge = (status) => {
        const s = String(status).toLowerCase();
        if (s === "active") return "inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
        if (s === "inactive") return "inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
        return "inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700";
    };

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page="currency-details" />

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 pb-20">
                <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600 hover:underline">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/currency-list" className="cursor-pointer hover:text-blue-600 hover:underline">Currencies</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Currency</span>
                </nav>

                {/* Title and Edit Button */}
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">Currency Details</h1>
                    <div className="flex items-center gap-4">
                        {can("currencyUpdate") && (
                            <button
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
                    <div className="col-span-12 lg:col-span-3">
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
                            <div className="border-b pb-5">
                                <h2 className="text-xl font-semibold text-gray-800">{currency.name || "N/A"}</h2>
                                <p className="text-sm text-gray-400 mt-1">{currency.code || "N/A"}</p>
                            </div>
                            <div className="mt-6 space-y-3">
                                <button
                                    className="w-full rounded-xl px-4 py-3 text-left font-medium transition bg-gray-600 text-white"
                                >
                                    Summary
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="col-span-12 lg:col-span-9">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Details card */}
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <div className="flex items-center gap-4 border-b pb-5">
                                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-50 shadow-md relative">
                                        <span className="h-full w-full flex items-center justify-center text-2xl font-bold text-blue-600">
                                            {currency.symbol || "$"}
                                        </span>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-semibold text-gray-800">{currency.name || "-"}</h2>
                                        <span className={statusBadge(currency.status)}>{currency.status}</span>
                                    </div>
                                </div>
                                <div className="mt-6 space-y-4">
                                    <div className="grid grid-cols-2">
                                        <p className="text-gray-500">Currency Code</p>
                                        <p className="font-medium text-gray-800">{currency.code || "-"}</p>
                                    </div>
                                    <div className="grid grid-cols-2">
                                        <p className="text-gray-500">Currency Symbol</p>
                                        <p className="font-medium text-gray-800">{currency.symbol || "-"}</p>
                                    </div>
                                    <div className="grid grid-cols-2">
                                        <p className="text-gray-500">Base Currency</p>
                                        <p className="font-medium text-gray-800">{currency.baseCurrency || "-"}</p>
                                    </div>
                                    <div className="grid grid-cols-2">
                                        <p className="text-gray-500">Conversion Rate</p>
                                        <p className="font-medium text-gray-800">{currency.conversionRate || "-"}</p>
                                    </div>
                                    <div className="grid grid-cols-2">
                                        <p className="text-gray-500">Last Synced Date</p>
                                        <p className="font-medium text-gray-800">
                                            {currency.lastSync ? formatDate(currency.lastSync) : "-"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Audit / Logs card */}
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <h3 className="mb-5 text-lg font-semibold text-gray-800">Audit Information</h3>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500">Added By</p>
                                        <p
                                            className={`font-medium ${currency.addedBy && can("userView") ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-800"}`}
                                            onClick={() => currency.addedBy && can("userView") && setSelectedUserPanelId(currency.addedBy)}
                                        >
                                            {currency.addedByName || "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Added Date</p>
                                        <p className="font-medium text-gray-800">
                                            {currency.addedDate ? formatDate(currency.addedDate) : "-"}
                                        </p>
                                    </div>
                                    <div className="border-t border-gray-100 pt-4">
                                        <p className="text-sm text-gray-500">Updated By</p>
                                        <p
                                            className={`font-medium ${currency.updatedBy && can("userView") ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-800"}`}
                                            onClick={() => currency.updatedBy && can("userView") && setSelectedUserPanelId(currency.updatedBy)}
                                        >
                                            {currency.updatedByName || "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Updated Date</p>
                                        <p className="font-medium text-gray-800">
                                            {currency.updatedDate ? formatDate(currency.updatedDate) : "-"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {selectedUserPanelId && typeof document !== "undefined" && createPortal(
                <UserSidePanel
                    userId={selectedUserPanelId}
                    onClose={() => setSelectedUserPanelId(null)}
                />,
                document.body
            )}
        </div>
    );
}
