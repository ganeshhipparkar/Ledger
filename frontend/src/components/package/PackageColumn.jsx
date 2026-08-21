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
    const s = String(status).toLowerCase();
    let style = "bg-sky-100 text-sky-700";
    if (s === "active") style = "bg-green-100 text-green-700";
    if (s === "inactive") style = "bg-red-100 text-red-700";

    return (
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
            {status}
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

function PackageNameCell({ row, onPreview }) {
    const { can } = useContext(loginContext);
    const pkg = row.original;
    return (
        <div className="flex items-center gap-2">
            <span
                className={`font-medium text-sm ${can("packageView")
                    ? "text-blue-600 cursor-pointer hover:underline"
                    : "text-gray-900"
                    }`}
                onClick={(e) => {
                    if (!can("packageView")) return;
                    e.stopPropagation();
                    if (onPreview) onPreview(pkg.packageId);
                }}
            >
                {pkg.packageName || pkg.packageCode || "—"}
            </span>
        </div>
    );
}

export const getPackageColumns = (onPreview, onEdit, router) => [
    {
        accessorKey: "packageName",
        header: sortableHeader("Package Name"),
        cell: ({ row }) => <PackageNameCell row={row} onPreview={onPreview} />,
        filterFn: "includesString",
    },
    {
        accessorKey: "packageCode",
        header: sortableHeader("Code"),
        cell: ({ row }) => (
            <span className="font-mono font-semibold text-blue-600 text-sm">
                {row.getValue("packageCode")}
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
            const pkg = row.original;
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
                        {can("packageView") && (
                            <DropdownMenuItem
                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onPreview) onPreview(pkg.packageId);
                                }}
                            >
                                <Eye className="h-4 w-4 text-blue-600" />
                                View Details
                            </DropdownMenuItem>
                        )}
                        {can("packageUpdate") && (
                            <DropdownMenuItem
                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onEdit) onEdit(pkg.packageId);
                                }}
                            >
                                <Pencil className="h-4 w-4 text-amber-600" />
                                Edit
                            </DropdownMenuItem>
                        )}
                        {can("packageView") && (
                            <DropdownMenuItem
                                className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (router) router.push(`/package/${pkg.packageId}`);
                                }}
                            >
                                <ExternalLink className="h-4 w-4 text-gray-600" />
                                Full Page View
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
