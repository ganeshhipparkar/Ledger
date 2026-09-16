"use client";
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

export const getTaxGroupColumns = (onPreview, onEdit) => [
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
