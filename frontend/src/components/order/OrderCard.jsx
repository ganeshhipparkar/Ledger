"use client";

import { useRouter } from "next/navigation";
import { MoreVertical, ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";

export const ORDER_STATUS_COLORS = {
    DRAFT: "mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700 font-medium",
    PLACED: "mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 font-medium",
    DELIVERED: "mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 font-medium",
    PARTIAL_DELIVERED: "mt-2 inline-block rounded-full bg-teal-100 px-3 py-1 text-sm text-teal-700 font-medium",
    CLOSED: "mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 font-medium",
};

export const ORDER_STATUS_LABELS = {
    DRAFT: "Draft",
    PLACED: "Placed",
    DELIVERED: "Delivered",
    PARTIAL_DELIVERED: "Partial Delivered",
    CLOSED: "Closed",
};

export function OrderStatusBadge({ status }) {
    const cls = ORDER_STATUS_COLORS[status] ?? "mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 font-medium";
    const label = ORDER_STATUS_LABELS[status] ?? status;
    return (
        <span className={cls}>
            {label}
        </span>
    );
}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmount(n, symbol) {
    return `${symbol ?? ""} ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

export default function OrderCard({ order, onStatusUpdate, onUpdatePrice, can }) {
    const router = useRouter();
    const q = order;

    const handleView = () => router.push(`/order/${q.orderId}`);
    const handleEdit = () => router.push(`/order/${q.orderId}?edit=true`);
    const handleSubmit = () => onStatusUpdate?.(q.orderId, "SUBMIT");
    const handleCancel = () => onStatusUpdate?.(q.orderId, "CANCEL");
    const handleClose = () => onStatusUpdate?.(q.orderId, "CLOSE");
    const handleDelete = () => onStatusUpdate?.(q.orderId, "DELETE");

    const initials = getInitials(q.orderCode ?? `OD-${q.orderId}`);
    const isOpen = q.orderStatus === "OPEN" || !q.orderStatus;

    let primaryBtn = null;
    if (isOpen) {
        if (q.status === "DRAFT" && can?.("orderUpdate") !== false) {
            primaryBtn = (
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="w-full rounded-full border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                >
                    Submit Order
                </button>
            );
        } else if (q.status === "PLACED" && can?.("orderUpdate") !== false) {
            primaryBtn = (
                <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full rounded-full border border-red-500 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition cursor-pointer"
                >
                    Cancel Order
                </button>
            );
        } else if ((q.status === "PARTIAL_DELIVERED" || q.status === "DELIVERED") && can?.("orderUpdate") !== false) {
            primaryBtn = (
                <button
                    type="button"
                    onClick={handleClose}
                    className="w-full rounded-full border border-gray-500 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                    Close Order
                </button>
            );
        }
    }

    return (
        <div className="relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
            {/* Actions Menu */}
            <div className="absolute top-4 right-4 z-10">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <span
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                            title="Actions"
                        >
                            <MoreVertical className="h-5 w-5" />
                        </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 bg-white border border-gray-200 shadow-lg rounded-xl">
                        <DropdownMenuItem
                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleView();
                            }}
                        >
                            View Details
                        </DropdownMenuItem>
                        {isOpen && q.status === "DRAFT" && can?.("orderUpdate") !== false && (
                            <>
                                <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit();
                                    }}
                                >
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-blue-600 font-semibold hover:bg-blue-50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSubmit();
                                    }}
                                >
                                    Submit Order
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete();
                                    }}
                                >
                                    Delete
                                </DropdownMenuItem>
                            </>
                        )}
                        {isOpen && q.status === "PLACED" && can?.("orderUpdate") !== false && (
                            <>
                                <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdatePrice?.(q);
                                    }}
                                >
                                    Update Price
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancel();
                                    }}
                                >
                                    Cancel Order
                                </DropdownMenuItem>
                            </>
                        )}
                        {isOpen && (q.status === "PARTIAL_DELIVERED" || q.status === "DELIVERED") && can?.("orderUpdate") !== false && (
                            <>
                                <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdatePrice?.(q);
                                    }}
                                >
                                    Update Price
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClose();
                                    }}
                                >
                                    Close Order
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Header row */}
            <div className="flex items-start gap-4 mb-4">
                <div className="flex h-20 w-20 min-w-[80px] items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold uppercase text-blue-600 shadow-md">
                    <span className="text-blue-600">{initials}</span>
                </div>
                <div className="flex-1 min-w-0 pr-6">
                    <div
                        className={`font-semibold text-lg truncate \${can?.("orderView") !== false ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                        onClick={handleView}
                    >
                        {q.orderCode ?? `OD-\${q.orderId}`}
                    </div>
                    <div className="text-sm text-gray-600 break-all mt-1">
                        {q.customerName || "—"}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mt-1">
                        <OrderStatusBadge status={q.status} />
                        {q.orderStatus === "CLOSED" && (
                            <span className="mt-2 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 font-medium">
                                Lifecycle: Closed
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Divider section */}
            <div className="text-sm text-gray-600 pt-3 pb-3 border-y border-gray-200 py-1">
                <span className="text-[#71717b] text-xs uppercase tracking-wide">
                    Customer
                </span>
                <p className="font-semibold mt-1 break-words">
                    {q.customerName || "—"}
                </p>
            </div>

            {/* Detail rows */}
            <div className="space-y-2 mt-4">
                <div className="text-sm text-gray-600 break-all">
                    <span className="font-medium">Order Date:</span>{" "}
                    {fmtDate(q.orderDate)}
                </div>
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Delivery Date:</span>{" "}
                    {fmtDate(q.deliveryDate)}
                </div>
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Added By:</span>{" "}
                    {q.addedByName || "—"}
                </div>
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Final Amount:</span>{" "}
                    <span className="font-semibold text-gray-800">{fmtAmount(q.finalAmount, q.currencySymbol ?? q.currencyCode)}</span>
                </div>
            </div>

            {/* Bottom action */}
            {primaryBtn && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    {primaryBtn}
                </div>
            )}
        </div>
    );
}
