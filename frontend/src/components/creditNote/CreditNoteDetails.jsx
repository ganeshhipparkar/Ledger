"use client";

import Link from "next/link";
import { useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Header from "../Header";
import Loader from "../ui/Loader";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import { getImageUrl } from "@/lib/utils";
import { FileText } from "lucide-react";
import { CreditNoteStatusBadge } from "./CreditNoteList";
import AttachmentPreviewModal from "../ui/AttachmentPreviewModal";

function ReadField({ label, value }) {
    return (
        <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-sm text-gray-800 font-medium mt-0.5">{value || "—"}</p>
        </div>
    );
}

function AttachmentThumb({ url, onClick }) {
    const ext = url?.split(".").pop()?.toLowerCase();
    const isPdf = ext === "pdf";
    const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}${url}`;

    return (
        <div
            onClick={() => onClick?.(fullUrl, isPdf ? "pdf" : "image")}
            className="w-16 h-16 rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition group"
        >
            <FileText className="h-6 w-6 text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold uppercase text-blue-600 mt-0.5">{isPdf ? "PDF" : ext}</span>
        </div>
    );
}

export default function CreditNoteDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext) || {};
    const [creditNote, setCreditNote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewType, setPreviewType] = useState("image");

    const fetchDetails = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `credit-note-details/${id}`,
                    module: "credit-note",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.id) {
                setCreditNote(data);
            } else {
                setError(data?.message || "Credit note not found");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchDetails(); }, [fetchDetails]);

    const fmt = (n) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

    return (
        <div className="min-h-screen bg-[#f5f6fa]">
            <Header page="credit-note-details" />

            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/credit-note-list" className="cursor-pointer hover:text-blue-600">Credit Notes</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Details</span>
                </nav>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-1 mt-2">
                    <h1 className="text-2xl font-semibold text-[#1f2937]">Credit Note</h1>
                </div>
            </div>

            {loading && <div className="flex justify-center py-16"><Loader label="Loading credit note..." /></div>}
            {!loading && error && <p className="text-center text-red-500 py-12">{error}</p>}

            {!loading && !error && creditNote && (
                <div className="px-6 pb-8 space-y-6">
                    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 w-full">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">CN Code</p>
                                    <span className="text-sm font-semibold text-gray-800 font-mono">{creditNote.creditNoteCode}</span>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 w-full">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Customer</p>
                                    <span className="text-sm font-semibold text-gray-800">{creditNote.customerName || "—"}</span>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 w-full">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Invoice</p>
                                    <span className="text-sm font-semibold text-gray-800">{creditNote.invoiceCode || "—"}</span>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 w-full">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</p>
                                    <CreditNoteStatusBadge status={creditNote.status} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-5">
                            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                <h4 className="text-sm font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">Credit Note Info</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <ReadField label="CN Code" value={creditNote.creditNoteCode} />
                                    <ReadField label="Customer" value={creditNote.customerName} />
                                    <ReadField label="Invoice" value={creditNote.invoiceCode} />
                                    <ReadField label="Currency" value={creditNote.currencyCode} />
                                    <ReadField label="Customer Charges" value={creditNote.customerCharges?.replace(/_/g, " ")} />
                                    <ReadField label="Tax Calculation" value={creditNote.taxCalculation} />
                                    {creditNote.taxGroupName && <ReadField label="Tax Group" value={`${creditNote.taxGroupName} (${creditNote.taxGroupValue}%)`} />}
                                    <ReadField label="Status" value={creditNote.status} />
                                    <ReadField label="Approval Status" value={creditNote.approvalStatus || "—"} />
                                    <ReadField label="Added By" value={creditNote.addedByName} />
                                    <ReadField
                                        label="Added Date"
                                        value={creditNote.addedDate ? new Date(creditNote.addedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null}
                                    />
                                </div>
                            </div>

                            {creditNote.narration && (
                                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Narration</h4>
                                    <p className="text-sm text-gray-600 whitespace-pre-line">{creditNote.narration}</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-5">
                            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                <h4 className="text-sm font-semibold text-gray-700 mb-4 border-b border-gray-100 pb-2">Amounts</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Total Amount</span>
                                        <span className="font-medium text-gray-800">{creditNote.currencyCode} {fmt(creditNote.totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Tax Amount</span>
                                        <span className="font-medium text-gray-800">{creditNote.currencyCode} {fmt(creditNote.taxAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-semibold text-gray-800 border-t border-gray-100 pt-2">
                                        <span>Final Amount</span>
                                        <span>{creditNote.currencyCode} {fmt(creditNote.finalAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Attachments</h4>
                                {(creditNote.attachments ?? []).length === 0 ? (
                                    <p className="text-sm text-gray-400">No attachments.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-3">
                                        {creditNote.attachments.filter((a) => a.status !== "Inactive").map((att, i) => (
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
            )}

            <AttachmentPreviewModal
                open={!!previewUrl}
                onClose={() => setPreviewUrl("")}
                fileUrl={previewUrl}
                fileType={previewType}
            />
        </div>
    );
}
