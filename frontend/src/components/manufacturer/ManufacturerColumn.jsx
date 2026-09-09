"use client";
import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { loginContext } from "@/components/hooks/LoginContext";
import { ArrowUpDown, Eye, Pencil } from "lucide-react";
import LinkedCompanyCell from "../common/LinkedCompanyCell";

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

function ManufacturerNameCell({ row, onPreview }) {
    const { can } = useContext(loginContext);
    const manufacturer = row.original;
    return (
        <div className="flex items-center gap-2">
            <span
                className={`font-semibold text-base ${can("manufacturerView")
                        ? "text-blue-600 cursor-pointer hover:underline"
                        : "text-gray-800"
                    }`}
                onClick={(e) => {
                    if (!can("manufacturerView")) return;
                    e.stopPropagation();
                    if (onPreview) onPreview(manufacturer.manufacturerId);
                }}
            >
                {manufacturer.manufacturerName || manufacturer.manufacturerCode || "—"}
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

export const getManufacturerColumns = (onPreview, onEdit) => [
    {
        accessorKey: "manufacturerName",
        header: sortableHeader("Manufacturer Name"),
        cell: ({ row }) => <ManufacturerNameCell row={row} onPreview={onPreview} />,
        filterFn: "includesString",
    },
    {
        accessorKey: "manufacturerCode",
        header: sortableHeader("Code"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-mono font-medium">
                {row.getValue("manufacturerCode") || "-"}
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
            const manufacturer = row.original;
            return (
                <div className="flex items-center gap-2">

                    {can("manufacturerUpdate") && (
                        <button
                            title="Edit"
                            onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(manufacturer.manufacturerId); }}
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
