"use client";

import Link from "next/link";
import { useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import Header from "../Header";
import { ArrowLeft, FileText, Eye, Building2, User, Calendar, MapPin } from "lucide-react";
import AttachmentPreviewModal from "../ui/AttachmentPreviewModal";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import { formatDate, getImageUrl } from "@/lib/utils";

function AttachmentThumb({ url, onClick }) {
    const ext = url?.split(".").pop()?.toLowerCase();
    const isPdf = ext === "pdf";
    const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    const fullUrl = getImageUrl(url);

    if (isPdf) {
        return (
            <div
                onClick={() => onClick?.(fullUrl, "pdf")}
                className="w-20 h-20 rounded-xl border border-gray-200 bg-gradient-to-br from-red-50 via-white to-red-100/50 p-1 flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition group relative shrink-0"
            >
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shadow-sm group-hover:scale-110 transition-transform">
                    <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-red-600 bg-red-100/80 border border-red-200 px-1.5 py-0.5 rounded-full mt-1">
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
                className="w-20 h-20 rounded-xl border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-400 transition group relative shrink-0 overflow-hidden bg-gray-50"
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
            className="w-20 h-20 rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition group relative shrink-0"
        >
            <FileText className="h-6 w-6 text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold uppercase text-blue-600 mt-1">{ext || "file"}</span>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                <div className="h-6 w-6 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                    <Eye className="h-3 w-3" />
                </div>
            </div>
        </div>
    );
}

export default function DeliveryNoteDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext) || {};

    const [dn, setDn] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [previewModal, setPreviewModal] = useState({ open: false, url: "", type: "" });
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);

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
                setError("You don't have permission to view this delivery note.");
                return;
            }

            if (res.status === 404) {
                setError("Delivery note not found.");
                return;
            }

            const payload = await res.json();
            const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (result && result.deliveryNoteId) {
                setDn(result);
            } else {
                setError(result?.message || "Failed to load delivery note details.");
            }
        } catch (err) {
            console.error("fetchDetails error:", err);
            setError("An unexpected error occurred while loading delivery note details.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f8fafc]">
                <Header page="delivery-note-details" />
                <div className="flex justify-center py-24">
                    <Loader label="Loading delivery note details..." />
                </div>
            </div>
        );
    }

    if (error || !dn) {
        return (
            <div className="min-h-screen bg-[#f8fafc]">
                <Header page="delivery-note-details" />
                <div className="px-6 py-12 text-center">
                    <p className="text-red-500 font-medium mb-4">{error || "Delivery note not found."}</p>
                    <button
                        type="button"
                        onClick={() => router.push("/delivery-note-list")}
                        className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                    >
                        Back to Delivery Notes
                    </button>
                </div>
            </div>
        );
    }

    const items = dn.items || [];
    const attachments = dn.attachments || [];

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-16">
            <Header page="delivery-note-details" />

            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/delivery-note-list" className="cursor-pointer hover:text-blue-600">Delivery Notes</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">{dn.deliveryNoteCode || `DN #${dn.deliveryNoteId}`}</span>
                </nav>
            </div>

            <div className="px-6 py-4 space-y-6 max-w-7xl mx-auto">
                {/* Header card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition cursor-pointer"
                                title="Back"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                    {dn.deliveryNoteCode || `Delivery Note #${dn.deliveryNoteId}`}
                                </h1>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Delivered on <span className="font-medium text-gray-700">{formatDate(dn.deliveryDate)}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Delivery Information */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-600" />
                            Delivery Information
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500 block text-xs font-semibold uppercase tracking-wider mb-1">
                                    Customer
                                </span>
                                <span
                                    className="text-blue-600 font-semibold cursor-pointer hover:underline"
                                    onClick={() => dn.customerId && setSelectedCustomerId(dn.customerId)}
                                >
                                    {dn.customerName || "—"}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-xs font-semibold uppercase tracking-wider mb-1">
                                    Order Number
                                </span>
                                <span className="font-semibold text-gray-800">
                                    {dn.orderCode || "—"}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-xs font-semibold uppercase tracking-wider mb-1">
                                    Receiver Name
                                </span>
                                <span className="font-semibold text-gray-800">
                                    {dn.receiverName || "—"}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-xs font-semibold uppercase tracking-wider mb-1">
                                    Delivery Date
                                </span>
                                <span className="font-semibold text-gray-800">
                                    {formatDate(dn.deliveryDate)}
                                </span>
                            </div>
                            <div className="sm:col-span-2">
                                <span className="text-gray-500 block text-xs font-semibold uppercase tracking-wider mb-1">
                                    Billing Address
                                </span>
                                <span className="text-gray-800 leading-relaxed">
                                    {dn.billingAddress || "—"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Company & Audit Info */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            Company & Audit Info
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500 block text-xs font-semibold uppercase tracking-wider mb-1">
                                    Company
                                </span>
                                <span className="font-semibold text-gray-800">
                                    {dn.companyName || "—"}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500 block text-xs font-semibold uppercase tracking-wider mb-1">
                                    Created By
                                </span>
                                <span className="font-semibold text-gray-800">
                                    {dn.addedByName || "—"}
                                </span>
                            </div>
                            <div className="sm:col-span-2">
                                <span className="text-gray-500 block text-xs font-semibold uppercase tracking-wider mb-1">
                                    Created Date
                                </span>
                                <span className="font-semibold text-gray-800">
                                    {formatDate(dn.addedDate)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                    <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
                        Delivered Items
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-700">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-600 border-b border-gray-200">
                                <tr>
                                    <th className="py-3 px-4 w-16">#</th>
                                    <th className="py-3 px-4">Item</th>
                                    <th className="py-3 px-4 text-right">Requested Qty</th>
                                    <th className="py-3 px-4 text-right">Pending Qty (before this note)</th>
                                    <th className="py-3 px-4 text-right">Delivered Qty (this note)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-gray-400">
                                            No items recorded.
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((it, idx) => (
                                        <tr key={it.deliveryNoteItemId || idx} className="hover:bg-gray-50/50">
                                            <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{idx + 1}</td>
                                            <td className="py-3.5 px-4 font-semibold text-gray-900">
                                                {it.description || it.itemName || "-"}
                                                {it.itemCode && (
                                                    <span className="block text-xs text-gray-400 font-normal">
                                                        Code: {it.itemCode}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-medium text-gray-700">
                                                {it.requestedQuantity != null ? Number(it.requestedQuantity).toLocaleString() : "-"}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-medium text-amber-600">
                                                {it.pendingQuantity != null ? Number(it.pendingQuantity).toLocaleString() : "-"}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-bold text-blue-600">
                                                {it.deliverQuantity != null ? Number(it.deliverQuantity).toLocaleString() : "-"}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Media Section: Receiver Image, Signature, Attachments */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Receiver Image */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                            Receiver Image
                        </h3>
                        {dn.receiverImage ? (
                            <div
                                onClick={() => setPreviewModal({ open: true, url: getImageUrl(dn.receiverImage), type: "image" })}
                                className="w-full h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer hover:shadow-md transition relative group"
                            >
                                <img
                                    src={getImageUrl(dn.receiverImage)}
                                    alt="Receiver"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <div className="h-8 w-8 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                                        <Eye className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 py-8 text-center italic">No receiver image uploaded</p>
                        )}
                    </div>

                    {/* Receiver Signature */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                            Receiver Signature
                        </h3>
                        {dn.receiverSignature ? (
                            <div
                                onClick={() => setPreviewModal({ open: true, url: getImageUrl(dn.receiverSignature), type: "image" })}
                                className="w-full h-40 rounded-xl overflow-hidden border border-gray-200 bg-white p-2 flex items-center justify-center cursor-pointer hover:shadow-md transition relative group"
                            >
                                <img
                                    src={getImageUrl(dn.receiverSignature)}
                                    alt="Receiver Signature"
                                    className="max-h-full max-w-full object-contain"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <div className="h-8 w-8 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                                        <Eye className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 py-8 text-center italic">No signature recorded</p>
                        )}
                    </div>

                    {/* Receiver Attachments */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
                        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">
                            Receiver Attachments ({attachments.length})
                        </h3>
                        {attachments.length > 0 ? (
                            <div className="flex flex-wrap gap-2.5 max-h-40 overflow-y-auto">
                                {attachments.map((att, idx) => (
                                    <AttachmentThumb
                                        key={att.deliveryNoteAttachmentId || idx}
                                        url={att.fileUrl || att.url}
                                        onClick={(url, type) => setPreviewModal({ open: true, url, type })}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 py-8 text-center italic">No attachments uploaded</p>
                        )}
                    </div>
                </div>
            </div>

            {previewModal.open && (
                <AttachmentPreviewModal
                    isOpen={previewModal.open}
                    onClose={() => setPreviewModal({ open: false, url: "", type: "" })}
                    url={previewModal.url}
                    type={previewModal.type}
                />
            )}

            {selectedCustomerId && typeof document !== "undefined" && createPortal(
                <CustomerSidePanel
                    customerId={selectedCustomerId}
                    onClose={() => setSelectedCustomerId(null)}
                />,
                document.body
            )}
        </div>
    );
}
