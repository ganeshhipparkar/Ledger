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
import TermsConditionsFormSidePanel from "./TermsConditionsFormSidePanel";

export default function TermsConditionsDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditPanel, setShowEditPanel] = useState(false);

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const handleEditClose = () => {
        setShowEditPanel(false);
        fetchDetails();
    };

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `terms-conditions-details/${id}`,
                    module: "terms-conditions",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setItem(data?.termsConditionsId ? data : null);
        } catch (err) {
            console.error(err);
            setItem(null);
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
                <Header page="terms-conditions-details" />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading details..." />
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="terms-conditions-details" />
                <div className="p-8 text-red-500 text-lg font-semibold">
                    Terms & Conditions not found.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page="terms-conditions-details" />

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
                        onClick={(e) => gotoPages(e, "/terms-conditions-list")}
                    >
                        Terms & Conditions
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Terms</span>
                </nav>

                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">
                        Details
                    </h1>
                    <div className="flex items-center gap-4">
                        {can("termsConditionsUpdate") && (
                            <button
                                id="edit-terms-btn"
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
                                    {item.title || "N/A"}
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    {item.code || "N/A"}
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
                        <div className="grid gap-6 lg:grid-cols-1">
                            {/* Details card */}
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <div className="flex items-center gap-4 border-b pb-5">
                                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-50 shadow-md">
                                        <span className="text-2xl font-bold text-blue-600 uppercase">
                                            {item.code?.substring(0, 2) || "TC"}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-[#888888] font-bold text-base">
                                            Terms Info
                                        </div>
                                        <div className="mt-2 text-2xl font-extrabold text-blue-600">
                                            {item.title || "N/A"}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <div className="text-sm text-gray-500">Code</div>
                                        <div className="text-[#101010] font-bold text-[#374151] mt-1 font-mono">
                                            {item.code || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">Company</div>
                                        <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                            <LinkedCompanyCell
                                                companyId={item.companyId}
                                                companyName={item.companyName || item.company?.companyName}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <div className="text-sm text-gray-500">Content</div>
                                    <div className="text-[#101010] font-medium text-gray-800 mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-4 border border-gray-100">
                                        {item.content || "-"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {typeof document !== "undefined" &&
                createPortal(
                    <TermsConditionsFormSidePanel
                        isOpen={showEditPanel}
                        onClose={handleEditClose}
                        context="termsConditions-update"
                        id={id}
                        onSuccess={handleEditClose}
                    />,
                    document.body
                )}
        </div>
    );
}
