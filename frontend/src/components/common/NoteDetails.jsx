"use client";
/* eslint-disable react-hooks/set-state-in-effect */

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
import { FileText, Eye, Download } from "lucide-react";
import AttachmentPreviewModal from "../ui/AttachmentPreviewModal";
import UserSidePanel from "../user/UserSidePanel";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import DetailsSidePanel from "../DetailsSidePanel";
import { itemSidePanelConfig } from "../item/configs/itemSidePanel.config";
import { formatTaxCalcLabel } from "@/lib/itemTaxCalc";

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
    if (!status) return "inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700";
    const s = String(status).toLowerCase();
    if (s === "submitted") return "inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700";
    if (s === "approved") return "inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
    if (s === "rejected") return "inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
    return "inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700";
}

function AttachmentThumb({ url, onClick }) {
    const ext = url?.split(".").pop()?.toLowerCase();
    const isPdf = ext === "pdf";
    const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}${url}`;

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
            <span className="text-[9px] font-bold uppercase text-blue-600 mt-0.5">{ext}</span>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                <div className="h-6 w-6 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                    <Eye className="h-3 w-3" />
                </div>
            </div>
        </div>
    );
}

export default function NoteDetails({ id, config }) {
    const qtyDecimals = Number.isFinite(parseInt(process.env.NEXT_PUBLIC_DECIMAL_ALLOWED, 10))
        ? parseInt(process.env.NEXT_PUBLIC_DECIMAL_ALLOWED, 10)
        : 2;
    const priceDecimals = Number.isFinite(parseInt(process.env.NEXT_PUBLIC_PRICE_DECIMAL_ALLOWED, 10))
        ? parseInt(process.env.NEXT_PUBLIC_PRICE_DECIMAL_ALLOWED, 10)
        : 4;

    const router = useRouter();
    const { can } = useContext(loginContext) || {};
    const [note, setNote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewType, setPreviewType] = useState("image");
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);
    const [selectedCustomerPanelId, setSelectedCustomerPanelId] = useState(null);
    const [selectedItemId, setSelectedItemId] = useState(null);

    const fetchNote = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `${config.fetchEndpoint}/${id}`,
                    module: config.module,
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.id) {
                setNote(data);
            } else {
                setNote(null);
            }
        } catch (err) {
            console.error(err);
            setNote(null);
        } finally {
            setLoading(false);
        }
    }, [id, config.fetchEndpoint, config.module]);

    useEffect(() => {
        fetchNote();
    }, [fetchNote]);

    const fmt = (n) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page={config.headerPage} />
                <div className="flex items-center justify-center py-20">
                    <Loader label={`Loading ${config.label.toLowerCase()} details...`} />
                </div>
            </div>
        );
    }

    if (!note) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page={config.headerPage} />
                <div className="p-8 text-red-500 text-lg font-semibold">
                    {config.label} not found.
                </div>
            </div>
        );
    }

    const code = note[config.codeKey];
    const pdfPath = note[config.pdfPathKey];

    return (
        <div className="min-h-screen bg-[#f5f6f8] text-gray-800">
            <Header page={config.headerPage} />

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 pb-20">
                {/* Breadcrumbs */}
                <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600 hover:underline">
                        Home
                    </Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href={config.listRoute} className="cursor-pointer hover:text-blue-600 hover:underline">
                        {config.pluralLabel}
                    </Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Details</span>
                </nav>

                {/* Title + action buttons */}
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">
                        Details
                    </h1>
                    <div className="flex items-center gap-4">
                        {pdfPath && (
                            <>
                                <button
                                    onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}${pdfPath}`, "_blank")}
                                    className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 active:scale-[0.98] cursor-pointer gap-2"
                                    title="View PDF"
                                >
                                    <Eye className="h-4 w-4" />
                                    View PDF
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                            const { downloadFile } = await import("@/lib/utils");
                                            await downloadFile(pdfPath, `${config.pdfFilePrefix}${code ?? note.id}.pdf`);
                                        } catch {
                                            toast.error("Failed to download PDF", { position: "top-right" });
                                        }
                                    }}
                                    className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-6 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 active:scale-[0.98] cursor-pointer gap-2"
                                    title="Download PDF"
                                >
                                    <Download className="h-4 w-4" />
                                    Download PDF
                                </button>
                            </>
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
                    <div className="col-span-12 sm:col-span-2">
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
                            <div className="border-b pb-5">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    {code || "N/A"}
                                </h2>
                                <div className="mt-3">
                                    <span className={statusBadge(note.status)}>
                                        {note.status || "N/A"}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-6 space-y-3">
                                <button className="w-full rounded-xl px-4 py-3 text-left font-medium transition bg-gray-600 text-white">
                                    Summary
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="col-span-12 lg:col-span-10">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                            
                            {/* Column 1: Info & Narration */}
                            <div className="lg:col-span-3 space-y-6">
                                {/* Note Info card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-4 border-b pb-5 mb-6">
                                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-50 shadow-md">
                                            <span className="text-2xl font-bold text-blue-600 uppercase">
                                                {config.shortCode}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-xl font-semibold text-gray-800 truncate">
                                                {config.label} Info
                                            </h2>
                                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                                                {code || "N/A"}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 text-[15px]">
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">{config.shortCode} Code</p>
                                            <p className="font-mono text-blue-600 font-medium">{code || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Customer</p>
                                            <p
                                                className="font-medium text-blue-600 hover:underline cursor-pointer"
                                                onClick={() => note.customerId && setSelectedCustomerPanelId(note.customerId)}
                                            >
                                                {note.customerName || "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Invoice</p>
                                            <p className="font-medium text-gray-800">{note.invoiceCode || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Currency</p>
                                            <p className="font-medium text-gray-800">{note.currencyCode || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Customer Charges</p>
                                            <p className="font-medium text-gray-800">{note.customerCharges?.replace(/_/g, " ") || "-"}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Tax Calculation</p>
                                            <p className="font-medium text-gray-800">{note.taxCalculation || "-"}</p>
                                        </div>
                                        {note.taxGroupName && (
                                            <div className="grid grid-cols-2">
                                                <p className="text-gray-500">Tax Group</p>
                                                <p className="font-medium text-gray-800">{`${note.taxGroupName} (${note.taxGroupValue}%)`}</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Status</p>
                                            <div>
                                                <span className={statusBadge(note.status)}>
                                                    {note.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Approval Status</p>
                                            <div>
                                                <span className={statusBadge(note.approvalStatus)}>
                                                    {note.approvalStatus || "—"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Narration */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col h-[204px]">
                                    <h3 className="mb-5 text-xl font-semibold text-gray-800">Narration</h3>
                                    <div className="flex-1 overflow-y-auto">
                                        {note.narration ? (
                                            <p className="text-sm text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
                                                {note.narration}
                                            </p>
                                        ) : (
                                            <p className="flex h-full items-center justify-center text-sm text-gray-400 italic">No narration provided.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Audit Logs, Amounts, Attachments */}
                            <div className="lg:col-span-3 space-y-6">
                                {/* Audit Card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-5 text-xl font-semibold text-gray-800">Audit Logs</h3>
                                    <div className="space-y-4 text-[15px]">
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Added By</p>
                                            <p className="font-medium text-gray-800">
                                                {note.addedByName ? (
                                                    <span
                                                        className="text-blue-600 cursor-pointer hover:underline"
                                                        onClick={() => setSelectedUserPanelId(note.addedBy)}
                                                    >
                                                        {note.addedByName}
                                                    </span>
                                                ) : "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Added Date</p>
                                            <p className="font-medium text-gray-800">{formatDate(note.addedDate)}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Updated By</p>
                                            <p className="font-medium text-gray-800">
                                                {note.updatedByName ? (
                                                    <span
                                                        className="text-blue-600 cursor-pointer hover:underline"
                                                        onClick={() => setSelectedUserPanelId(note.updatedBy)}
                                                    >
                                                        {note.updatedByName}
                                                    </span>
                                                ) : "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Updated Date</p>
                                            <p className="font-medium text-gray-800">{formatDate(note.updatedDate)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Amounts breakdown */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-5 text-xl font-semibold text-gray-800">Amounts</h3>
                                    <div className="space-y-4 text-[15px]">
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Total Amount</p>
                                            <p className="font-medium text-gray-800">{note.currencyCode} {fmt(note.totalAmount)}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Tax Amount</p>
                                            <p className="font-medium text-gray-800">{note.currencyCode} {fmt(note.taxAmount)}</p>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-700 font-bold">Final Amount</p>
                                            <p className="text-blue-600 font-bold text-lg">{note.currencyCode} {fmt(note.finalAmount)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Attachments */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <h3 className="mb-5 text-xl font-semibold text-gray-800">Attachments</h3>
                                    <div>
                                        {(note.attachments ?? []).length === 0 ? (
                                            <p className="text-sm text-gray-400 italic">No attachments.</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-4">
                                                {note.attachments.filter((a) => a.status !== "Inactive").map((att, i) => (
                                                    <AttachmentThumb
                                                        key={att.id ?? i}
                                                        url={att.attachmentUrl}
                                                        onClick={(url, type) => { setPreviewUrl(url); setPreviewType(type); }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Item(s) card */}
                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                                    Item(s)
                                </h3>
                                <div className="text-xs font-medium text-gray-500">
                                    Total {(note.items ?? []).length} item(s)
                                </div>
                            </div>
                            <div className="overflow-x-auto w-full">
                                <table className="w-full min-w-[1000px] border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="w-12 px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                                            <th className="min-w-[200px] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                                            <th className="min-w-[90px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                                            <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Price</th>
                                            <th className="min-w-[130px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                                            <th className="min-w-[110px] px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax Calc.</th>
                                            <th className="min-w-[120px] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax Group</th>
                                            <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax Amount</th>
                                            <th className="min-w-[140px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Final Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {(note.items ?? []).length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="py-12 text-center text-gray-400">
                                                    No items
                                                </td>
                                            </tr>
                                        ) : (
                                            (note.items ?? []).map((item, idx) => (
                                                <tr key={item[config.itemIdKey] ?? idx} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="w-12 px-4 py-3.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                                                    <td className="min-w-[200px] px-4 py-3.5 text-left">
                                                        {item.itemId ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedItemId(item.item?.itemId ?? item.itemId)}
                                                                    className="font-semibold text-blue-600 hover:text-blue-800 hover:underline break-words text-left bg-transparent border-none p-0 cursor-pointer"
                                                                >
                                                                    {item.item?.itemName ?? item.itemCode ?? item.item?.itemCode ?? "—"}
                                                                </button>
                                                                <p className="text-xs text-gray-400 mt-0.5">{item.item?.itemCode ?? item.itemCode ?? ""}</p>
                                                            </>
                                                        ) : (
                                                            <span className="font-semibold text-gray-800 break-words">{item.description ?? "—"}</span>
                                                        )}
                                                    </td>
                                                    <td className="min-w-[90px] px-4 py-3.5 text-right font-medium text-gray-800 whitespace-nowrap">
                                                        {Number(item.quantity ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: qtyDecimals })}
                                                    </td>
                                                    <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">
                                                        {note.currencySymbol ?? ""}{Number(item.unitPrice ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}
                                                    </td>
                                                    <td className="min-w-[130px] px-4 py-3.5 text-right whitespace-nowrap font-medium text-gray-800">
                                                        {note.currencySymbol ? `${note.currencySymbol} ` : ""}{Number(item.totalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}
                                                    </td>
                                                    <td className="min-w-[110px] px-4 py-3.5 text-center whitespace-nowrap">
                                                        <span className="px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600">
                                                            {formatTaxCalcLabel(item.taxCalculation)}
                                                        </span>
                                                    </td>
                                                    <td className="min-w-[120px] px-4 py-3.5 text-left text-sm text-gray-600 whitespace-nowrap">
                                                        {item.taxGroup ?? "—"}
                                                    </td>
                                                    <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">
                                                        {note.currencySymbol ? `${note.currencySymbol} ` : ""}{Number(item.taxAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}
                                                    </td>
                                                    <td className="min-w-[140px] px-4 py-3.5 text-right whitespace-nowrap font-bold text-gray-900">
                                                        {note.currencySymbol ? `${note.currencySymbol} ` : ""}{Number(item.finalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
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

            {selectedCustomerPanelId && typeof document !== "undefined" && createPortal(
                <CustomerSidePanel customerId={selectedCustomerPanelId} onClose={() => setSelectedCustomerPanelId(null)} />,
                document.body
            )}
        </div>
    );
}
