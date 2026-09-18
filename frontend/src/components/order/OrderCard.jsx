"use client";

import { useRouter } from "next/navigation";
import { MoreVertical, ChevronDown, LayoutList, EllipsisVertical } from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";

export const ORDER_STATUS_COLORS = {
    DRAFT: "mt-2 inline-block rounded-sm bg-amber-100 px-3 py-1 text-sm text-amber-700 font-medium",
    PLACED: "mt-2 inline-block rounded-sm bg-blue-100 px-3 py-1 text-sm text-blue-700 font-medium",
    DELIVERED: "mt-2 inline-block rounded-sm bg-green-100 px-3 py-1 text-sm text-green-700 font-medium",
    PARTIAL_DELIVERED: "mt-2 inline-block rounded-sm bg-teal-100 px-3 py-1 text-sm text-teal-700 font-medium",
    CLOSED: "mt-2 inline-block rounded-sm bg-gray-100 px-3 py-1 text-sm text-gray-600 font-medium",
};

export const ORDER_STATUS_LABELS = {
    DRAFT: "Draft",
    PLACED: "Placed",
    DELIVERED: "Delivered",
    PARTIAL_DELIVERED: "Partial Delivered",
    CLOSED: "Closed",
};

export function OrderStatusBadge({ status }) {
    const cls = ORDER_STATUS_COLORS[status] ?? "mt-2 inline-block rounded-sm bg-gray-100 px-3 py-1 text-sm text-gray-600 font-medium";
    const label = ORDER_STATUS_LABELS[status] ?? status;
    return (
        <span className={cls}>
            {label}
        </span>
    );
}

function fmtDate(d) {
    if (!d) return "—";
    return formatDisplayDate(d);
}

function fmtAmount(n, symbol) {
    return `${symbol ?? ""} ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

export default function OrderCard({ order: q, onStatusUpdate, onUpdatePrice, can, onCustomerClick, onAddedByClick, onOrderClick }) {
    const router = useRouter();
    const handleEdit = () => router.push(`/order/${q.orderId}?edit=true`);
    const handleSubmit = () => onStatusUpdate?.(q.orderId, "SUBMIT");
    const handleCancel = () => onStatusUpdate?.(q.orderId, "CANCEL");
    const handleClose = () => onStatusUpdate?.(q.orderId, "CLOSE");
    const handleDelete = () => onStatusUpdate?.(q.orderId, "DELETE");

    const initials = getInitials(q.orderCode ?? `OD-${q.orderId}`);
    const isOpen = q.orderStatus === "OPEN" || !q.orderStatus;
    const hasActions = Boolean(
        (isOpen && q.status === "DRAFT" && can?.("orderUpdate") !== false) ||
        (isOpen && q.status === "PLACED" && can?.("orderUpdate") !== false) ||
        (isOpen && (q.status === "PARTIAL_DELIVERED" || q.status === "DELIVERED") && can?.("orderUpdate") !== false)
    );
    // if (isOpen) {
    //     if (q.status === "DRAFT" && can?.("orderUpdate") !== false) {
    //         primaryBtn = (
    //             <button
    //                 type="button"
    //                 onClick={handleSubmit}
    //                 className="w-full rounded-full border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition cursor-pointer"
    //             >
    //                 Submit Order
    //             </button>
    //         );
    //     } else if (q.status === "PLACED" && can?.("orderUpdate") !== false) {
    //         primaryBtn = (
    //             <button
    //                 type="button"
    //                 onClick={handleCancel}
    //                 className="w-full rounded-full border border-red-500 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition cursor-pointer"
    //             >
    //                 Cancel Order
    //             </button>
    //         );
    //     } else if ((q.status === "PARTIAL_DELIVERED" || q.status === "DELIVERED") && can?.("orderUpdate") !== false) {
    //         primaryBtn = (
    //             <button
    //                 type="button"
    //                 onClick={handleClose}
    //                 className="w-full rounded-full border border-gray-500 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition cursor-pointer"
    //             >
    //                 Close Order
    //             </button>
    //         );
    //     }
    // }

    return (
        <div className="relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">

            <div className="absolute top-4 right-4 z-10">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <span
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                            title="Navigation"
                        >
                            <EllipsisVertical className="h-5 w-5" />
                        </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 bg-white border border-gray-200 shadow-lg rounded-xl">
                        <DropdownMenuItem
                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/order/${q.orderId}?tab=summary`);
                            }}
                        >
                            Summary
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/order/${q.orderId}?tab=activity`);
                            }}
                        >
                            Activity
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex items-start gap-4 mb-4">
                <div className="flex h-20 w-20 min-w-[80px] items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold uppercase text-blue-600 shadow-md">
                    <span className="text-blue-600">{initials}</span>
                </div>
                <div className="flex-1 min-w-0 pr-6">
                    <div
                        className={`font-semibold text-lg truncate ${can?.("orderView") !== false ? "cursor-pointer text-blue-600 hover:underline" : "text-gray-800"}`}
                        onClick={() => onOrderClick?.(q.orderId)}
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
                                Closed
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="text-sm text-gray-600 pt-3 pb-3 border-y border-gray-200 py-1 flex flex-row">
                <div>
                    <span className="text-[#71717b] text-xs uppercase tracking-wide">
                        Customer
                    </span>
                    <p
                        className={`font-semibold mt-1 break-words ${q.customerId ? "cursor-pointer text-blue-600 hover:underline" : ""}`}
                        onClick={() => q.customerId && onCustomerClick?.(q.customerId)}
                    >
                        {q.customerName || "—"}
                    </p>
                </div>
                <div className="ml-auto">
                    {hasActions && (
                        <div className="mt-1 pt-3 ">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div
                                        type="button"
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center justify-between gap-1.5 w-34 rounded-sm border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs"
                                    >
                                        {(() => {
                                            const primaryAction = [
                                                { show: isOpen && q.status === "DRAFT" && can?.("orderUpdate") !== false, label: "Edit" },
                                                { show: isOpen && q.status === "PLACED" && can?.("orderUpdate") !== false, label: "Cancel Order" },
                                                { show: isOpen && (q.status === "PARTIAL_DELIVERED" || q.status === "DELIVERED") && can?.("orderUpdate") !== false, label: "Update Price" }
                                            ].find(x => x.show)?.label ?? "Actions";
                                            return <span className="truncate whitespace-nowrap overflow-hidden">{primaryAction}</span>;
                                        })()}
                                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 bg-white border border-gray-200 shadow-lg rounded-sm">
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
                                                className="cursor-pointer px-4 py-2 text-sm text-gray-600  hover:bg-blue-50"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSubmit();
                                                }}
                                            >
                                                Submit Order
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="cursor-pointer px-4 py-2 text-sm text-gray-600 hover:bg-red-50"
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
                                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-red-50"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancel();
                                                }}
                                            >
                                                Cancel Order
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onUpdatePrice?.(q);
                                                }}
                                            >
                                                Update Price
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
                    )}
                </div>
            </div>

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
                    <span
                        className={q.addedBy ? "cursor-pointer text-blue-600 hover:underline" : ""}
                        onClick={() => q.addedBy && onAddedByClick?.(q.addedBy)}
                    >
                        {q.addedByName || "—"}
                    </span>
                </div>
                <div className="text-sm text-gray-600">
                    <span className="font-medium">Final Amount:</span>{" "}
                    <span className="font-semibold text-gray-800">{fmtAmount(q.finalAmount, q?.currency.symbol ?? q.currencyCode)}</span>
                </div>
            </div>
            {/* 
            {primaryBtn && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                    {primaryBtn}
                </div>
            )} */}
        </div>
    );
}
