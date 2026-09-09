"use client";

import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { loginContext } from "@/components/hooks/LoginContext";
import { ArrowUpDown, Eye, ChevronDown, CheckCircle, XCircle } from "lucide-react";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import { formatDate } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function PaymentTransactionNameCell({ row, onPreview }) {
    const { can } = useContext(loginContext);
    const item = row.original;
    const nameText = item.narration || `PT #${item.paymentTransactionId}`;
    return (
        <div className="flex items-center gap-2">
            <span
                className={`font-semibold text-base ${can("paymentTransactionView")
                    ? "text-blue-600 cursor-pointer hover:underline"
                    : "text-gray-800"
                    }`}
                onClick={(e) => {
                    if (!can("paymentTransactionView")) return;
                    e.stopPropagation();
                    if (onPreview) onPreview(item.paymentTransactionId);
                }}
            >
                {nameText}
            </span>
        </div>
    );
}

function sortableHeader(label) {
    const SortableHeaderComponent = ({ column }) => (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-semibold text-[#4b5563] text-sm px-0 hover:bg-transparent"
        >
            {label}
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
    );
    SortableHeaderComponent.displayName = `SortableHeader_${label.replace(/\s+/g, "")}`;
    return SortableHeaderComponent;
}

export const getPaymentTransactionColumns = (onPreview, onAction) => [
    {
        accessorKey: "narration",
        header: sortableHeader("Narration"),
        cell: ({ row }) => <PaymentTransactionNameCell row={row} onPreview={onPreview} />,
        filterFn: "includesString",
    },
    {
        accessorKey: "customerName",
        header: sortableHeader("Customer Name"),
        cell: ({ row }) => (
            <span className="text-gray-800 text-sm font-medium">
                {row.original.customerName || row.original.customer?.customerName || "-"}
            </span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "bankBookName",
        header: sortableHeader("Bank Account"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm">
                {row.original.bankBookName || row.original.bankBook?.bankBookName || "-"}
            </span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "companyName",
        header: sortableHeader("Company"),
        cell: ({ row }) => (
            <LinkedCompanyCell
                companyId={row.original.companyId}
                companyName={row.original.companyName || row.original.company?.companyName}
            />
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "currencyCode",
        header: sortableHeader("Currency"),
        cell: ({ row }) => {
            const code = row.original.currencyCode || row.original.currency?.code;
            const symbol = row.original.currencySymbol || row.original.currency?.symbol;
            if (!code) return <span className="text-gray-400 text-sm">-</span>;
            return (
                <span className="text-gray-700 text-sm">
                    <span>{code}</span>
                    {symbol && <span className="text-gray-500">({symbol})</span>}
                </span>
            );
        },
        filterFn: "includesString",
    },
    {
        accessorKey: "paymentMode",
        header: sortableHeader("Payment Mode"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm">
                {row.getValue("paymentMode") || "-"}
            </span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "paymentDate",
        header: sortableHeader("Payment Date"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-medium">
                {formatDate(row.getValue("paymentDate"))}
            </span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "transactionAmount",
        header: sortableHeader("Transaction Amount"),
        cell: ({ row }) => {
            const val = row.getValue("transactionAmount");
            return (
                <span className="text-gray-900 text-sm">
                    {val !== undefined && val !== null ? Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                </span>
            );
        },
        filterFn: "includesString",
    },
    {
        accessorKey: "baseAmount",
        header: sortableHeader("Base Amount"),
        cell: ({ row }) => {
            const val = row.getValue("baseAmount");
            return (
                <span className="text-gray-900 text-sm ">
                    {val !== undefined && val !== null ? Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                </span>
            );
        },
        filterFn: "includesString",
    },
    {
        accessorKey: "status",
        header: sortableHeader("Status"),
        cell: ({ row }) => {
            const status = row.getValue("status") || "Pending";
            let badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
            if (status === "Approved") badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
            if (status === "Cancelled") badgeClass = "bg-red-50 text-red-700 border-red-200";
            return (
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badgeClass}`}>
                    {status}
                </span>
            );
        },
        filterFn: "includesString",
    },
    {
        id: "actions",
        header: () => <span className="font-semibold text-gray-600 text-sm">Actions</span>,
        cell: ({ row }) => {
            const { can } = useContext(loginContext);
            const item = row.original;
            const isPending = (item.status || "Pending") === "Pending";

            return (
                <div className="flex items-center gap-2">
                    {can("paymentTransactionView") && (
                        <button
                            title="View Details"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onPreview) onPreview(item.paymentTransactionId);
                            }}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition cursor-pointer"
                        >
                            <Eye className="h-4 w-4" />
                        </button>
                    )}

                    {can("paymentTransactionUpdate") && isPending && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer shadow-xs"
                                >
                                    Actions
                                    <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36 bg-white border border-gray-200 shadow-lg rounded-xl p-1">
                                <DropdownMenuItem
                                    className="cursor-pointer px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onAction) onAction(item.paymentTransactionId, "approve");
                                    }}
                                >
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                    Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onAction) onAction(item.paymentTransactionId, "cancel");
                                    }}
                                >
                                    <XCircle className="h-3.5 w-3.5 text-red-600" />
                                    Cancel
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            );
        },
    },
];
