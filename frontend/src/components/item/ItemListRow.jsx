"use client";

import { useContext, useState } from "react";
import { ChevronDown, MoreVertical } from "lucide-react";
import { loginContext } from "../hooks/LoginContext";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import { getImageUrl } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export default function ItemListRow({ item, onPreview, onEdit, router }) {
    const { can } = useContext(loginContext);
    const [isOpen, setIsOpen] = useState(false);
    const [imageModalOpen, setImageModalOpen] = useState(false);

    return (
        <>
            <div className="px-6 py-6 border border-gray-200 bg-gray-50/2 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                    <div className="min-w-0">
                        <div className="text-sm text-gray-500 mb-1">Item Name</div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 min-w-[40px] items-center justify-center overflow-hidden rounded-full bg-blue-600 text-base font-bold uppercase text-white">
                                {item.primaryImage ? (
                                    <img
                                        src={getImageUrl(item.primaryImage)}
                                        alt={item.itemName}
                                        className="h-full w-full object-cover cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImageModalOpen(true);
                                        }}
                                    />
                                ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white text-base font-bold uppercase">
                                        {(item.itemName || "IT").substring(0, 2).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div
                                    className={`text-base font-semibold truncate ${can("itemView") ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                                    onClick={(e) => {
                                        if (!can("itemView")) return;
                                        e.stopPropagation();
                                        if (onPreview) onPreview(item.itemId);
                                    }}
                                >
                                    {item.itemName || "—"}
                                </div>
                                <div className="text-sm text-gray-500 font-mono">{item.itemCode || "-"}</div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="text-sm text-gray-500 mb-1">Category</div>
                        <div className="text-base text-gray-800 break-all">{item.categoryName || "-"}</div>
                    </div>

                    <div>
                        <div className="text-sm text-gray-500 mb-1">Status</div>
                        <span
                            className={
                                item.status === "Active"
                                    ? "inline-block rounded-full bg-green-100 px-3 py-1 text-base text-green-700"
                                    : item.status === "Inactive"
                                        ? "inline-block rounded-full bg-red-100 px-3 py-1 text-base text-red-700"
                                        : "inline-block rounded-full bg-sky-100 px-3 py-1 text-base text-sky-700"
                            }
                        >
                            {item.status || "Inactive"}
                        </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Company</div>
                            <div className="text-base text-[#3563e9] font-medium">
                                <LinkedCompanyCell
                                    companyId={item.companyId}
                                    companyName={item.companyName || item.company?.companyName}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <span
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                                        title="Actions"
                                    >
                                        <MoreVertical className="h-5 w-5" />
                                    </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg rounded-xl">
                                    {can("itemView") && (
                                        <DropdownMenuItem
                                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onPreview) onPreview(item.itemId);
                                            }}
                                        >
                                            View Details
                                        </DropdownMenuItem>
                                    )}
                                    {can("itemUpdate") && (
                                        <DropdownMenuItem
                                            className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onEdit) onEdit(item.itemId);
                                            }}
                                        >
                                            Edit
                                        </DropdownMenuItem>
                                    )}

                                </DropdownMenuContent>
                            </DropdownMenu>

                            <button
                                type="button"
                                onClick={() => setIsOpen(!isOpen)}
                                aria-label={isOpen ? "Collapse" : "Expand"}
                                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                                <ChevronDown
                                    className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {isOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Barcode</div>
                            <div className="text-base text-gray-800 font-mono break-all">{item.barcode || "-"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Manufacturer</div>
                            <div className="text-base text-gray-800 break-all">{item.manufacturerName || "-"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Brand</div>
                            <div className="text-base text-gray-800">{item.brandName || "-"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Package Type / UOM</div>
                            <div className="text-base text-gray-800">
                                {item.packageName || "-"} {item.itemUomName ? `(${item.itemUomName})` : ""}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ImagePreviewModal
                open={imageModalOpen}
                onClose={() => setImageModalOpen(false)}
                imageUrl={getImageUrl(item.primaryImage)}
                alt={item.itemName}
            />
        </>
    );
}

