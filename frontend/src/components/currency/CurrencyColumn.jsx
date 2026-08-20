"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import { loginContext } from "@/components/hooks/LoginContext";
import { ArrowUpDown } from "lucide-react";

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

function CurrencyNameCell({ row, onPreview }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const currency = row.original;
    const curId = currency.curId || currency.currencyId;
    return (
        <div className="flex items-center gap-3">
            <span
                className={`font-semibold text-base ${can("currencyView")
                    ? "text-blue-600 cursor-pointer hover:underline"
                    : "text-gray-800"
                    }`}
                onClick={(e) => {
                    if (!can("currencyView")) return;

                    e.stopPropagation();

                    if (onPreview) {
                        onPreview(curId);
                    } else {
                        router.push(`/currency/${curId}`);
                    }
                }}
            >
                {currency.name || "Unknown"}
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

export const getCurrencyColumns = (onPreview) => [
    {
        accessorKey: "name",
        header: sortableHeader("Currency Name"),
        cell: ({ row }) => <CurrencyNameCell row={row} onPreview={onPreview} />,
        filterFn: "includesString",
    },
    {
        accessorKey: "code",
        header: sortableHeader("Code"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-mono font-medium">{row.getValue("code") || "-"}</span>
        ),
        filterFn: "includesString",
    },
    {
        accessorKey: "symbol",
        header: () => <span className="font-semibold text-gray-600 text-sm">Symbol</span>,
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-semibold">{row.getValue("symbol") || "-"}</span>
        ),
    },
    {
        accessorKey: "conversionRate",
        header: sortableHeader("Conversion Rate"),
        cell: ({ row }) => (
            <span className="text-gray-700 text-sm font-medium">{(row.getValue("conversionRate") ?? 0).toLocaleString()}</span>
        ),
    },
    {
        accessorKey: "lastSync",
        header: () => <span className="font-semibold text-gray-600 text-sm">Last Sync Date</span>,
        cell: ({ row }) => {
            const rawDate = row.getValue("lastSync");

            if (!rawDate) return <span className="text-gray-700 text-sm font-semibold">-</span>;

            const formattedDate = new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
            }).format(new Date(rawDate));

            return <span className="text-gray-700 text-sm font-medium">{formattedDate}</span>;
        },
    },

    {
        accessorKey: "status",
        header: sortableHeader("Status"),
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        filterFn: "includesString",
    },
];

export const currencyColumns = getCurrencyColumns();
