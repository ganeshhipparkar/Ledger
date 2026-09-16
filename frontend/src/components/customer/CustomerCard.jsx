"use client";

import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials, formatDisplayDate } from "@/lib/utils";
import { CustomerStatusBadge } from "./CustomerColumn";
import LinkedCompanyCell from "../common/LinkedCompanyCell";

export default function CustomerCard({ customer: c, can, onCustomerClick, onEdit }) {
    const router = useRouter();

    const handleView = () => {
        if (can?.("customerView")) {
            onCustomerClick?.(c.customerId);
        }
    };

    const handleEdit = () => {
        if (can?.("customerUpdate")) {
            onEdit?.(c.customerId);
        }
    };

    const initials = getInitials(c.customerName || c.customerCode || "-");

    let primaryBtn = null;
    if (can?.("customerUpdate")) {
        primaryBtn = (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    handleEdit();
                }}
                className="w-full rounded-full border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 transition cursor-pointer"
            >
                Edit Customer
            </button>
        );
    }

    return (
        <div className="relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition flex flex-col h-full">
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
                    <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg rounded-xl">
                        {can?.("customerView") && (
                            <DropdownMenuItem
                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleView();
                                }}
                            >
                                View Details
                            </DropdownMenuItem>
                        )}
                        {can?.("customerUpdate") && (
                            <DropdownMenuItem
                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit();
                                }}
                            >
                                Edit
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex items-start gap-4 mb-4">
                <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-tr from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold shadow-inner">
                    {initials}
                </div>
                <div className="flex-1 min-w-0 pr-6">
                    <div
                        className={`font-semibold text-lg truncate ${can?.("customerView") !== false ? "cursor-pointer text-blue-600 hover:underline" : "text-gray-800"}`}
                        onClick={handleView}
                    >
                        {c.customerName || c.customerCode || "—"}
                    </div>
                    <div className="mt-1">
                        <CustomerStatusBadge status={c.status} />
                    </div>
                </div>
            </div>

            <div className="flex-1 space-y-3 mb-5">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Code</span>
                    <span className="font-mono font-medium text-gray-800">{c.customerCode || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Company</span>
                    <div className="font-medium text-gray-800 text-right">
                        <LinkedCompanyCell companyId={c.companyId} companyName={c.companyName || c.company?.companyName} />
                    </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-800 truncate pl-4" title={c.customerEmail}>{c.customerEmail || "—"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-gray-800">{c.phone ? `${c.dialCode || ""} ${c.phone}`.trim() : "—"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Added Date</span>
                    <span className="font-medium text-gray-800">{formatDisplayDate(c.createdDate) || "—"}</span>
                </div>
            </div>

            {primaryBtn && (
                <div className="mt-auto">
                    {primaryBtn}
                </div>
            )}
        </div>
    );
}
