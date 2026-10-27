"use client";

import Link from "next/link";
import { useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { authHeaders } from "@/app/lib/auth";
import Header from "../Header";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import { FileText, Eye } from "lucide-react";
import AttachmentPreviewModal from "../ui/AttachmentPreviewModal";
import UserSidePanel from "../user/UserSidePanel";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import DetailsSidePanel from "../DetailsSidePanel";
import { itemSidePanelConfig } from "../item/configs/itemSidePanel.config";
import ActivityTimeline from "@/components/activity/ActivityTimeline";
import { getImageUrl } from "@/lib/utils";

function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

function formatDeliveryDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function AttachmentThumb({ url, onClick }) {
    const ext = url?.split(".").pop()?.toLowerCase();
    const isPdf = ext === "pdf";
    const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    const fullUrl = getImageUrl(url);

    if (isPdf) {
        return (
            <div
                onClick={() => onClick?.(fullUrl, "pdf")}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-gray-200 bg-gradient-to-br from-red-50 via-white to-red-100/50 p-1 flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition group relative shrink-0"
            >
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shadow-sm group-hover:scale-110 transition-transform">
                    <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-wider text-red-600 bg-red-100/80 border border-red-200 px-1 py-0.5 rounded-full mt-0.5">
                    PDF
                </span>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                    <div className="h-6 w-6 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                        <Eye className="h-3 w-3" />
                    </div>
                </div>
            </div>
        );
    }

    if (isImage) {
        return (
            <div
                onClick={() => onClick?.(fullUrl, "image")}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-400 transition group relative shrink-0 overflow-hidden bg-gray-50"
            >
                <img src={fullUrl} alt="Attachment preview" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="h-6 w-6 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                        <Eye className="h-3 w-3" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => onClick?.(fullUrl, "image")}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition group relative shrink-0"
        >
            <FileText className="h-6 w-6 text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold uppercase text-blue-600 mt-0.5">{ext || "file"}</span>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                <div className="h-6 w-6 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                    <Eye className="h-3 w-3" />
                </div>
            </div>
        </div>
    );
}

export default function DeliveryNoteDetails({ id }) {
    const qtyDecimals = Number.isFinite(parseInt(process.env.NEXT_PUBLIC_DECIMAL_ALLOWED, 10))
        ? parseInt(process.env.NEXT_PUBLIC_DECIMAL_ALLOWED, 10)
        : 2;

    const router = useRouter();
    const { can } = useContext(loginContext) || {};

    const [deliveryNote, setDeliveryNote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("summary");
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewType, setPreviewType] = useState("image");
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);
    const [selectedCustomerPanelId, setSelectedCustomerPanelId] = useState(null);
    const [selectedItemId, setSelectedItemId] = useState(null);

    const fetchDetails = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `delivery-note-details/${id}`,
                    module: "delivery-note",
                },
            });

            if (res.status === 401 || res.status === 403) {
                const msg = "You don't have permission to view this delivery note.";
                toast.error(msg);
                setError(msg);
                return;
            }

            if (res.status === 404) {
                const msg = "Delivery note not found.";
                toast.error(msg);
                setError(msg);
                return;
            }

            const payload = await res.json();
            const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (result && result.deliveryNoteId) {
                setDeliveryNote(result);
            } else {
                const msg = result?.message || "Failed to load delivery note details.";
                toast.error(msg);
                setError(msg);
            }
        } catch (err) {
            console.error("fetchDetails error:", err);
            const msg = "An unexpected error occurred while loading delivery note details.";
            toast.error(msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="delivery-note-details" />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading delivery note details..." />
                </div>
            </div>
        );
    }

    if (error || !deliveryNote) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="delivery-note-details" />
                <div className="p-8 text-center space-y-4">
                    <p className="text-red-500 text-lg font-semibold">{error || "Delivery Note not found."}</p>
                    <button
                        type="button"
                        onClick={() => router.push("/delivery-note-list")}
                        className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-8 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 cursor-pointer"
                    >
                        Back to Delivery Notes
                    </button>
                </div>
            </div>
        );
    }

    const totalDelivered = (deliveryNote.items || []).reduce(
        (sum, it) => sum + (Number(it.deliverQuantity) || 0),
        0
    );

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page="delivery-note-details" />

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 pb-20">
                <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600 hover:underline">
                        Home
                    </Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/delivery-note-list" className="cursor-pointer hover:text-blue-600 hover:underline">
                        Delivery Notes
                    </Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Details</span>
                </nav>

                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">
                        Details
                    </h1>
                    <div className="flex items-center gap-4">
                        <button
                            className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-8 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 active:scale-[0.98] cursor-pointer"
                            onClick={() => router.back()}
                        >
                            Back
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 sm:col-span-2">
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
                            <div className="border-b pb-5">
                                <h2 className="text-xl font-semibold text-gray-800 break-words">
                                    {deliveryNote.deliveryNoteCode || "—"}
                                </h2>
                            </div>
                            <div className="mt-6 space-y-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("summary")}
                                    className={`w-full rounded-xl px-4 py-3 text-left font-medium transition cursor-pointer ${activeTab === "summary"
                                            ? "bg-gray-600 text-white"
                                            : "text-gray-600 hover:bg-gray-100"
                                        }`}
                                >
                                    Summary
                                </button>
                                {(!can || can("activityView")) && (
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("activity")}
                                        className={`w-full rounded-xl px-4 py-3 text-left font-medium transition cursor-pointer ${activeTab === "activity"
                                                ? "bg-gray-600 text-white"
                                                : "text-gray-600 hover:bg-gray-100"
                                            }`}
                                    >
                                        Activity
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-10">
                        {activeTab === "summary" && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                                    <div className="lg:col-span-3 space-y-6">
                                        <div className="rounded-2xl bg-white p-6 shadow-sm">
                                            <div className="flex items-center gap-4 border-b pb-5 mb-6">
                                                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-50 shadow-md shrink-0">
                                                    <span className="text-2xl font-bold text-blue-600 uppercase">
                                                        DN
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="text-xl font-semibold text-gray-800 truncate">
                                                        Delivery Note Info
                                                    </h2>
                                                    <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                                                        {deliveryNote.deliveryNoteCode || "—"}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-4 text-[15px]">
                                                <div className="grid grid-cols-2">
                                                    <p className="text-gray-500">Delivery Note Code</p>
                                                    <p className="font-mono text-blue-600 font-medium">
                                                        {deliveryNote.deliveryNoteCode || "—"}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2">
                                                    <p className="text-gray-500">Order Number</p>
                                                    <p className="font-medium text-gray-800">
                                                        {deliveryNote.orderCode || "—"}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2">
                                                    <p className="text-gray-500">Customer</p>
                                                    <p
                                                        className="font-medium text-blue-600 hover:underline cursor-pointer"
                                                        onClick={() =>
                                                            deliveryNote.customerId &&
                                                            setSelectedCustomerPanelId(deliveryNote.customerId)
                                                        }
                                                    >
                                                        {deliveryNote.customerName || "—"}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2">
                                                    <p className="text-gray-500">Company</p>
                                                    <p className="font-medium text-gray-800">
                                                        {deliveryNote.companyName || "—"}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2">
                                                    <p className="text-gray-500">Delivery Date</p>
                                                    <p className="font-medium text-gray-800">
                                                        {formatDeliveryDate(deliveryNote.deliveryDate)}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2">
                                                    <p className="text-gray-500">Receiver Name</p>
                                                    <p className="font-medium text-gray-800">
                                                        {deliveryNote.receiverName || "—"}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2">
                                                    <p className="text-gray-500">Billing Address</p>
                                                    <p className="font-medium text-gray-800 leading-relaxed">
                                                        {deliveryNote.billingAddress || "—"}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2">
                                                    <p className="text-gray-500">Added By</p>
                                                    <p className="font-medium text-gray-800">
                                                        {deliveryNote.addedByName ? (
                                                            <span
                                                                className="text-blue-600 cursor-pointer hover:underline"
                                                                onClick={() =>
                                                                    setSelectedUserPanelId(deliveryNote.addedBy)
                                                                }
                                                            >
                                                                {deliveryNote.addedByName}
                                                            </span>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-2">
                                                    <p className="text-gray-500">Added Date</p>
                                                    <p className="font-medium text-gray-800">
                                                        {formatDate(deliveryNote.addedDate)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-3 space-y-6">
                                        {(deliveryNote.receiverImage || deliveryNote.receiverSignature) && (
                                            <div className="rounded-2xl bg-white p-6 shadow-sm space-y-5">
                                                <h3 className="text-lg font-semibold text-gray-800 border-b pb-4">
                                                    Receiver Media
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {deliveryNote.receiverImage && (
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                                                Receiver Image
                                                            </p>
                                                            <div
                                                                onClick={() => {
                                                                    setPreviewUrl(getImageUrl(deliveryNote.receiverImage));
                                                                    setPreviewType("image");
                                                                }}
                                                                className="w-full h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer hover:shadow-md transition relative group"
                                                            >
                                                                <img
                                                                    src={getImageUrl(deliveryNote.receiverImage)}
                                                                    alt="Receiver"
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <div className="h-8 w-8 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                                                                        <Eye className="h-4 w-4" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {deliveryNote.receiverSignature && (
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                                                Receiver Signature
                                                            </p>
                                                            <div
                                                                onClick={() => {
                                                                    setPreviewUrl(getImageUrl(deliveryNote.receiverSignature));
                                                                    setPreviewType("image");
                                                                }}
                                                                className="w-full h-40 rounded-xl overflow-hidden border border-gray-200 bg-white p-3 flex items-center justify-center cursor-pointer hover:shadow-md transition relative group"
                                                            >
                                                                <img
                                                                    src={getImageUrl(deliveryNote.receiverSignature)}
                                                                    alt="Receiver Signature"
                                                                    className="max-h-full max-w-full object-contain"
                                                                />
                                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <div className="h-8 w-8 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                                                                        <Eye className="h-4 w-4" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="rounded-2xl bg-white p-6 shadow-sm">
                                            <h3 className="mb-5 text-xl font-semibold text-gray-800">
                                                Receiver Attachments ({(deliveryNote.attachments ?? []).length})
                                            </h3>
                                            <div>
                                                {(deliveryNote.attachments ?? []).length === 0 ? (
                                                    <p className="text-sm text-gray-400 italic">No attachments.</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-4">
                                                        {deliveryNote.attachments.map((att, i) => (
                                                            <AttachmentThumb
                                                                key={att.deliveryNoteAttachmentId ?? att.id ?? i}
                                                                url={att.attachmentUrl || att.fileUrl || att.url}
                                                                onClick={(url, type) => {
                                                                    setPreviewUrl(url);
                                                                    setPreviewType(type);
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                                            Item(s)
                                        </h3>
                                        <div className="text-xs font-medium text-gray-500">
                                            Total {(deliveryNote.items ?? []).length} item(s)
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto w-full">
                                        <table className="w-full min-w-[700px] border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="w-12 px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                                                    <th className="min-w-[200px] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                                                    <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested Qty</th>
                                                    <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Qty</th>
                                                    <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivered Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {(deliveryNote.items ?? []).length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="py-12 text-center text-gray-400">
                                                            No items
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    (deliveryNote.items ?? []).map((item, idx) => (
                                                        <tr key={item.deliveryNoteItemId ?? idx} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="w-12 px-4 py-3.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                                                            <td className="min-w-[200px] px-4 py-3.5 text-left">
                                                                {item.itemId ? (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setSelectedItemId(item.itemId)}
                                                                            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline break-words text-left bg-transparent border-none p-0 cursor-pointer"
                                                                        >
                                                                            {item.itemName || item.itemCode || "—"}
                                                                        </button>
                                                                        <p className="text-xs text-gray-400 mt-0.5">{item.itemCode || ""}</p>
                                                                        {item.description && item.description !== item.itemName && (
                                                                            <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className="font-semibold text-gray-800 break-words">{item.description || item.itemName || "—"}</span>
                                                                )}
                                                            </td>
                                                            <td className="min-w-[120px] px-4 py-3.5 text-right font-medium text-gray-700 whitespace-nowrap">
                                                                {Number(item.requestedQuantity ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: qtyDecimals })}
                                                            </td>
                                                            <td className="min-w-[120px] px-4 py-3.5 text-right font-medium text-amber-600 whitespace-nowrap">
                                                                {Number(item.pendingQuantity ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: qtyDecimals })}
                                                            </td>
                                                            <td className="min-w-[120px] px-4 py-3.5 text-right font-bold text-blue-600 whitespace-nowrap">
                                                                {Number(item.deliverQuantity ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: qtyDecimals })}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            {(deliveryNote.items ?? []).length > 0 && (
                                                <tfoot className="bg-gray-50 font-semibold text-gray-800 border-t border-gray-200">
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-700">
                                                            Total Delivered:
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-blue-600 whitespace-nowrap">
                                                            {totalDelivered.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: qtyDecimals })}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "activity" && (
                            <div className="max-h-[70vh] overflow-y-auto pr-2 my-4">
                                <ActivityTimeline targetType="DELIVERY_NOTE" targetId={id} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AttachmentPreviewModal
                open={!!previewUrl}
                onClose={() => setPreviewUrl("")}
                fileUrl={previewUrl}
                fileType={previewType}
            />

            {selectedItemId && (
                <DetailsSidePanel
                    config={itemSidePanelConfig}
                    id={selectedItemId}
                    onClose={() => setSelectedItemId(null)}
                />
            )}

            {selectedUserPanelId &&
                typeof document !== "undefined" &&
                createPortal(
                    <UserSidePanel
                        userId={selectedUserPanelId}
                        onClose={() => setSelectedUserPanelId(null)}
                    />,
                    document.body
                )}

            {selectedCustomerPanelId &&
                typeof document !== "undefined" &&
                createPortal(
                    <CustomerSidePanel
                        customerId={selectedCustomerPanelId}
                        onClose={() => setSelectedCustomerPanelId(null)}
                    />,
                    document.body
                )}
        </div>
    );
}
