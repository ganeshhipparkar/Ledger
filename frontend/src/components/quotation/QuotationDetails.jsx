"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import {
    LayoutList, GitBranch,
    ChevronLeft, ChevronRight, Edit2, CheckCircle,
    RefreshCw, Copy, ClipboardList, Paperclip, FileText, Eye,
} from "lucide-react";
import Header from "../Header";
import Loader from "../ui/Loader";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import QuotationSummaryPanel from "./QuotationSummaryPanel";
import AttachmentPreviewModal from "../ui/AttachmentPreviewModal";
import { getImageUrl } from "@/lib/utils";

const MySwal = withReactContent(Swal);

const STATUS_COLORS = {
    DRAFT: "bg-amber-100 text-amber-700 border-amber-200",
    SUBMITTED: "bg-blue-100 text-blue-700 border-blue-200",
    CONFIRMED: "bg-green-100 text-green-700 border-green-200",
    CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
    CANCELLED: "bg-red-100 text-red-600 border-red-200",
    EXPIRED: "bg-orange-100 text-orange-600 border-orange-200",
};

const STATUS_LABELS = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    CONFIRMED: "Confirmed",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
};

function StatusBadge({ status }) {
    const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
    const label = STATUS_LABELS[status] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "—");
    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${cls}`}>
            {label}
        </span>
    );
}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmount(n, symbol) {
    if (n == null) return "—";
    return `${symbol ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

const NAV_ITEMS = [
    { key: "summary", label: "Summary", Icon: LayoutList },
    { key: "versions", label: "Versions", Icon: GitBranch },
];

export default function QuotationDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext) || {};

    const [quotation, setQuotation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("summary");
    const [sidebarExpanded, setSidebarExpanded] = useState(true);
    const [tcPreviewUrl, setTcPreviewUrl] = useState("");

    const fetchDetails = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: { ...authHeaders(), endpoint: `quotation-details/${id}`, module: "quotation" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (!data?.quotationId) {
                toast.error("Quotation not found.", { position: "top-right" });
                router.push("/quotation-list");
                return;
            }
            setQuotation(data);
        } catch (err) {
            toast.error(`Error: ${err.message}`, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchDetails(); }, [fetchDetails]);

    const handleStatusUpdate = async (newStatus) => {
        const label = newStatus === "CONFIRMED" ? "Confirm" : newStatus === "SUBMITTED" ? "Submit" : newStatus;
        const result = await MySwal.fire({
            title: `${label} this quotation?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: label,
            confirmButtonColor: newStatus === "CONFIRMED" ? "#16a34a" : "#2563eb",
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: { ...authHeaders(), endpoint: "quotation-update", module: "quotation", "Content-Type": "application/json" },
                body: JSON.stringify({ quotationId: id, status: newStatus }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success(`Quotation ${label.toLowerCase()}ed.`, { position: "top-right" });
                fetchDetails();
            } else {
                toast.error(data?.message || "Failed to update.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
                <Loader label="Loading quotation..." />
            </div>
        );
    }

    if (!quotation) return null;

    const q = quotation;
    const versions = q.versionHistory ?? [];

    const isLatestVersion = q.parentQuotationId == null;

    const qDiscount = q.discount ?? (q.discounts || q.quotationDiscounts || []).reduce((s, d) => s + (parseFloat(d.discountPrice ?? d.amount) || 0), 0);
    const qExtraCharge = q.extraCharge ?? (q.extraCharges || q.quotationExtraCharges || []).reduce((s, ec) => s + (parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0), 0);

    const staticTotals = {
        grossAmount: q.totalAmount,
        taxableAmount: q.taxableAmount,
        taxAmount: q.taxAmount,
        nonTaxableAmount: (q.totalAmount ?? 0) - (q.taxableAmount ?? 0),
        qDiscount,
        qExtraCharge,
        netAmount: q.netAmount,
        vatWithheldAmount: q.vatWithheldAmount ?? 0,
        finalAmount: q.finalAmount,
    };

    return (
        <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
            <Header page="quotation-details" />

            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/quotation-list")}>Quotations</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">{q.quotationNumber ?? `#${id}`}</span>
                </nav>
            </div>

            <div className="px-6 pb-3">
                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">
                            <InfoCard label="Quotation No." value={q.quotationNumber ?? `#${id}`} mono />
                            <InfoCard
                                label="Customer"
                                value={q.customerName ?? "—"}
                                badge={q.currencyCode}
                            />
                            <InfoCard label="Issue Date" value={fmtDate(q.issueDate)} />
                            <InfoCard label="Expiry Date" value={fmtDate(q.expiryDate)} />
                            <InfoCard label="Status" value={<StatusBadge status={q.status} />} />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-start lg:justify-end">
                            {isLatestVersion && (
                                <>
                                    {q.status === "DRAFT" && can?.("quotationUpdate") && (
                                        <>
                                            <ActionBtn
                                                onClick={() => router.push(`/quotation/${id}?edit=true`)}
                                                icon={<Edit2 className="h-4 w-4" />}
                                                label="Edit"
                                                variant="amber"
                                            />
                                            <ActionBtn
                                                onClick={() => handleStatusUpdate("SUBMITTED")}
                                                icon={<ClipboardList className="h-4 w-4" />}
                                                label="Submit"
                                                variant="blue"
                                            />
                                        </>
                                    )}
                                    {q.status === "SUBMITTED" && can?.("quotationUpdate") && (
                                        <>
                                            <ActionBtn
                                                onClick={() => router.push(`/add-quotation?changeFrom=${id}`)}
                                                icon={<RefreshCw className="h-4 w-4" />}
                                                label="Change Quotation"
                                                variant="outline"
                                            />
                                            <ActionBtn
                                                onClick={() => handleStatusUpdate("CONFIRMED")}
                                                icon={<CheckCircle className="h-4 w-4" />}
                                                label="Confirm"
                                                variant="green"
                                            />
                                        </>
                                    )}
                                    {q.status === "CONFIRMED" && can?.("orderAdd") && (
                                        <ActionBtn
                                            onClick={() => router.push(`/add-order?quotationId=${id}`)}
                                            icon={<Copy className="h-4 w-4" />}
                                            label="Convert to Order"
                                            variant="outline"
                                        />
                                    )}
                                    {can?.("quotationAdd") && (
                                        <ActionBtn
                                            onClick={() => router.push(`/add-quotation?cloneFrom=${id}`)}
                                            icon={<Copy className="h-4 w-4" />}
                                            label="Clone Quotation"
                                            variant="outline"
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 gap-4 px-6 pb-8">
                <div className={`shrink-0 transition-all duration-200 ${sidebarExpanded ? "w-44" : "w-12"}`}>
                    <div className="sticky top-4 rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                        {/* Toggle button */}
                        <button
                            type="button"
                            onClick={() => setSidebarExpanded(!sidebarExpanded)}
                            className="w-full flex items-center justify-center py-2.5 border-b border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                        >
                            {sidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>

                        {NAV_ITEMS.map(({ key, label, Icon }) => {
                            const badge = key === "versions" ? versions.length : 0;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setActiveTab(key)}
                                    className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium transition cursor-pointer ${activeTab === key
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-600 hover:bg-gray-50"
                                        }`}
                                    title={label}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {sidebarExpanded && (
                                        <span className="flex items-center gap-1.5 truncate">
                                            {label}
                                            {badge !== "" && badge > 0 && (
                                                <span className={`ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5 ${activeTab === key ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                                                    }`}>
                                                    {badge}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    {activeTab === "summary" && (
                        <div className="space-y-6">
                            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                        <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                                        Item(s)
                                    </h3>
                                    <div className="text-xs font-medium text-gray-500">
                                        Total {q.quotationItems?.length ?? 0} item(s)
                                    </div>
                                </div>
                                <div className="overflow-x-auto w-full">
                                    <table className="w-full min-w-[1300px] border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="w-12 px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                                                <th className="min-w-[200px] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                                                <th className="min-w-[90px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                                                <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Price</th>
                                                <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Discount</th>
                                                <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Extra Charge</th>
                                                <th className="min-w-[130px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                                                <th className="min-w-[110px] px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax Calc.</th>
                                                <th className="min-w-[120px] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax Group</th>
                                                <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax Amount</th>
                                                <th className="min-w-[140px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Final Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {(q.quotationItems ?? []).map((item, idx) => {
                                                const itemDiscountTotal = item.discountTotal ?? (item.discounts || []).reduce((s, d) => s + (parseFloat(d.discountPrice ?? d.amount) || 0), 0);
                                                const itemExtraChargeTotal = item.extraChargeTotal ?? (item.extraCharges || []).reduce((s, ec) => s + (parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0), 0);
                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="w-12 px-4 py-3.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                                                        <td className="min-w-[200px] px-4 py-3.5 text-left">
                                                            <a href={`/item/${item.itemId}`} className="font-semibold text-blue-600 hover:text-blue-800 hover:underline break-words">
                                                                {item.item?.itemName ?? item.itemCode ?? "—"}
                                                            </a>
                                                            <p className="text-xs text-gray-400 mt-0.5">{item.itemCode ?? item.item?.itemCode ?? ""}</p>
                                                        </td>
                                                        <td className="min-w-[90px] px-4 py-3.5 text-right font-medium text-gray-800 whitespace-nowrap">{item.quantity}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{Number(item.unitPrice ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{Number(itemDiscountTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{Number(itemExtraChargeTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                        <td className="min-w-[130px] px-4 py-3.5 text-right whitespace-nowrap font-medium text-gray-800">{Number(item.totalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                        <td className="min-w-[110px] px-4 py-3.5 text-center whitespace-nowrap">
                                                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600"}`}>
                                                                {item.taxCalculation ?? "N/A"}
                                                            </span>
                                                        </td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-left text-sm text-gray-600 whitespace-nowrap">{item.taxGroup ?? "—"}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{Number(item.taxAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                        <td className="min-w-[140px] px-4 py-3.5 text-right whitespace-nowrap font-bold text-gray-900">{Number(item.finalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                <div className="lg:col-span-7 space-y-5">
                                    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                            <ReadField label="VAT Withheld" value={q.vatWithheld ?? "NO"} />
                                            <ReadField label="Sales Person" value={q.salesPersonName ?? "—"} />
                                            <ReadField label="Added By" value={q.addedByName ?? "—"} />
                                        </div>
                                    </div>

                                    {/* Remarks */}
                                    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                            <span className="text-gray-400">☰</span> Remarks
                                        </h4>
                                        {q.remarks ? (
                                            <p className="text-sm text-gray-600 whitespace-pre-line">{q.remarks}</p>
                                        ) : (
                                            <div className="py-6 text-center text-gray-400 text-sm">No Remarks found.</div>
                                        )}
                                    </div>

                                    {q.additionalInformation && (
                                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="text-gray-400">☰</span> Additional Information
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                {typeof q.additionalInformation === "object" ? (
                                                    Object.entries(q.additionalInformation).map(([k, v]) => (
                                                        <ReadField key={k} label={k} value={String(v)} />
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-gray-600">{String(q.additionalInformation)}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Terms and Conditions</h4>
                                        {q.termsConditionsFile ? (
                                            <div
                                                onClick={() => setTcPreviewUrl(getImageUrl(q.termsConditionsFile))}
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
                                        ) : q.termsConditionsText ? (
                                            <div
                                                className="prose prose-sm max-w-none text-gray-700"
                                                dangerouslySetInnerHTML={{ __html: q.termsConditionsText }}
                                            />
                                        ) : (
                                            <p className="text-sm text-gray-400">No terms and conditions attached.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="lg:col-span-5 space-y-6">
                                    <QuotationSummaryPanel
                                        readOnly
                                        quotationDiscounts={q.discounts || q.quotationDiscounts || []}
                                        quotationExtraCharges={q.extraCharges || q.quotationExtraCharges || []}
                                        currencyCode={q.currencyCode ?? ""}
                                        currencySymbol={q.currencySymbol ?? ""}
                                        vatWithheld={q.vatWithheld ?? "NO"}
                                        existingAttachments={q.attachments ?? []}
                                        staticTotals={staticTotals}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "versions" && (
                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100">
                                <h3 className="text-base font-semibold text-gray-800">
                                    Version History <span className="text-gray-400 font-normal">({versions.length} older version{versions.length !== 1 ? "s" : ""})</span>
                                </h3>
                            </div>
                            {versions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <GitBranch className="h-10 w-10 opacity-30 mb-2" />
                                    <p className="text-sm">No previous versions found.</p>
                                    <p className="text-xs mt-1 text-gray-300">Use "Change Quotation" on a Submitted quotation to create versions.</p>
                                </div>
                            ) : (
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            {["Version Code", "Issue Date", "Expiry Date", "Added By", "Final Amount", "Status"].map((h) => (
                                                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {versions.map((v) => (
                                            <tr key={v.quotationId} className="hover:bg-gray-50/50">
                                                <td className="px-5 py-3">
                                                    <a href={`/quotation/${v.quotationId}`} className="font-semibold text-blue-600 hover:underline">
                                                        {v.versionCode ?? `#${v.quotationId}`}
                                                    </a>
                                                </td>
                                                <td className="px-5 py-3 text-gray-600">{fmtDate(v.issueDate)}</td>
                                                <td className="px-5 py-3 text-gray-600">{fmtDate(v.expiryDate)}</td>
                                                <td className="px-5 py-3 text-gray-600">{v.addedByName ?? "—"}</td>
                                                <td className="px-5 py-3 font-semibold text-gray-800">{fmtAmount(v.finalAmount, v.currencySymbol ?? v.currencyCode)}</td>
                                                <td className="px-5 py-3"><StatusBadge status={v.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <AttachmentPreviewModal
                open={!!tcPreviewUrl}
                onClose={() => setTcPreviewUrl("")}
                fileUrl={tcPreviewUrl}
                fileType="pdf"
            />
        </div>
    );
}

function InfoCard({ label, value, mono = false, badge }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 w-full min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`text-sm font-semibold text-gray-800 ${mono ? "font-mono" : ""} truncate`}>{value}</span>
                {badge && (
                    <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold shrink-0">{badge}</span>
                )}
            </div>
        </div>
    );
}

function ActionBtn({ onClick, icon, label, variant = "blue" }) {
    const VARIANTS = {
        blue: "bg-blue-600 text-white hover:bg-blue-700",
        green: "bg-green-600 text-white hover:bg-green-700",
        amber: "bg-amber-500 text-white hover:bg-amber-600",
        outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition cursor-pointer ${VARIANTS[variant] ?? VARIANTS.outline}`}
        >
            {icon} {label}
        </button>
    );
}

function ReadField({ label, value }) {
    return (
        <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-sm text-gray-800 font-medium mt-0.5">{value}</p>
        </div>
    );
}
