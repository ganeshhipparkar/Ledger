"use client";
import { toast } from "react-toastify";


import { MoreVertical, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "./OrderCard";
import { formatDisplayDate, downloadFile } from "@/lib/utils";

function fmtDate(d) {
    if (!d) return "—";
    return formatDisplayDate(d);
}

function fmtAmount(n, symbol) {
    return `${symbol ?? ""} ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

export function getOrderTableColumns({ can, onStatusUpdate, onUpdatePrice, onRegeneratePdf, onCustomerClick, onAddedByClick, onOrderClick }) {
    return [
        {
            id: "orderCode",
            header: "Order No.",
            accessorKey: "orderCode",
            cell: ({ row }) => (
                <span
                    className="font-semibold text-blue-600 cursor-pointer hover:underline"
                    // onClick={() => window.location.href = `/order/${row.original.orderId}`}
                    onClick={() => onOrderClick?.(`${row.original.orderId}`)}
                >
                    {row.original.orderCode ?? `OD-${row.original.orderId}`}
                </span>
            ),
        },
        {
            id: "customerName",
            header: "Customer",
            accessorKey: "customerName",
            cell: ({ row }) => (
                <span
                    className={row.original.customerId ? "text-blue-600 hover:underline cursor-pointer" : "text-gray-800"}
                    onClick={() => row.original.customerId && onCustomerClick?.(row.original.customerId)}
                >
                    {row.original.customerName ?? "—"}
                </span>
            ),
        },
        {
            id: "orderDate",
            header: "Order Date",
            accessorKey: "orderDate",
            cell: ({ row }) => fmtDate(row.original.orderDate),
        },
        {
            id: "deliveryDate",
            header: "Delivery Date",
            accessorKey: "deliveryDate",
            cell: ({ row }) => fmtDate(row.original.deliveryDate),
        },
        {
            id: "currencyCode",
            header: "Currency",
            accessorKey: "currencyCode",
            cell: ({ row }) => (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    {row.original.currencyCode ?? "—"}
                </span>
            ),
        },
        {
            id: "finalAmount",
            header: "Final Amount",
            accessorKey: "finalAmount",
            cell: ({ row }) => (
                <span className="font-semibold text-gray-800">
                    {fmtAmount(row.original.finalAmount, row.original.currency?.symbol ?? row.original.currencyCode)}
                </span>
            ),
        },
        {
            id: "status",
            header: "Status",
            accessorKey: "status",
            cell: ({ row }) => {
                const s = row.original.status;
                const cls = ORDER_STATUS_COLORS[s] ?? "bg-gray-100 text-gray-500";
                const label = ORDER_STATUS_LABELS[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—");
                return (
                    <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls} w-fit`}>
                            {label}
                        </span>
                        {row.original.orderStatus === "CLOSED" && (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 w-fit">
                                Closed
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            id: "addedByName",
            header: "Added By",
            accessorKey: "addedByName",
            cell: ({ row }) => (
                <span
                    className={row.original.addedBy ? "text-blue-600 hover:underline cursor-pointer" : "text-gray-600"}
                    onClick={() => row.original.addedBy && onAddedByClick?.(row.original.addedBy)}
                >
                    {row.original.addedByName ?? "—"}
                </span>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            enableSorting: false,
            cell: ({ row }) => {
                const q = row.original;
                const isOpen = q.orderStatus === "OPEN" || !q.orderStatus;

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer w-fit ml-auto">
                                <MoreVertical className="h-4 w-4" />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                            {/* 
                            <DropdownMenuItem onClick={() => window.location.href = `/order/${q.orderId}`} className="cursor-pointer text-sm py-2">
                                View Details
                            </DropdownMenuItem> */}

                            {isOpen && q.status === "DRAFT" && can?.("orderUpdate") !== false && (
                                <>
                                    <DropdownMenuItem onClick={() => window.location.href = `/order/${q.orderId}?edit=true`} className="cursor-pointer text-sm py-2">
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onStatusUpdate?.(q.orderId, "SUBMIT")} className="cursor-pointer text-sm py-2 font-medium text-blue-600 hover:bg-blue-50">
                                        Submit Order
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onStatusUpdate?.(q.orderId, "DELETE")} className="cursor-pointer text-sm py-2 text-red-600 hover:bg-red-50">
                                        Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                            {isOpen && q.status === "PLACED" && (
                                <>
                                    {q.invoicePdfPath && (
                                        <>
                                            <DropdownMenuItem onClick={() => window.open(`http://localhost:4000${q.invoicePdfPath}`, "_blank")} className="cursor-pointer text-sm py-2">
                                                View Pdf
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    const link = document.createElement("a");
                                                    link.href = `http://localhost:4000${q.invoicePdfPath}`;
                                                    link.download = `Invoice_${q.orderCode ?? q.orderId}.pdf`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }}
                                                className="cursor-pointer text-sm py-2"
                                            >
                                                Download Pdf
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    {can?.("orderUpdate") !== false && (
                                        <>
                                            <DropdownMenuItem onClick={() => onRegeneratePdf?.(q.orderId)} className="cursor-pointer text-sm py-2">
                                                Regenerate PDF
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onUpdatePrice?.(q)} className="cursor-pointer text-sm py-2">
                                                Update Price
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onStatusUpdate?.(q.orderId, "CANCEL")} className="cursor-pointer text-sm py-2 text-red-600 hover:bg-red-50">
                                                Cancel Order
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </>
                            )}
                            {isOpen && (q.status === "PARTIAL_DELIVERED" || q.status === "DELIVERED") && can?.("orderUpdate") !== false && (
                                <>
                                    <DropdownMenuItem onClick={() => onUpdatePrice?.(q)} className="cursor-pointer text-sm py-2">
                                        Update Price
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onStatusUpdate?.(q.orderId, "CLOSE")} className="cursor-pointer text-sm py-2">
                                        Close Order
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];
}
