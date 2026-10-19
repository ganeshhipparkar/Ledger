"use client";

import Link from "next/link";
import { formatDate, getInitials } from "@/lib/utils";

export default function DeliveryNoteCard({ deliveryNote: dn, onCustomerClick, onViewClick }) {
    const initials = getInitials(dn.deliveryNoteCode || "DN");

    return (
        <div className="relative bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
            <div className="flex items-start gap-4 mb-4">
                <div className="flex h-16 w-16 min-w-[64px] items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xl font-bold uppercase text-blue-600 shadow-sm">
                    <span>{initials}</span>
                </div>
                <div className="flex-1 min-w-0 pr-2">
                    <button
                        type="button"
                        onClick={() => onViewClick?.(dn.deliveryNoteId)}
                        className="font-semibold text-lg truncate cursor-pointer hover:underline text-[#3563e9] block text-left bg-transparent border-none p-0"
                    >
                        {dn.deliveryNoteCode || "-"}
                    </button>
                    <div className="text-sm text-gray-600 break-all mt-1">
                        <span
                            className="text-blue-600 hover:underline cursor-pointer font-medium"
                            onClick={(e) => {
                                e.stopPropagation();
                                dn.customerId && onCustomerClick?.(dn.customerId);
                            }}
                        >
                            {dn.customerName || "—"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="text-sm text-gray-600 pt-3 pb-3 py-1 flex flex-row border-t border-gray-100">
                <div className="flex-1 pr-2">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                        Order Code
                    </span>
                    <span className="font-semibold break-words text-gray-800">
                        {dn.orderCode || "—"}
                    </span>
                </div>
                <div className="flex-1 pl-2 border-l border-gray-200">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                        Delivery Date
                    </span>
                    <span className="font-semibold break-words text-gray-800">
                        {formatDate(dn.deliveryDate)}
                    </span>
                </div>
            </div>

            <div className="text-sm text-gray-600 py-2 flex flex-row border-t border-gray-100">
                <div className="flex-1 pr-2">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                        Receiver Name
                    </span>
                    <span className="font-semibold break-words text-gray-800">
                        {dn.receiverName || "—"}
                    </span>
                </div>
                <div className="flex-1 pl-2 border-l border-gray-200">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                        Added Date
                    </span>
                    <span className="font-semibold break-words text-gray-800">
                        {formatDate(dn.addedDate)}
                    </span>
                </div>
            </div>

            {dn.billingAddress && (
                <div className="text-sm text-gray-600 pt-2 pb-2 border-t border-gray-100">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide block mb-1">
                        Billing Address
                    </span>
                    <span className="text-xs text-gray-700 line-clamp-2" title={dn.billingAddress}>
                        {dn.billingAddress}
                    </span>
                </div>
            )}

            <div className="mt-auto pt-4 border-t border-gray-100 flex justify-end">
                <button
                    type="button"
                    onClick={() => onViewClick?.(dn.deliveryNoteId)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                    View Details
                </button>
            </div>
        </div>
    );
}
