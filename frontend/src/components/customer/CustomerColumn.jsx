"use client";
import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { loginContext } from "@/components/hooks/LoginContext";
import { ArrowUpDown, Eye, Pencil, ExternalLink, MoreVertical } from "lucide-react";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CustomerStatusBadge({ status }) {
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

function CustomerNameCell({ row, onPreview }) {
    const { can } = useContext(loginContext);
    const customer = row.original;
    return (
        <div className="flex items-center gap-2">
            <span
                className={`font-semibold text-base ${can("customerView")
                    ? "text-blue-600 cursor-pointer hover:underline"
                    : "text-gray-800"
                    }`}
                onClick={(e) => {
                    if (!can("customerView")) return;
                    e.stopPropagation();
                    if (onPreview) onPreview(customer.customerId);
                }}
            >
                {customer.customerName || customer.customerCode || "—"}
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

export const getCustomerColumns = (onPreview, onEdit, router) => [
    {
        accessorKey: "customerName",
        header: sortableHeader("Customer Name"),
        cell: ({ row }) => <CustomerNameCell row={row} onPreview={onPreview} />,
        filterFn: "includesString",
    },
    {
        accessorKey: "customerCode",
        header: sortableHeader("Code"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-mono font-medium">
                {row.getValue("customerCode") || "-"}
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
        accessorKey: "customerEmail",
        header: sortableHeader("Email"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-medium">
                {row.getValue("customerEmail") || "-"}
            </span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "phone",
        header: sortableHeader("Phone"),
        cell: ({ row }) => {
            const dialCode = row.original.dialCode ? `+${row.original.dialCode} ` : "";
            const phone = row.getValue("phone") || "";
            return (
                <span className="text-gray-700 text-sm font-medium">
                    {dialCode || phone ? `${dialCode}${phone}` : "-"}
                </span>
            );
        },
        filterFn: "includesString",
    },
    {
        accessorKey: "status",
        header: sortableHeader("Status"),
        cell: ({ row }) => <CustomerStatusBadge status={row.getValue("status")} />,
        filterFn: "includesString",
    },
    {
        id: "actions",
        header: () => <span className="font-semibold text-gray-600 text-sm">Actions</span>,
        cell: ({ row }) => {
            const { can } = useContext(loginContext);
            const customer = row.original;
            return (
                // <DropdownMenu>
                //     <DropdownMenuTrigger asChild>
                //         <span
                //             onClick={(e) => e.stopPropagation()}
                //             className="inline-flex p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
                //             title="Actions"
                //         >
                //             <MoreVertical className="h-4 w-4" />
                //         </span>
                //     </DropdownMenuTrigger>
                //     <DropdownMenuContent align="end" className="w-44 bg-white border border-gray-200 shadow-lg rounded-xl">
                //         {can("customerView") && (
                //             <DropdownMenuItem
                //                 className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                //                 onClick={(e) => {
                //                     e.stopPropagation();
                //                     if (onPreview) onPreview(customer.customerId);
                //                 }}
                //             >
                //                 <Eye className="h-4 w-4 text-blue-600" />
                //                 View Details
                //             </DropdownMenuItem>
                //         )}
                //         {can("customerUpdate") && (
                //             <DropdownMenuItem
                //                 className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                //                 onClick={(e) => {
                //                     e.stopPropagation();
                //                     if (onEdit) onEdit(customer.customerId);
                //                 }}
                //             >
                //                 <Pencil className="h-4 w-4 text-amber-600" />
                //                 Edit
                //             </DropdownMenuItem>
                //         )}

                //     </DropdownMenuContent>
                // </DropdownMenu>
                <div>
                    {can("customerUpdate") && (
                        <button
                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onEdit) onEdit(customer.customerId);
                            }}
                        >
                            <Pencil className="h-4 w-4 text-amber-600" />

                        </button>
                    )}
                </div>
            );
        },
    },
];
