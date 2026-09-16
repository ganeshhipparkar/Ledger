"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import {
    LayoutList,
    ChevronLeft, ChevronRight, Edit2, CheckCircle,
    RefreshCw, Copy, ClipboardList, Paperclip, ChevronDown, Trash2, FileText, Eye, Download
} from "lucide-react";
import Header from "../Header";
import Loader from "../ui/Loader";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import OrderSummaryPanel from "./OrderSummaryPanel";
import OrderUpdatePriceSidePanel from "./OrderUpdatePriceSidePanel";
import AttachmentPreviewModal from "../ui/AttachmentPreviewModal";
import { getImageUrl, formatDisplayDate, downloadFile } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ORDER_STATUS_COLORS } from "./OrderCard";
import DetailsSidePanel from "../DetailsSidePanel";
import { itemSidePanelConfig } from "../item/configs/itemSidePanel.config";

const MySwal = withReactContent(Swal);

const ORDER_STATUS_LABELS = {
    DRAFT: "Draft",
    PLACED: "Placed",
    DELIVERED: "Delivered",
    PARTIAL_DELIVERED: "Partial Delivered",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
    OPEN: "Open",
};

function StatusBadge({ status, orderStatus }) {
    const cls = ORDER_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
    const label = ORDER_STATUS_LABELS[status] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "—");
    const lifecycleLabel = ORDER_STATUS_LABELS[orderStatus] ?? (orderStatus ? orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1).toLowerCase() : "—");
    return (
        <div className="flex flex-col gap-1 w-fit">
            <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${cls}`}>
                {label}
            </span>
            {orderStatus === "CLOSED" && (
                <span className="inline-block rounded-full bg-gray-100 px-3 py-0.5 text-[10px] text-gray-600 font-medium">
                    Lifecycle: {lifecycleLabel}
                </span>
            )}
        </div>
    );
}

const ITEM_GL_LABELS = {
    SALES_REVENUE: "Sales Revenue",
    COGS: "Cost of Goods Sold",
    INVENTORY: "Inventory",
    SERVICE_REVENUE: "Service Revenue",
    FREIGHT: "Freight & Logistics",
    DISCOUNTS: "Discounts Given",
    TAX_PAYABLE: "Tax Payable",
    OTHER_INCOME: "Other Income",
};

function fmtDate(d) {
    if (!d) return "—";
    return formatDisplayDate(d);
}

function fmtAmount(n, symbol) {
    if (n == null) return `${symbol ?? ""} 0.00`.trim();
    return `${symbol ?? ""} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

const NAV_ITEMS = [
    { key: "summary", label: "Summary", Icon: LayoutList },
];

export default function OrderDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext) || {};

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("summary");
    const [sidebarExpanded, setSidebarExpanded] = useState(true);

    const [pricePanelOpen, setPricePanelOpen] = useState(false);
    const [tcPreviewUrl, setTcPreviewUrl] = useState("");
    const [selectedItemId, setSelectedItemId] = useState(null);

    const fetchDetails = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: { ...authHeaders(), endpoint: `order-details/${id}`, module: "order" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (!data?.orderId) {
                toast.error("Order not found.", { position: "top-right" });
                router.push("/order-list");
                return;
            }
            setOrder(data);
        } catch (err) {
            toast.error(`Error: ${err.message}`, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchDetails(); }, [fetchDetails]);

    const handleStatusUpdate = async (actionType) => {
        let title = "";
        let confirmText = "";
        let confirmColor = "";
        let endpoint = "";

        if (actionType === "SUBMIT" || actionType === "SUBMITTED") {
            title = "Submit this order?";
            confirmText = "Submit";
            confirmColor = "#2563eb";
            endpoint = `order-submit/${id}`;
        } else if (actionType === "CANCEL") {
            title = "Cancel this order?";
            confirmText = "Cancel";
            confirmColor = "#dc2626";
            endpoint = `order-cancel/${id}`;
        } else if (actionType === "CLOSE") {
            title = "Close this order?";
            confirmText = "Close";
            confirmColor = "#4b5563";
            endpoint = `order-close/${id}`;
        } else if (actionType === "DELETE") {
            title = "Delete this draft order?";
            confirmText = "Delete";
            confirmColor = "#dc2626";
            endpoint = `order-delete/${id}`;
        } else {
            return;
        }

        const result = await MySwal.fire({
            title,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: confirmText,
            confirmButtonColor: confirmColor,
        });

        if (!result.isConfirmed) return;

        try {
            const res = await fetch("/relayapi", {
                method: actionType === "DELETE" ? "DELETE" : "PUT",
                headers: { ...authHeaders(), endpoint, module: "order" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1 || data?.status === true) {
                toast.success(`Order ${confirmText.toLowerCase()}ted successfully.`, { position: "top-right" });
                if (actionType === "DELETE") router.push("/order-list");
                else fetchDetails();
            } else {
                toast.error(data?.message || `Failed to ${confirmText.toLowerCase()}.`, { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        }
    };

    const handleRegeneratePdf = async () => {
        const result = await MySwal.fire({
            title: "Regenerate Order Invoice PDF?",
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
                headers: { ...authHeaders(), endpoint: `order-invoice-regenerate/${id}`, module: "order" },
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
                <Loader label="Loading order..." />
            </div>
        );
    }

    if (!order) return null;

    const q = order;

    const oDiscount = q.discount ?? q.totalDiscount ?? (q.discounts || q.orderDiscounts || []).reduce((s, d) => s + (parseFloat(d.discountPrice ?? d.amount) || 0), 0);
    const oExtraCharge = q.extraCharge ?? q.totalExtraCharge ?? (q.extraCharges || q.orderExtraCharges || []).reduce((s, ec) => s + (parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0), 0);

    const staticTotals = {
        grossAmount: q.totalAmount,
        taxableAmount: q.taxableAmount,
        taxAmount: q.taxAmount,
        nonTaxableAmount: (q.totalAmount ?? 0) - (q.taxableAmount ?? 0),
        oDiscount,
        oExtraCharge,
        qDiscount: oDiscount,
        qExtraCharge: oExtraCharge,
        netAmount: q.netAmount,
        vatWithheldAmount: q.vatWithheldAmount ?? 0,
        finalAmount: q.finalAmount,
    };

    const InfoCard = ({ label, value, badge, mono }) => (
        <div className="flex flex-col border border-gray-100 bg-gray-50/50 rounded-xl p-3 min-w-[140px]">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            <div className="mt-1 flex items-center gap-2">
                <span className={`text-sm ${mono ? "font-mono font-bold text-blue-600" : "font-medium text-gray-800 break-all"}`}>
                    {value || "—"}
                </span>
                {badge && (
                    <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">
                        {badge}
                    </span>
                )}
            </div>
        </div>
    );

    const DetailField = ({ label, value }) => (
        <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500">{label}</span>
            <span className="text-sm text-gray-800 font-medium break-all mt-0.5">{value || "—"}</span>
        </div>
    );

    let actionBlock = null;
    if (q.orderStatus === "OPEN" || !q.orderStatus) {
        if (q.status === "DRAFT" && can?.("orderUpdate") !== false) {
            actionBlock = (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => handleStatusUpdate("SUBMIT")}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer shadow-sm"
                    >
                        <CheckCircle className="h-4 w-4" /> Submit Order
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push(`/order/${id}?edit=true`)}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition border border-amber-200 cursor-pointer"
                    >
                        <Edit2 className="h-4 w-4" /> Edit
                    </button>

                    <button
                        type="button"
                        onClick={() => handleStatusUpdate("DELETE")}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition border border-red-200 cursor-pointer"
                    >
                        <Trash2 className="h-4 w-4" /> Delete
                    </button>
                </div>
            );
        } else if (q.status === "PLACED" && can?.("orderUpdate") !== false) {
            actionBlock = (
                <div className="flex gap-2 items-center">
                    {q.invoicePdfPath && (
                        <>
                            <button
                                type="button"
                                onClick={() => window.open(`http://localhost:4000${q.invoicePdfPath}`, "_blank")}
                                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition border border-gray-200 cursor-pointer shadow-sm"
                                title="View Invoice PDF"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        await downloadFile(q.invoicePdfPath, `Invoice_${q.orderCode ?? q.orderId}.pdf`);
                                    } catch (err) {
                                        toast.error("Failed to download invoice", { position: "top-right" });
                                    }
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition border border-gray-200 cursor-pointer shadow-sm"
                                title="Download Invoice PDF"
                            >
                                <Download className="h-4 w-4" />
                            </button>
                        </>
                    )}
                    {can?.("orderUpdate") && (
                        <button
                            type="button"
                            onClick={handleRegeneratePdf}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition border border-gray-200 cursor-pointer shadow-sm"
                            title="Regenerate Invoice PDF"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    )}
                    <div className="flex rounded-full overflow-hidden border border-red-500">
                        <button
                            type="button"
                            onClick={() => handleStatusUpdate("CANCEL")}
                            className="px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer border-r border-red-200"
                        >
                            Cancel Order
                        </button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <div className="px-3 bg-white text-red-600 hover:bg-red-50 transition cursor-pointer flex items-center justify-center">
                                    <ChevronDown className="h-4 w-4" />
                                </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem className="cursor-pointer" onClick={() => setPricePanelOpen(true)}>Update Price</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            );
        } else if ((q.status === "PARTIAL_DELIVERED" || q.status === "DELIVERED") && can?.("orderUpdate")) {
            actionBlock = (
                <div className="flex rounded-full overflow-hidden border border-gray-500">
                    <button
                        type="button"
                        onClick={() => handleStatusUpdate("CLOSE")}
                        className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer border-r border-gray-200"
                    >
                        Close Order
                    </button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="px-3 bg-white text-gray-600 hover:bg-gray-50 transition cursor-pointer flex items-center justify-center">
                                <ChevronDown className="h-4 w-4" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setPricePanelOpen(true)}>Update Price</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            );
        }
    }

    return (
        <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
            <Header page="order-details" />

            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/order-list")}>Orders</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">{"Order"}</span>
                </nav>
            </div>

            <div className="px-6 pb-3">
                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">
                            <InfoCard label="Order No." value={q.orderCode ?? `#${id}`} mono />
                            <InfoCard
                                label="Customer"
                                value={q.customerName ?? "—"}
                                badge={q.currencyCode}
                            />
                            <InfoCard label="Order Date" value={fmtDate(q.orderDate)} />
                            <InfoCard label="Delivery Date" value={fmtDate(q.deliveryDate)} />
                            <InfoCard label="Status" value={<StatusBadge status={q.status} orderStatus={q.orderStatus} />} />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 justify-start lg:justify-end">
                            {actionBlock}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 gap-4 px-6 pb-8">
                <div className={`shrink-0 transition-all duration-200 ${sidebarExpanded ? "w-44" : "w-12"}`}>
                    <div className="sticky top-4 rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setSidebarExpanded(!sidebarExpanded)}
                            className="w-full flex items-center justify-center py-2.5 border-b border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                        >
                            {sidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>

                        {NAV_ITEMS.map(({ key, label, Icon }) => {
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

                            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <DetailField label="Contact Person" value={q.contactPersonName} />
                                    <DetailField label="Business Terms" value={q.businessTerms} />
                                    <DetailField label="Payment Type" value={q.paymentType} />
                                    <DetailField label="Delivery Terms" value={q.deliveryTerms} />
                                    <DetailField label="Discount Applicable" value={q.discountApplicable} />
                                    <DetailField label="Shipping Address" value={q.shippingState} />
                                    <DetailField label="Billing Address" value={q.billingState} />
                                    <DetailField label="Place Of Delivery" value={q.deliveryState} />
                                    <DetailField label="Delivery Type" value={q.deliveryType} />
                                    <DetailField label="Invoice Generation On" value={q.invoiceGenerationOn} />
                                    <DetailField label="Invoice Auto Approval" value={q.invoiceAutoApproval} />
                                    <DetailField label="Sales Person" value={q.salesPersonName} />
                                    <DetailField label="Added By" value={q.addedByName} />
                                    <DetailField label="Bank Book" value={q.bankBookName} />
                                    <DetailField label="Place Of Supply" value={q.placeOfSupply} />
                                    <DetailField label="VAT Withheld" value={q.vatWithheld} />
                                </div>
                                {q.remarks && (
                                    <div className="pt-2 border-t border-gray-100">
                                        <span className="text-xs font-medium text-gray-500">Remarks</span>
                                        <p className="text-sm text-gray-800 font-medium break-all mt-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            {q.remarks}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                        <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                                        Item(s)
                                    </h3>
                                    <div className="text-xs font-medium text-gray-500">
                                        Total {q.orderItems?.length ?? 0} item(s)
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-[1300px] w-full border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-gray-50/80 border-b border-gray-200">
                                                <th className="w-12 px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                                                <th className="min-w-[200px] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                                                <th className="min-w-[100px] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item GL</th>
                                                <th className="min-w-[90px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                                                <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Price</th>
                                                <th className="min-w-[120px] px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
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
                                            {(q.orderItems ?? []).map((item, idx) => {
                                                const itemDiscountTotal = item.discountTotal ?? (item.discounts || []).reduce((s, d) => s + (parseFloat(d.discountPrice ?? d.amount) || 0), 0);
                                                const itemExtraChargeTotal = item.extraChargeTotal ?? (item.extraCharges || []).reduce((s, ec) => s + (parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0), 0);
                                                return (
                                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="w-12 px-4 py-3.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                                                        <td className="min-w-[200px] px-4 py-3.5 text-left">
                                                            {item.itemId ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedItemId(item.item?.itemId ?? item.itemId)}
                                                                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline break-words text-left bg-transparent border-none p-0 cursor-pointer"
                                                                    >
                                                                        {item.item?.itemName ?? "—"}
                                                                    </button>
                                                                    <p className="text-xs text-gray-400 mt-0.5">{item.item?.itemCode ?? "N/A"}</p>
                                                                </>
                                                            ) : (
                                                                <span className="font-semibold text-gray-800 break-words">
                                                                    {item.description ?? "—"}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="min-w-[100px] px-4 py-3.5 text-left text-gray-700 whitespace-nowrap">{ITEM_GL_LABELS[item.itemGL] || item.itemGL || "0"}</td>
                                                        <td className="min-w-[90px] px-4 py-3.5 text-right font-medium text-gray-800 whitespace-nowrap">{item.quantity}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{Number(item.unitPrice ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{Number((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap">
                                                            {itemDiscountTotal > 0 ? (
                                                                <span className="text-orange-600">{Number(itemDiscountTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                                                            ) : "0.00"}
                                                        </td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap">
                                                            {itemExtraChargeTotal > 0 ? (
                                                                <span className="text-purple-600">{Number(itemExtraChargeTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                                                            ) : "0.00"}
                                                        </td>
                                                        <td className="min-w-[130px] px-4 py-3.5 text-right whitespace-nowrap font-semibold text-gray-800">{Number(item.totalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                        <td className="min-w-[110px] px-4 py-3.5 text-center whitespace-nowrap">
                                                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.taxCalculation === "EXCLUSIVE" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
                                                                {item.taxCalculation === "NA" ? "N/A" : item.taxCalculation}
                                                            </span>
                                                        </td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-left text-gray-600 whitespace-nowrap">
                                                            {item.taxGroup ? `${item.taxGroup} (${Number(item.taxRate ?? 0)}%)` : "—"}
                                                        </td>
                                                        <td className="min-w-[120px] px-4 py-3.5 text-right whitespace-nowrap text-gray-700">{item.taxAmount > 0 ? Number(item.taxAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "0.00"}</td>
                                                        <td className="min-w-[140px] px-4 py-3.5 text-right whitespace-nowrap font-bold text-gray-900 bg-gray-50/50">{Number(item.finalAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
                                <div className="lg:col-span-7 space-y-6">
                                    {(q.termsConditionsText || q.termsConditionsFile || q.termsConditionsFileUrl) && (
                                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden p-6">
                                            <h3 className="text-base font-semibold text-gray-800 mb-4">Terms & Conditions</h3>
                                            {q.termsConditionsText && (
                                                <div
                                                    className="prose prose-sm max-w-none text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4"
                                                    dangerouslySetInnerHTML={{ __html: q.termsConditionsText }}
                                                />
                                            )}
                                            {(q.termsConditionsFile || q.termsConditionsFileUrl) && (
                                                <div
                                                    onClick={() => setTcPreviewUrl(getImageUrl(q.termsConditionsFileUrl || q.termsConditionsFile))}
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
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="lg:col-span-5">
                                    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden sticky top-4">
                                        <div className="bg-gray-50/80 px-5 py-4 border-b border-gray-100">
                                            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                                <span className="w-1.5 h-4 bg-green-500 rounded-full"></span>
                                                Order Summary
                                            </h3>
                                        </div>
                                        <OrderSummaryPanel
                                            readOnly
                                            items={[]}
                                            orderDiscounts={q.discounts || q.orderDiscounts || []}
                                            orderExtraCharges={q.extraCharges || q.orderExtraCharges || []}
                                            vatWithheld={q.vatWithheld}
                                            currencyCode={q.currencyCode}
                                            currencySymbol={q.currencySymbol}
                                            existingAttachments={q.attachments || []}
                                            staticTotals={staticTotals}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <OrderUpdatePriceSidePanel
                isOpen={pricePanelOpen}
                onClose={() => setPricePanelOpen(false)}
                order={q}
                onSuccess={fetchDetails}
            />

            <AttachmentPreviewModal
                open={!!tcPreviewUrl}
                onClose={() => setTcPreviewUrl("")}
                fileUrl={tcPreviewUrl}
                fileType="pdf"
            />
            {selectedItemId && (
                <DetailsSidePanel
                    config={itemSidePanelConfig}
                    id={selectedItemId}
                    onClose={() => setSelectedItemId(null)}
                />
            )}
        </div>
    );
}
