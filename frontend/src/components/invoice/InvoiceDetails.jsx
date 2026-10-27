"use client";
import Link from "next/link";

import { useContext, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import {
    LayoutList,
    ChevronLeft, ChevronRight, Edit2, CheckCircle, ChevronDown,
    RefreshCw, Copy, ClipboardList, Eye, Download, Activity, FileText, Trash2, Wallet, FileMinus, FilePlus
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InvoicePaymentsTab from "./InvoicePaymentsTab";
import Header from "../Header";
import Loader from "../ui/Loader";
import AppPagination from "../ui/AppPagination";
import TabFilterPanel from "../common/TabFilterPanel";
import EmbeddedTable from "../common/EmbeddedRelatedTable";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import ActionButtonGroup from "../shared/ActionButtonGroup";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import InvoiceSummaryPanel from "./InvoiceSummaryPanel";
import AttachmentPreviewModal from "../ui/AttachmentPreviewModal";
import { getImageUrl, formatDisplayDate, downloadFile } from "@/lib/utils";
import { createPortal } from "react-dom";
import UserSidePanel from "../user/UserSidePanel";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import DetailsSidePanel from "../DetailsSidePanel";
import { itemSidePanelConfig } from "../item/configs/itemSidePanel.config";
import { taxGroupSidePanelConfig } from "../taxGroup/configs/taxGroupSidePanel.config";
import ActivityTimeline from "@/components/activity/ActivityTimeline";
import { formatTaxCalcLabel } from "@/lib/itemTaxCalc";
import NoteAddPanel from "../notes/NoteAddPanel";
import { handleCreditNoteAddNavigation } from "@/lib/useCreditNoteNavigation";
import { handleDebitNoteAddNavigation } from "@/lib/useDebitNoteNavigation";
import { getCreditNoteMode } from "@/lib/creditNoteMode";
import { creditNoteSidePanelConfig } from "../creditNote/configs/creditNoteSidePanel.config";
import { debitNoteSidePanelConfig } from "../debitNote/configs/debitNoteSidePanel.config";
import { paymentTransactionSidePanelConfig } from "../paymentTransaction/configs/paymentTransactionSidePanelConfig";

import { FaRegFilePdf } from "react-icons/fa";
import { STATUS_COLORS, STATUS_LABELS } from "./InvoiceList";
import InvoiceDueDatePanel from "./InvoiceDueDatePanel";

const MySwal = withReactContent(Swal);

function StatusBadge({ status }) {
    const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
    const label = STATUS_LABELS[status] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "—");
    return (
        <span className={`inline-flex items-center rounded-sm border px-3 py-0.5 text-xs font-semibold ${cls}`}>
            {label}
        </span>
    );
}

function fmtDate(d) {
    if (!d) return "—";
    return formatDisplayDate(d);
}

function fmtAmount(n, symbol) {
    if (n == null) return "—";
    return `${symbol ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

const NAV_ITEMS = [
    { key: "summary", label: "Summary", Icon: LayoutList },
    { key: "payments", label: "Payments", Icon: Wallet, permission: "paymentTransactionList" },
    { key: "activity", label: "Activity", Icon: Activity },
    { key: "creditNotes", label: "Credit Note", Icon: FileMinus, permission: "creditNoteList" },
    { key: "debitNotes", label: "Debit Note", Icon: FilePlus, permission: "debitNoteList" },
];

const CREDIT_NOTE_FILTER_FIELDS = [
    { id: "creditNoteCode", label: "Credit Note Code" },
    {
        id: "status",
        label: "Status",
        options: [
            { value: "", label: "All Statuses" },
            { value: "SUBMITTED", label: "Submitted" },
        ],
    },
];

const DEBIT_NOTE_FILTER_FIELDS = [
    { id: "debitNoteCode", label: "Debit Note Code" },
    {
        id: "status",
        label: "Status",
        options: [
            { value: "", label: "All Statuses" },
            { value: "SUBMITTED", label: "Submitted" },
        ],
    },
];

export default function InvoiceDetails({ id }) {
    const qtyDecimals = Number.isFinite(parseInt(process.env.NEXT_PUBLIC_DECIMAL_ALLOWED, 10))
        ? parseInt(process.env.NEXT_PUBLIC_DECIMAL_ALLOWED, 10)
        : 2;
    const priceDecimals = Number.isFinite(parseInt(process.env.NEXT_PUBLIC_PRICE_DECIMAL_ALLOWED, 10))
        ? parseInt(process.env.NEXT_PUBLIC_PRICE_DECIMAL_ALLOWED, 10)
        : 4;

    const router = useRouter();
    const { can, displayUser } = useContext(loginContext) || {};

    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("summary");

    const VALID_TABS = ["summary", "payments", "activity", "creditNotes", "debitNotes"];
    useEffect(() => {
        const apply = () => {
            const h = window.location.hash.replace("#", "");
            setActiveTab(VALID_TABS.includes(h) ? h : "summary");
        };
        apply();
        window.addEventListener("hashchange", apply);
        return () => window.removeEventListener("hashchange", apply);
    }, []);

    const changeTab = (key) => {
        setActiveTab(key);
        window.history.replaceState(null, "", `#${key}`);
    };

    const [sidebarExpanded, setSidebarExpanded] = useState(true);
    const [selectedUserPanelId, setSelectedUserPanelId] = useState(null);
    const [selectedCustomerPanelId, setSelectedCustomerPanelId] = useState(null);
    const [selectedTaxGroupPanelId, setSelectedTaxGroupPanelId] = useState(null);
    const [tcPreviewUrl, setTcPreviewUrl] = useState("");
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [dueDateInvoice, setDueDateInvoice] = useState(null);
    const [creditNoteInvoice, setCreditNoteInvoice] = useState(null);
    const [debitNoteInvoice, setDebitNoteInvoice] = useState(null);
    const [paymentMode, setPaymentMode] = useState("AUTOMATIC");
    const [selectedCreditNoteId, setSelectedCreditNoteId] = useState(null);
    const [selectedDebitNoteId, setSelectedDebitNoteId] = useState(null);
    const [selectedPaymentTransactionId, setSelectedPaymentTransactionId] = useState(null);

    useEffect(() => {
        const fetchPaymentMode = async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: { ...authHeaders(), endpoint: "payment-config", module: "vault" }
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (data?.success === 1) {
                    setPaymentMode(data.mode);
                }
            } catch (err) { }
        };
        fetchPaymentMode();
    }, []);

    const fetchDetails = async () => {
        try {
            setLoading(true);
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: { ...authHeaders(), endpoint: `invoice-details/${id}`, module: "invoice" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (!data?.invoiceId) {
                toast.error("Invoice not found.", { position: "top-right" });
                router.push("/invoice-list");
                return;
            }
            setInvoice(data);
        } catch (err) {
            toast.error(`Error: ${err.message}`, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDetails(); }, [id, router]);

    const handleSubmitInvoice = async () => {
        const result = await MySwal.fire({
            title: "Submit this invoice?",
            text: "This will generate the invoice PDF and mark it as Unpaid.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Submit",
            confirmButtonColor: "#2563eb",
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: { ...authHeaders(), endpoint: `invoice-submit/${id}`, module: "invoice" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success("Invoice submitted.", { position: "top-right" });
                fetchDetails();
            } else {
                toast.error(data?.message || "Failed to submit.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    const handleStatusUpdate = async (actionType) => {
        if (actionType !== "DELETE") return;
        const result = await MySwal.fire({
            title: "Delete this draft invoice?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Delete",
            confirmButtonColor: "#dc2626",
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch("/relayapi", {
                method: "DELETE",
                headers: { ...authHeaders(), endpoint: `invoice-delete/${id}`, module: "invoice" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1 || data?.status === true) {
                toast.success("Invoice deleted successfully.", { position: "top-right" });
                router.push("/invoice-list");
            } else {
                toast.error(data?.message || "Failed to delete invoice.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    const handleMarkPaid = async () => {
        const result = await MySwal.fire({
            title: "Mark this invoice as Paid?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Mark as Paid",
            confirmButtonColor: "#16a34a",
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: { ...authHeaders(), "Content-Type": "application/json", endpoint: `invoice-mark-paid/${id}`, module: "invoice" },
                body: JSON.stringify({})
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                const vaultRes = data.vaultResult;
                if (vaultRes && vaultRes.result === 'PAID') {
                    toast.success("Paid successfully.", { position: "top-right" });
                } else if (vaultRes && vaultRes.result === 'PARTIAL') {
                    toast.info(`Insufficient balance — invoice marked as partially paid.`, { position: "top-right" });
                } else {
                    toast.success("Invoice marked as paid.", { position: "top-right" });
                }
                fetchDetails();
            } else {
                toast.error(data?.message || "Failed to mark as paid.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    const handleRegeneratePdf = async () => {
        const result = await MySwal.fire({
            title: "Regenerate Invoice PDF?",
            text: "This will overwrite the existing invoice PDF.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Regenerate",
            confirmButtonColor: "#2563eb",
        });
        if (!result.isConfirmed) return;
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { ...authHeaders(), endpoint: `invoice-regenerate/${id}`, module: "invoice" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success("Invoice PDF regenerated.", { position: "top-right" });
                fetchDetails();
            } else {
                toast.error(data?.message || "Failed to regenerate PDF.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
                <Loader label="Loading invoice..." />
            </div>
        );
    }

    if (!invoice) return null;
    const q = invoice;

    const qDiscount = q.discount ?? (q.invoiceDiscounts || []).reduce((s, d) => s + (parseFloat(d.discountPrice ?? d.amount) || 0), 0);
    const qExtraCharge = q.extraCharge ?? (q.invoiceExtraCharges || []).reduce((s, ec) => s + (parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0), 0);

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
            <Header page="invoice-details" />

            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/invoice-list" className="cursor-pointer hover:text-blue-600">Invoices</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Invoice</span>
                </nav>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-1 mt-2">
                    <h1 className="text-2xl font-semibold text-[#1f2937]">Invoice</h1>

                    <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
                        {(() => {
                            const allAvailable = [];

                            if (q.status === "DRAFT" && can?.("invoiceUpdate")) {
                                allAvailable.push({ id: "edit", label: "Edit", icon: <Edit2 className="h-4 w-4" />, onClick: () => router.push(`/invoice/${id}?edit=true`), variant: "amber" });
                            }
                            if (q.status === "DRAFT" && can?.("invoiceUpdate")) {
                                allAvailable.push({ id: "submit", label: "Submit", icon: <ClipboardList className="h-4 w-4" />, onClick: handleSubmitInvoice, variant: "blue" });
                            }
                            if ((q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate")) {
                                allAvailable.push({ id: "updateDueDate", label: "Update Due Date", icon: <RefreshCw className="h-4 w-4" />, onClick: () => setDueDateInvoice(q), variant: "outline" });
                            }
                            if ((q.status === "UNPAID" || q.status === "PARTIALLY_PAID") && can?.("invoiceUpdate") && paymentMode === "MANUAL") {
                                allAvailable.push({ id: "markPaid", label: "Mark as Paid", icon: <CheckCircle className="h-4 w-4" />, onClick: handleMarkPaid, variant: "outline" });
                            }
                            if (q.status !== "DRAFT" && can?.("invoiceAdd")) {
                                allAvailable.push({ id: "copyInvoice", label: "Copy Invoice", icon: <FileText className="h-4 w-4" />, onClick: () => router.push(`/add-invoice?cloneFrom=${q.invoiceId}`), variant: "outline" });
                            }
                            if (q.status !== "DRAFT" && q.invoicePdfPath) {
                                allAvailable.push({ id: "viewPdf", label: "View PDF", icon: <Eye className="h-4 w-4" />, onClick: () => window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}${q.invoicePdfPath}`, "_blank"), variant: "outline" });
                            }
                            if (q.status !== "DRAFT" && q.invoicePdfPath) {
                                allAvailable.push({
                                    id: "downloadPdf", label: "Download PDF", icon: <Download className="h-4 w-4" />, onClick: async (e) => {
                                        e.stopPropagation();
                                        try {
                                            await downloadFile(q.invoicePdfPath, `Invoice_${q.invoiceCode ?? q.invoiceId}.pdf`);
                                        } catch {
                                            toast.error("Failed to download PDF", { position: "top-right" });
                                        }
                                    }, variant: "outline"
                                });
                            }
                            if (q.status !== "DRAFT" && can?.("creditNoteAdd")) {
                                allAvailable.push({ id: "addCreditNote", label: "Add Credit Note", icon: <FileText className="h-4 w-4" />, onClick: () => handleCreditNoteAddNavigation({ router, setShowAddPanel: setCreditNoteInvoice, invoice: q }) });
                            }
                            if (q.status !== "DRAFT" && can?.("debitNoteAdd")) {
                                allAvailable.push({ id: "addDebitNote", label: "Add Debit Note", icon: <FileText className="h-4 w-4" />, onClick: () => handleDebitNoteAddNavigation({ router, setShowAddPanel: setDebitNoteInvoice, invoice: q }) });
                            }
                            if (q.status !== "DRAFT" && can?.("invoiceUpdate")) {
                                allAvailable.push({ id: "regeneratePdf", label: "Regenerate PDF", icon: <FaRegFilePdf className="h-4 w-4" />, onClick: handleRegeneratePdf });
                            }
                            if (q.status === "DRAFT" && can?.("invoiceUpdate")) {
                                allAvailable.push({ id: "delete", label: "Delete", icon: <Trash2 className="h-4 w-4 text-red-600" />, onClick: () => handleStatusUpdate("DELETE"), textClass: "text-red-600 hover:bg-red-50" });
                            }

                            if (allAvailable.length === 0) return null;

                            const plainCandidates = ["edit", "submit", "updateDueDate", "markPaid", "copyInvoice", "viewPdf", "downloadPdf"];
                            const splitCandidateIds = ["addCreditNote", "addDebitNote"];
                            const dropdownOrder = ["addDebitNote", "copyInvoice", "viewPdf", "downloadPdf", "regeneratePdf", "delete"];

                            return (
                                <ActionButtonGroup
                                    allAvailable={allAvailable}
                                    plainCandidates={plainCandidates}
                                    splitCandidateIds={splitCandidateIds}
                                    dropdownOrder={dropdownOrder}
                                />
                            );
                        })()}
                    </div>
                </div>
            </div>

            <div className="px-6 pb-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <InfoCard label="Invoice No." value={q.invoiceCode || "-"} mono />
                    <InfoCard
                        label="Customer"
                        value={q.customerId ? (
                            <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => setSelectedCustomerPanelId(q.customerId)}>
                                {q.customerName ?? "—"}
                            </span>
                        ) : (q.customerName ?? "—")}
                        badge={q.currencyCode}
                    />
                    <InfoCard label="Invoice Date" value={fmtDate(q.invoiceDate)} />
                    <InfoCard label="Exchange Date" value={fmtDate(q.deliveryDate)} />
                    <InfoCard label="Status" value={<StatusBadge status={q.status} />} />
                </div>
            </div>

            <div className="flex flex-1 gap-4 px-6 pb-8">
                <div className={`shrink-0 transition-all duration-200 ${sidebarExpanded ? "w-44" : "w-12"}`}>
                    <div className="sticky top-4 rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden">
                        <button type="button" onClick={() => setSidebarExpanded(!sidebarExpanded)} className="w-full flex items-center justify-center py-2.5 border-b border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer">
                            {sidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        {NAV_ITEMS.filter(item => !item.permission || (can && can(item.permission)) || displayUser?.isSuperAdmin).map(({ key, label, Icon }) => (
                            <button key={key} type="button" onClick={() => changeTab(key)} className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium transition cursor-pointer ${activeTab === key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                                <Icon className="h-4 w-4 shrink-0" />
                                {sidebarExpanded && <span className="flex items-center gap-1.5 truncate">{label}</span>}
                            </button>
                        ))}
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
                                        Total {q.invoiceItems?.length ?? 0} item(s)
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
                                            {(q.invoiceItems ?? []).map((item, idx) => {
                                                const itemDiscountTotal = item.discountTotal ?? (item.discounts || []).reduce((s, d) => s + (parseFloat(d.discountPrice ?? d.amount) || 0), 0);
                                                const itemExtraChargeTotal = item.extraChargeTotal ?? (item.extraCharges || []).reduce((s, ec) => s + (parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0), 0);
                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="w-12 px-4 py-3.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                                                        <td className="min-w-[200px] px-4 py-3.5 text-left">
                                                            {item.itemId ? (
                                                                <>
                                                                    <button type="button" onClick={() => setSelectedItemId(item.item?.itemId ?? item.itemId)} className="font-semibold text-blue-600 hover:text-blue-800 hover:underline break-words text-left bg-transparent border-none p-0 cursor-pointer">
                                                                        {item.item?.itemName ?? item.itemCode ?? "—"}
                                                                    </button>
                                                                    <p className="text-xs text-gray-400 mt-0.5">{item.itemCode ?? item.item?.itemCode ?? ""}</p>
                                                                </>
                                                            ) : (
                                                                <span className="font-semibold text-gray-800 break-words">{item.description ?? "—"}</span>
                                                            )}
                                                        </td>
                                                        <td className="min-w-[90px] px-4 py-3.5 text-right font-medium text-gray-800 whitespace-nowrap">{Number(item.quantity ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: qtyDecimals })}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{q?.currencySymbol}{Number(item.unitPrice ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{q?.currencySymbol} {Number(itemDiscountTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{q?.currencySymbol} {Number(itemExtraChargeTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}</td>
                                                        <td className="min-w-[130px] px-4 py-3.5 text-right whitespace-nowrap font-medium text-gray-800">{q?.currencySymbol} {Number(item.totalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}</td>
                                                        <td className="min-w-[110px] px-4 py-3.5 text-center whitespace-nowrap">
                                                            <span className="px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600">
                                                                {formatTaxCalcLabel(item.taxCalculation)}
                                                            </span>
                                                        </td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-left text-sm text-gray-600 whitespace-nowrap">
                                                            {item.taxId ? (
                                                                <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => setSelectedTaxGroupPanelId(item.taxId)}>
                                                                    {item.taxGroup ?? "—"}
                                                                </span>
                                                            ) : (item.taxGroup ?? "—")}
                                                        </td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{q?.currencySymbol} {Number(item.taxAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}</td>
                                                        <td className="min-w-[140px] px-4 py-3.5 text-right whitespace-nowrap font-bold text-gray-900">{q?.currencySymbol} {Number(item.finalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: priceDecimals })}</td>
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
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-2">Invoice Info</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <ReadField label="Source" value={q.invoiceFor || "—"} />
                                            {q.invoiceFor === "ORDER" && <ReadField label="Order No" value={q.sourceOrder?.orderCode || "—"} />}
                                            {q.invoiceFor === "QUOTATION" && <ReadField label="Quotation No" value={q.sourceQuotation?.quotationCode || "—"} />}
                                            <ReadField label="VAT Withheld" value={q.vatWithheld ?? "NO"} />
                                            <ReadField label="Business Terms" value={q.businessTerms ?? "—"} />
                                            <ReadField label="Payment Type" value={q.paymentType ?? "—"} />
                                            <ReadField label="Discount Applicable" value={q.discountApplicable ?? "—"} />
                                            <ReadField label="Bank Account" value={q.bankBookName ?? "—"} />
                                            <ReadField
                                                label="Sales Person"
                                                value={q.salesPersonId ? (
                                                    <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => setSelectedUserPanelId(q.salesPersonId)}>
                                                        {q.salesPersonName ?? "—"}
                                                    </span>
                                                ) : (q.salesPersonName ?? "—")}
                                            />
                                            <ReadField
                                                label="Contact Person"
                                                value={q.contactPersonId ? (
                                                    <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => setSelectedUserPanelId(q.contactPersonId)}>
                                                        {q.contactPersonName ?? "—"}
                                                    </span>
                                                ) : (q.contactPersonName ?? "—")}
                                            />
                                            <ReadField label="Added By" value={q.addedByName ?? "—"} />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-2">Location & Delivery</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <ReadField label="Shipping State" value={q.shippingState ?? "—"} />
                                            <ReadField label="Billing State" value={q.billingState ?? "—"} />
                                            <ReadField label="Delivery State" value={q.deliveryState ?? "—"} />
                                            <ReadField label="Delivery Type" value={q.deliveryType ?? "—"} />
                                        </div>
                                    </div>

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

                                    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Terms and Conditions</h4>
                                        {q.termsConditionsFile ? (
                                            <div onClick={() => setTcPreviewUrl(getImageUrl(q.termsConditionsFile))} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-gray-200 bg-gradient-to-br from-red-50 via-white to-red-100/50 p-1 flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition group relative shrink-0">
                                                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shadow-sm group-hover:scale-110 transition-transform">
                                                    <FileText className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-red-600 bg-red-100/80 border border-red-200 px-1 py-0.5 rounded-full mt-0.5">PDF</span>
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                                                    <div className="h-6 w-6 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow"><Eye className="h-3 w-3" /></div>
                                                </div>
                                            </div>
                                        ) : q.termsConditionsText ? (
                                            <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: q.termsConditionsText }} />
                                        ) : (
                                            <p className="text-sm text-gray-400">No terms and conditions attached.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="lg:col-span-5 space-y-6">
                                    <InvoiceSummaryPanel
                                        readOnly
                                        quotationDiscounts={q.invoiceDiscounts || []}
                                        quotationExtraCharges={q.invoiceExtraCharges || []}
                                        currencyCode={q.currencyCode ?? ""}
                                        currencySymbol={q.currencySymbol ?? ""}
                                        vatWithheld={q.vatWithheld ?? "NO"}
                                        existingAttachments={q.attachments ?? []}
                                        staticTotals={staticTotals}
                                        amountPaid={Number(q.amountPaid ?? 0)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === "payments" && (
                        <InvoicePaymentsTab key="payments" invoiceId={id} refreshKey={invoice?.amountPaid} onSelectPayment={setSelectedPaymentTransactionId} />
                    )}
                    {activeTab === "activity" && (
                        <div className="max-h-[70vh] overflow-y-auto pr-2 my-4">
                            <ActivityTimeline targetType="INVOICE" targetId={id} />
                        </div>
                    )}
                    {activeTab === "creditNotes" && (
                        <EmbeddedTable
                            key="creditNotes"
                            endpoint="credit-note-list"
                            module="credit-note"
                            invoiceId={id}
                            emptyMessage="No credit notes found for this invoice."
                            columns={["Credit Note Code", "Date", "Final Amount", "Status"]}
                            fieldsConfig={CREDIT_NOTE_FILTER_FIELDS}
                            renderRow={(q, i) => (
                                <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedCreditNoteId(q.id)}>
                                    <td className="px-6 py-4 font-medium text-blue-600">{q.creditNoteCode || "-"}</td>
                                    <td className="px-6 py-4">{fmtDate(q.addedDate)}</td>
                                    <td className="px-6 py-4">{fmtAmount(q.finalAmount, q.currency?.symbol ?? q.currencyCode)}</td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={q.status} />
                                    </td>
                                </tr>
                            )}
                        />
                    )}
                    {activeTab === "debitNotes" && (
                        <EmbeddedTable
                            key="debitNotes"
                            endpoint="debit-note-list"
                            module="debit-note"
                            invoiceId={id}
                            emptyMessage="No debit notes found for this invoice."
                            columns={["Debit Note Code", "Date", "Final Amount", "Status"]}
                            fieldsConfig={DEBIT_NOTE_FILTER_FIELDS}
                            renderRow={(q, i) => (
                                <tr key={i} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedDebitNoteId(q.id)}>
                                    <td className="px-6 py-4 font-medium text-blue-600">{q.debitNoteCode || "-"}</td>
                                    <td className="px-6 py-4">{fmtDate(q.addedDate)}</td>
                                    <td className="px-6 py-4">{fmtAmount(q.finalAmount, q.currency?.symbol ?? q.currencyCode)}</td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={q.status} />
                                    </td>
                                </tr>
                            )}
                        />
                    )}
                </div>
            </div>

            <AttachmentPreviewModal open={!!tcPreviewUrl} onClose={() => setTcPreviewUrl("")} fileUrl={tcPreviewUrl} fileType="pdf" />
            {selectedItemId && <DetailsSidePanel config={itemSidePanelConfig} id={selectedItemId} onClose={() => setSelectedItemId(null)} />}
            {selectedTaxGroupPanelId && <DetailsSidePanel config={taxGroupSidePanelConfig} id={selectedTaxGroupPanelId} onClose={() => setSelectedTaxGroupPanelId(null)} />}
            {selectedUserPanelId && typeof document !== "undefined" && createPortal(<UserSidePanel userId={selectedUserPanelId} onClose={() => setSelectedUserPanelId(null)} />, document.body)}
            {selectedCustomerPanelId && typeof document !== "undefined" && createPortal(<CustomerSidePanel customerId={selectedCustomerPanelId} onClose={() => setSelectedCustomerPanelId(null)} />, document.body)}
            {dueDateInvoice && <InvoiceDueDatePanel invoice={dueDateInvoice} onClose={() => setDueDateInvoice(null)} onSuccess={() => { setDueDateInvoice(null); fetchDetails(); }} />}
            {creditNoteInvoice && getCreditNoteMode() === "CUSTOMER" && typeof document !== "undefined" && createPortal(
                <NoteAddPanel
                    noteType="CREDIT"
                    lockedCustomerId={creditNoteInvoice.customerId}
                    lockedCustomerName={creditNoteInvoice.customerName}
                    lockedCurrencyId={creditNoteInvoice.currencyId}
                    lockedCurrencyCode={creditNoteInvoice.currencyCode}
                    lockedInvoiceId={creditNoteInvoice.invoiceId}
                    lockedInvoiceCode={creditNoteInvoice.invoiceCode}
                    lockedCompanyId={creditNoteInvoice.companyId}
                    onClose={() => setCreditNoteInvoice(null)}
                    onSuccess={() => setCreditNoteInvoice(null)}
                />,
                document.body
            )}
            {debitNoteInvoice && getCreditNoteMode() === "CUSTOMER" && typeof document !== "undefined" && createPortal(
                <NoteAddPanel
                    noteType="DEBIT"
                    lockedCustomerId={debitNoteInvoice.customerId}
                    lockedCustomerName={debitNoteInvoice.customerName}
                    lockedCurrencyId={debitNoteInvoice.currencyId}
                    lockedCurrencyCode={debitNoteInvoice.currencyCode}
                    lockedInvoiceId={debitNoteInvoice.invoiceId}
                    lockedInvoiceCode={debitNoteInvoice.invoiceCode}
                    lockedCompanyId={debitNoteInvoice.companyId}
                    onClose={() => setDebitNoteInvoice(null)}
                    onSuccess={() => setDebitNoteInvoice(null)}
                />,
                document.body
            )}
            {selectedCreditNoteId && typeof document !== "undefined" && createPortal(
                <DetailsSidePanel config={creditNoteSidePanelConfig} id={selectedCreditNoteId} onClose={() => setSelectedCreditNoteId(null)} />,
                document.body
            )}
            {selectedDebitNoteId && typeof document !== "undefined" && createPortal(
                <DetailsSidePanel config={debitNoteSidePanelConfig} id={selectedDebitNoteId} onClose={() => setSelectedDebitNoteId(null)} />,
                document.body
            )}
            {selectedPaymentTransactionId && typeof document !== "undefined" && createPortal(
                <DetailsSidePanel config={paymentTransactionSidePanelConfig} id={selectedPaymentTransactionId} onClose={() => setSelectedPaymentTransactionId(null)} />,
                document.body
            )}

        </div>
    );
}

function InfoCard({ label, value, mono = false, badge }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm w-full min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`text-sm font-semibold text-gray-800 ${mono ? "font-mono" : ""} truncate`}>{value}</span>
                {badge && <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold shrink-0">{badge}</span>}
            </div>
        </div>
    );
}

function ActionBtn({ onClick, icon, label, variant = "blue", title, ...rest }) {
    const VARIANTS = {
        blue: "bg-blue-600 text-white hover:bg-blue-700",
        green: "bg-green-600 text-white hover:bg-green-700",
        amber: "bg-amber-500 text-white hover:bg-amber-600",
        outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    };
    return (
        <button type="button" onClick={onClick} title={title} {...rest} className={`flex items-center gap-1.5 rounded-sm px-4 py-2 text-sm font-semibold transition cursor-pointer ${VARIANTS[variant] ?? VARIANTS.outline}`}>
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
