"use client";

import { useContext } from "react";
import { ArrowUpDown, Eye, MoreVertical, Pencil, ExternalLink } from "lucide-react";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import { loginContext } from "../hooks/LoginContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

function StatusBadge({ status }) {
    const s = String(status || "").toLowerCase();
    let style = "bg-sky-100 text-sky-700";
    if (s === "active") style = "bg-green-100 text-green-700";
    if (s === "inactive") style = "bg-red-100 text-red-700";
    const label = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "-";
    return (
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
            {label}
        </span>
    );
}

const sortableHeader = (title) => {
    return ({ column }) => (
        <button
            className="flex items-center gap-1 font-semibold text-gray-600 hover:text-gray-900 text-sm cursor-pointer"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            {title}
            <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
    );
};

function UomNameCell({ row, onPreview }) {
    const { can } = useContext(loginContext);
    const uom = row.original;
    return (
        <div className="flex items-center gap-2">
            <span
                className={`font-medium text-sm ${
                    can("uomView")
                        ? "text-blue-600 cursor-pointer hover:underline"
                        : "text-gray-900"
                }`}
                onClick={(e) => {
                    if (!can("uomView")) return;
                    e.stopPropagation();
                    if (onPreview) onPreview(uom.uomId);
                }}
            >
                {uom.uomName || uom.uomCode || "—"}
            </span>
        </div>
    );
}

export const getUomColumns = (onPreview, onEdit, router) => [
    {
        accessorKey: "uomName",
        header: sortableHeader("UOM Name"),
        cell: ({ row }) => <UomNameCell row={row} onPreview={onPreview} />,
        filterFn: "includesString",
    },
    {
        accessorKey: "uomCode",
        header: sortableHeader("Code"),
        cell: ({ row }) => (
            <span className="font-mono font-semibold text-blue-600 text-sm">
                {row.getValue("uomCode")}
            </span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "abbreviation",
        header: sortableHeader("Abbreviation"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-medium">
                {row.getValue("abbreviation") || "-"}
            </span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "isoCode",
        header: sortableHeader("ISO Code"),
        cell: ({ row }) => (
            <span className="font-mono text-gray-700 text-sm">
                {row.getValue("isoCode") || "-"}
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
                companyName={row.getValue("companyName") || row.original.company?.companyName}
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
            const uom = row.original;
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <span
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
                            title="Actions"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 bg-white border border-gray-200 shadow-lg rounded-xl">
                        {can("uomView") && (
                            <DropdownMenuItem
                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onPreview) onPreview(uom.uomId);
                                }}
                            >
                                <Eye className="h-4 w-4 text-blue-600" />
                                View Details
                            </DropdownMenuItem>
                        )}
                        {can("uomUpdate") && (
                            <DropdownMenuItem
                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onEdit) onEdit(uom.uomId);
                                }}
                            >
                                <Pencil className="h-4 w-4 text-amber-600" />
                                Edit
                            </DropdownMenuItem>
                        )}
                      
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
