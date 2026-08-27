"use client";

import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { loginContext } from "@/components/hooks/LoginContext";
import { ArrowUpDown, Eye, Pencil } from "lucide-react";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import { formatDate } from "@/lib/utils";

function PaymentTransactionNameCell({ row, onPreview }) {
    const { can } = useContext(loginContext);
    const item = row.original;
    const nameText = item.narration || `PT #${item.paymentTransactionId}`;
    return (
        <div className="flex items-center gap-2">
            <span
                className={`font-semibold text-base ${
                    can("paymentTransactionView")
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

export const getPaymentTransactionColumns = (onPreview, onEdit) => [
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
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
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
            <span className="inline-block rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-semibold border border-blue-200">
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
                <span className="text-gray-900 text-sm font-semibold font-mono">
                    {val !== undefined && val !== null ? Number(val).toFixed(2) : "-"}
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
                <span className="text-gray-900 text-sm font-semibold font-mono">
                    {val !== undefined && val !== null ? Number(val).toFixed(2) : "-"}
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
                    {can("paymentTransactionUpdate") && (
                        <button
                            title="Edit"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onEdit) onEdit(item.paymentTransactionId);
                            }}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition cursor-pointer"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                    )}
                </div>
            );
        },
    },
];
