"use client";
import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { loginContext } from "@/components/hooks/LoginContext";
import { ArrowUpDown, Eye, Pencil } from "lucide-react";
import LinkedCompanyCell from "../common/LinkedCompanyCell";

function TitleCell({ row, onPreview }) {
    const { can } = useContext(loginContext);
    const item = row.original;
    return (
        <div className="flex items-center gap-2">
            <span
                className={`font-semibold text-base ${
                    can("termsConditionsView")
                        ? "text-blue-600 cursor-pointer hover:underline"
                        : "text-gray-800"
                }`}
                onClick={(e) => {
                    if (!can("termsConditionsView")) return;
                    e.stopPropagation();
                    if (onPreview) onPreview(item.termsConditionsId);
                }}
            >
                {item.title || item.code || "—"}
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

export const getTermsConditionsColumns = (onPreview, onEdit) => [
    {
        accessorKey: "title",
        header: sortableHeader("Title"),
        cell: ({ row }) => <TitleCell row={row} onPreview={onPreview} />,
        filterFn: "includesString",
    },
    {
        accessorKey: "code",
        header: sortableHeader("Code"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-mono font-medium">
                {row.getValue("code") || "-"}
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
                    {can("termsConditionsView") && (
                        <button
                            title="View Details"
                            onClick={(e) => { e.stopPropagation(); if (onPreview) onPreview(item.termsConditionsId); }}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition cursor-pointer"
                        >
                            <Eye className="h-4 w-4" />
                        </button>
                    )}
                    {can("termsConditionsUpdate") && (
                        <button
                            title="Edit"
                            onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(item.termsConditionsId); }}
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
