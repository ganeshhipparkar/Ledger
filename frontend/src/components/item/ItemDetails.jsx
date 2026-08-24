"use client";

import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import Header from "../Header";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import UserSidePanel from "../user/UserSidePanel";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import EditItemPage from "./itemUpdate";
import { Star, ImageIcon } from "lucide-react";
import { getImageUrl } from "@/lib/utils";

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
    const s = String(status || "").toLowerCase();
    if (s === "active") return "inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
    if (s === "inactive") return "inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
    return "inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700";
}

export default function ItemDetails({ id }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEditQuery = searchParams.get("edit") === "true";
    const { can } = useContext(loginContext);

    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEdit, setShowEdit] = useState(isEditQuery);
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);
    const [imageModal, setImageModal] = useState({ open: false, url: null, alt: "" });

    useEffect(() => { fetchItem(); }, [id, showEdit]);

    const fetchItem = async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `item-details/${id}`,
                    module: "item",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setItem(data?.itemId ? data : null);
        } catch { setItem(null); }
        finally { setLoading(false); }
    };

    const gotoPages = (e, url) => { e.preventDefault(); e.stopPropagation(); router.push(url); };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="item-details" />
                <div className="flex items-center justify-center py-20"><Loader label="Loading item details..." /></div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="item-details" />
                <div className="p-8 text-red-500 text-lg font-semibold">Item not found.</div>
            </div>
        );
    }

    if (showEdit) {
        return <EditItemPage item={item} onBack={() => setShowEdit(false)} />;
    }

    const primaryImg = item.images?.find((img) => img.isParent === 0);
    const galleryImages = item.images || [];

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page="item-details" />

            <div className="p-6">
                {/* Breadcrumbs */}
                <nav className="mb-4 flex items-center space-x-2 text-sm font-medium text-gray-500" aria-label="Breadcrumb">
                    <span className="cursor-pointer transition-colors hover:text-blue-600 hover:underline" onClick={(e) => gotoPages(e, "/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer transition-colors hover:text-blue-600 hover:underline" onClick={(e) => gotoPages(e, "/item-list")}>Items</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Details</span>
                </nav>

                {/* Header row */}
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">Details</h1>
                    <div className="flex items-center gap-4">
                        {can("itemUpdate") && (
                            <button
                                id="edit-item-btn"
                                className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-8 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 active:scale-[0.98] cursor-pointer"
                                onClick={() => setShowEdit(true)}
                            >
                                Edit
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    {/* Sidebar */}
                    <div className="col-span-12 sm:col-span-2">
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
                            <div className="border-b pb-5">
                                <h2 className="text-xl font-semibold capitalize text-gray-800">{item.itemName || "N/A"}</h2>
                                <p className="text-xs text-gray-400 mt-1 font-mono">{item.itemCode || "N/A"}</p>
                            </div>
                            <div className="mt-6 space-y-3">
                                <button className="w-full rounded-xl px-4 py-3 text-left font-medium transition bg-gray-600 text-white cursor-default">
                                    Summary
                                </button>
                            </div>
                        </div>
                    </div>


                    <div className="col-span-12 lg:col-span-10">
                        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">

                            {/* Column 1: Basic Information, Other Images */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Basic Information Card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-4 border-b pb-5 mb-6">
                                        <div
                                            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-gray-100 border shadow-sm relative flex-shrink-0 cursor-pointer"
                                            onClick={() => primaryImg && setImageModal({ open: true, url: getImageUrl(primaryImg.itemImageUrl), alt: item.itemName })}
                                        >
                                            {primaryImg ? (
                                                <img
                                                    src={getImageUrl(primaryImg.itemImageUrl)}
                                                    alt={item.itemName}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-gray-400">
                                                    <ImageIcon className="h-8 w-8" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-xl font-semibold text-gray-800 truncate">{item.itemName || "N/A"}</h2>
                                            <p className="text-xs text-gray-400 font-mono mt-0.5">{item.itemCode || "N/A"}</p>
                                        </div>
                                    </div>

                                    {/* Fields */}
                                    <div className="space-y-4 text-[15px]">
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Item Name</p>
                                            <p className="font-medium text-gray-800">{item.itemName || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Short Name</p>
                                            <p className="font-medium text-gray-800">{item.shortName || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Barcode</p>
                                            <p className="font-mono text-gray-800">{item.barcode || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Item Code</p>
                                            <p className="font-mono text-blue-600 font-medium">{item.itemCode || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Primitive Quantity</p>
                                            <p className="font-medium text-gray-800">{item.primitiveQuantity ?? "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Company</p>
                                            <div className="font-medium text-gray-800">
                                                <LinkedCompanyCell companyId={item.companyId} companyName={item.companyName || item.company?.companyName} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Archive</p>
                                            <p className="font-medium text-gray-800">{item.archive === "true" ? "Yes" : "No"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Status</p>
                                            <div>
                                                <span className={statusBadge(item.status)}>{item.status || "-"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Other Images Card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-5 text-xl font-semibold text-gray-800">Other Images</h3>
                                    {galleryImages.length > 0 ? (
                                        <div className="flex flex-wrap gap-3">
                                            {galleryImages.map((img) => (
                                                <div
                                                    key={img.id}
                                                    className="relative cursor-pointer group"
                                                    onClick={() => setImageModal({ open: true, url: getImageUrl(img.itemImageUrl), alt: item.itemName })}
                                                >
                                                    <img
                                                        src={getImageUrl(img.itemImageUrl)}
                                                        alt="item image"
                                                        className={`h-20 w-20 rounded-xl object-cover border-2 ${img.isParent === 0 ? "border-blue-500" : "border-gray-200"} group-hover:opacity-90 transition`}
                                                    />
                                                    {img.isParent === 0 && (
                                                        <span className="absolute top-1 left-1 bg-blue-600 rounded-full p-0.5" title="Primary image">
                                                            <Star className="h-3 w-3 text-white" />
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                            <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
                                            <p className="text-sm">No Images found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Column 2: Other Details, Currency Details */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Other Details Card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-5 text-xl font-semibold text-gray-800">Other Details</h3>
                                    <div className="space-y-4 text-[15px]">
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Category</p>
                                            <p className="font-medium text-blue-600">{item.categoryName || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Manufacturer</p>
                                            <p className="font-medium text-blue-600">{item.manufacturerName || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Brand</p>
                                            <p className="font-medium text-blue-600">{item.brandName || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Item UOM</p>
                                            <p className="font-medium text-blue-600">{item.itemUomName || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Package Type</p>
                                            <p className="font-medium text-gray-800">{item.packageName || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Purchase Price ({item.currencyCode || "Source"})</p>
                                            <p className="font-semibold text-gray-800">
                                                {item.purchasePrice != null ? `${item.currencySymbol || ""} ${Number(item.purchasePrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim() : "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Cost Per Unit ({item.currencyCode || "Source"})</p>
                                            <p className="font-semibold text-gray-800">
                                                {item.costPerUnit != null ? `${item.currencySymbol || ""} ${Number(item.costPerUnit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim() : "-"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Currency Details Card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-5 text-xl font-semibold text-gray-800">Currency Details</h3>
                                    <div className="space-y-4 text-[15px]">
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Source Currency</p>
                                            <p className="font-medium text-gray-800">
                                                {item.currencyName ? `${item.currencyName}${item.currencyCode ? ` (${item.currencyCode})` : ""}` : "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Conversion Rate</p>
                                            <p className="font-medium text-gray-800">{item.conversionRate ?? "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Purchase Price {item.baseCurrencySymbol}</p>
                                            <p className="font-semibold text-gray-800">
                                                {item.convertedPurchasePrice != null ? `${item.baseCurrencySymbol} ${Number(item.convertedPurchasePrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Cost Per Unit {item.baseCurrencySymbol}</p>
                                            <p className="font-semibold text-gray-800">
                                                {item.convertedCostPerUnit != null ? `${item.baseCurrencySymbol} ${Number(item.convertedCostPerUnit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Column 3: Unit(s), Remarks, Audit Info */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Unit(s) Card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-5 text-xl font-semibold text-gray-800">Unit(s)</h3>
                                    <div className="space-y-4 text-[15px]">
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Check Shelf Life</p>
                                            <p className="font-medium text-gray-800">{item.checkShelfLife === "true" ? "Yes" : "No"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Shelf Life</p>
                                            <p className="font-medium text-gray-800">
                                                {item.checkShelfLife === "true" || item.shelfLifeSpan != null
                                                    ? `${item.shelfLifeSpan ?? ""} ${item.shelfLifeUnit ? item.shelfLifeUnit.charAt(0).toUpperCase() + item.shelfLifeUnit.slice(1) : ""}`.trim() || "-"
                                                    : "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Decimal Allowed</p>
                                            <p className="font-medium text-gray-800">{item.isDecimalAllowed === "true" ? "Yes" : "No"}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Remarks Card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-3 text-xl font-semibold text-gray-800">Remarks</h3>
                                    <div className="text-[15px] text-gray-600 whitespace-pre-wrap break-words min-h-[60px]">
                                        {item.remarks ? item.remarks : (
                                            <p className="flex items-center justify-center text-gray-400 py-4">No Remarks found.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Audit Info Card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-5 text-xl font-semibold text-gray-800">Audit Info</h3>
                                    <div className="space-y-4 text-[15px]">
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Added By</p>
                                            <p className="font-medium text-gray-800">
                                                {item.addedByName ? (
                                                    <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => setSelectedUserPanelId(item.addedBy)}>
                                                        {item.addedByName}
                                                    </span>
                                                ) : "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Added Date</p>
                                            <p className="font-medium text-gray-800">{formatDate(item.addedDate)}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Updated By</p>
                                            <p className="font-medium text-gray-800">
                                                {item.updatedByName ? (
                                                    <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => setSelectedUserPanelId(item.updatedBy)}>
                                                        {item.updatedByName}
                                                    </span>
                                                ) : "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Updated Date</p>
                                            <p className="font-medium text-gray-800">{formatDate(item.updatedDate)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* User side panel */}
            {selectedUserPanelId && typeof document !== "undefined" &&
                createPortal(
                    <UserSidePanel
                        userId={selectedUserPanelId}
                        onClose={() => setSelectedUserPanelId(null)}
                    />,
                    document.body
                )}

            {/* Image preview modal */}
            <ImagePreviewModal
                open={imageModal.open}
                onClose={() => setImageModal({ open: false, url: null, alt: "" })}
                imageUrl={imageModal.url}
                alt={imageModal.alt}
            />
        </div>
    );
}

