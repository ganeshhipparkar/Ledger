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

export default function CustomerDetails({ id }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { can } = useContext(loginContext);
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEdit, setShowEdit] = useState(false);
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);

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
                    <span
                        className="cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/")}
                    >
                        Home
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span
                        className="cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/customer-list")}
                    >
                        Customers
                    </span>
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
                                <button className="w-full rounded-xl px-4 py-3 text-left font-medium transition bg-gray-600 text-white">
                                    Summary
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="col-span-12 lg:col-span-9 space-y-6">
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
                                    <div>
                                        <div className="text-sm text-gray-500">Company</div>
                                        <div className="text-[#101010] font-bold text-[#374151] mt-1">
                                            <LinkedCompanyCell
                                                companyId={customer.companyId}
                                                companyName={customer.companyName || customer.company?.companyName}
                                            />
                                        </div>
                                    </div>
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
