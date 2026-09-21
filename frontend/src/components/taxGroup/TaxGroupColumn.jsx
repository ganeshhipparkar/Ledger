"use client";
import { formatDisplayDate } from "@/lib/utils";


function StatusBadge({ status }) {
    if (!status) return <span className="text-gray-400 text-sm">-</span>;
    const formatted = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    const cls =
        formatted === "Active"
            ? "bg-green-100 text-green-700"
            : formatted === "Inactive"
                ? "bg-red-100 text-red-700"
                : "bg-sky-100 text-sky-700";
    return (
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${cls}`}>
            {formatted}
        </span>
    );
}
import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { loginContext } from "@/components/hooks/LoginContext";
import { ArrowUpDown, Eye, Pencil } from "lucide-react";
import LinkedCompanyCell from "../common/LinkedCompanyCell";

function TaxNameCell({ row, onPreview }) {
    const { can } = useContext(loginContext);
    const item = row.original;
    return (
        <div className="flex items-center gap-2">
            <span
                className={`font-semibold text-base ${can("taxGroupView")
                        ? "text-blue-600 cursor-pointer hover:underline"
                        : "text-gray-800"
                    }`}
                onClick={(e) => {
                    if (!can("taxGroupView")) return;
                    e.stopPropagation();
                    if (onPreview) onPreview(item.taxId);
                }}
            >
                {item.taxName || item.taxCode || "—"}
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

export const getTaxGroupColumns = (onPreview, onEdit, isSuperAdmin, onPreviewUser) => [
    {
        accessorKey: "taxName",
        header: sortableHeader("Tax Name"),
        cell: ({ row }) => <TaxNameCell row={row} onPreview={onPreview} />,
        filterFn: "includesString",
    },
    {
        accessorKey: "taxCode",
        header: sortableHeader("Tax Code"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-mono font-medium">
                {row.getValue("taxCode") || "-"}
            </span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "taxValue",
        header: sortableHeader("Tax Value (%)"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-medium">
                {row.getValue("taxValue") !== undefined && row.getValue("taxValue") !== null ? `${row.getValue("taxValue")}%` : "-"}
            </span>
        ),
        filterFn: "includesString",
    },
    ...(isSuperAdmin ? [    {
        accessorKey: "companyName",
        header: sortableHeader("Company"),
        cell: ({ row }) => (
            <LinkedCompanyCell
                companyId={row.original.companyId}
                companyName={row.original.companyName || row.original.company?.companyName}
            />
        ),
        filterFn: "includesString",
    }] : []),
    
    {
        accessorKey: "addedByName",
        header: sortableHeader("Added By"),
        cell: ({ row }) => (
            <span
                className={row.original.addedByName ? "text-blue-600 cursor-pointer hover:underline" : "text-gray-700 text-sm"}
                onClick={(e) => {
                    e.stopPropagation();
                    if (row.original.addedBy && onPreviewUser) onPreviewUser(row.original.addedBy);
                }}
            >
                {row.original.addedByName || "-"}
            </span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "addedDate",
        header: sortableHeader("Added Date"),
        cell: ({ row }) => <span className="text-gray-700 text-sm">{formatDisplayDate(row.getValue("addedDate") || row.original.createdDate) || "-"}</span>,
        filterFn: "includesString",
    },
    {
        accessorKey: "status",
        header: sortableHeader("Status"),
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
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
                    {can("taxGroupUpdate") && (
                        <button
                            title="Edit"
                            onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(item.taxId); }}
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
