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
import ItemCategoryFormSidePanel from "./ItemCategoryFormSidePanel";
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

export default function ItemCategoryDetails({ id }) {
    const router = useRouter();
    const { can, displayUser, activeAssignment } = useContext(loginContext) || {};
    const isSuperAdmin = displayUser?.primaryProfile?.groupCode === "admin" || activeAssignment?.groupCode === "admin";
    const [category, setCategory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditPanel, setShowEditPanel] = useState(false);
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);

    useEffect(() => {
        fetchCategory();
    }, [id]);

    // Refetch after edit panel closes so data stays fresh
    const handleEditClose = () => {
        setShowEditPanel(false);
        fetchCategory();
    };

    const fetchCategory = async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `item-category-details/${id}`,
                    module: "item-category",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setCategory(data?.itemCategoryId ? data : null);
        } catch (err) {
            console.error(err);
            setCategory(null);
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
                <Header page="item-category-details" />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading item category details..." />
                </div>
            </div>
        );
    }

    if (!category) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="item-category-details" />
                <div className="p-8 text-red-500 text-lg font-semibold">
                    Item category not found.
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page="item-category-details" />

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 pb-20">
                {/* Breadcrumbs */}
                <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600 hover:underline">
                        Home
                    </Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/item-category-list" className="cursor-pointer hover:text-blue-600 hover:underline">
                        Item Categories
                    </Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Item Category</span>
                </nav>

                {/* Title + action buttons */}
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">
                        Details
                    </h1>
                    <div className="flex items-center gap-4">
                        {can("itemCategoryUpdate") && (
                            <button
                                id="edit-item-category-btn"
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
                                    {category.itemCategoryName || "N/A"}
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    {category.itemCategoryCode || "N/A"}
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
                                            {category.itemCategoryCode?.substring(0, 2) || "IC"}
                                        </span>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-semibold text-gray-800">
                                            {category.itemCategoryName || "-"}
                                        </h2>
                                        <span className={statusBadge(category.status)}>
                                            {category.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-6 space-y-4">
                                    <div className="grid grid-cols-2">
                                        <p className="text-gray-500">Category Code</p>
                                        <p className="font-medium text-gray-800">
                                            {category.itemCategoryCode || "-"}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2">
                                        <p className="text-gray-500">Parent Category</p>
                                        {category.parentCategoryName && category.parentCategoryId ? (
                                            <p
                                                className={`font-medium ${can("itemCategoryView")
                                                    ? "text-blue-600 cursor-pointer hover:underline"
                                                    : "text-gray-800"
                                                    }`}
                                                onClick={() =>
                                                    can("itemCategoryView") &&
                                                    router.push(`/item-category/${category.parentCategoryId}`)
                                                }
                                            >
                                                {category.parentCategoryName}
                                            </p>
                                        ) : (
                                            <p className="font-medium text-gray-800">-</p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2">
                                        <p className="text-gray-500">Type</p>
                                        <p className="font-medium text-gray-800">
                                            {category.type || "-"}
                                        </p>
                                    </div>
                                    {isSuperAdmin && (
<div className="grid grid-cols-2">
                                        <p className="text-gray-500">Company</p>
                                        <div className="font-medium text-gray-800">
                                            <LinkedCompanyCell
                                                companyId={category.companyId}
                                                companyName={category.companyName || category.company?.companyName}
                                            />
                                        </div>
                                    </div>
)}
                                </div>
                            </div>

                            {/* Audit card */}
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <h3 className="mb-5 text-lg font-semibold text-gray-800">
                                    Audit Information
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500">Added By</p>
                                        <p
                                            className={`font-medium ${category.addedBy && can("userView")
                                                ? "text-blue-600 cursor-pointer hover:underline"
                                                : "text-gray-800"
                                                }`}
                                            onClick={() =>
                                                category.addedBy &&
                                                can("userView") &&
                                                setSelectedUserPanelId(category.addedBy)
                                            }
                                        >
                                            {category.addedByName || "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Added Date</p>
                                        <p className="font-medium text-gray-800">
                                            {formatDate(category.addedDate)}
                                        </p>
                                    </div>
                                    <div className="border-t border-gray-100 pt-4">
                                        <p className="text-sm text-gray-500">Updated By</p>
                                        <p
                                            className={`font-medium ${category.updatedBy && can("userView")
                                                ? "text-blue-600 cursor-pointer hover:underline"
                                                : "text-gray-800"
                                                }`}
                                            onClick={() =>
                                                category.updatedBy &&
                                                can("userView") &&
                                                setSelectedUserPanelId(category.updatedBy)
                                            }
                                        >
                                            {category.updatedByName || "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Updated Date</p>
                                        <p className="font-medium text-gray-800">
                                            {formatDate(category.updatedDate)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit slide-over panel (portalled) */}
            {typeof document !== "undefined" &&
                createPortal(
                    <ItemCategoryFormSidePanel
                        isOpen={showEditPanel}
                        onClose={handleEditClose}
                        context="item-category-update"
                        id={id}
                        onSuccess={fetchCategory}
                    />,
                    document.body
                )}

            {/* User detail panel (portalled) */}
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
