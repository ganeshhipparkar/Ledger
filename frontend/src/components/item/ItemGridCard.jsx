"use client";

import { useContext, useState } from "react";
import { MoreVertical } from "lucide-react";
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

export default function ItemGridCard({ item, onPreview, onEdit, router }) {
    const { can } = useContext(loginContext);
    const [imageModalOpen, setImageModalOpen] = useState(false);

    return (
        <>
            <div className="relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">

                <div className="absolute top-4 right-4 z-10">
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
                </div>

                <div className="flex items-start gap-4 mb-4">
                    <div className="flex h-20 w-20 min-w-[80px] items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold uppercase text-blue-600 shadow-md">
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
                            <span className="text-blue-600">
                                {(item.itemName || "IT").substring(0, 2).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                        <div
                            className={`font-semibold text-lg truncate ${can("itemView") ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                            onClick={(e) => {
                                if (!can("itemView")) return;
                                e.stopPropagation();
                                if (onPreview) onPreview(item.itemId);
                            }}
                        >
                            {item.itemName || "—"}
                        </div>
                        <div className="text-sm text-gray-600 break-all mt-1">
                            {item.itemCode || "-"}
                        </div>
                        <div
                            className={
                                item.status === "Active"
                                    ? "mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                                    : item.status === "Inactive"
                                        ? "mt-2 inline-block rounded-full bg-red-100 px-3 py-1 text-sm text-red-700"
                                        : "mt-2 inline-block rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-700"
                            }
                        >
                            {item.status || "Inactive"}
                        </div>
                    </div>
                </div>

                <div className="text-sm text-gray-600 pt-3 pb-3 border-y border-gray-200 py-1">
                    <span className="text-[#71717b] text-xs uppercase tracking-wide">
                        Category
                    </span>
                    <p className="font-semibold mt-1 break-words">
                        {item.categoryName || "-"}
                    </p>
                </div>

                <div className="space-y-2 mt-4">
                    <div className="text-sm text-gray-600 break-all">
                        <span className="font-medium">Manufacturer:</span>{" "}
                        {item.manufacturerName || "-"}
                    </div>
                    <div className="text-sm text-gray-600">
                        <span className="font-medium">Brand:</span>{" "}
                        {item.brandName || "-"}
                    </div>
                    <div className="text-sm text-gray-600">
                        <span className="font-medium">Company:</span>{" "}
                        <LinkedCompanyCell
                            companyId={item.companyId}
                            companyName={item.companyName || item.company?.companyName}
                        />
                    </div>
                </div>
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



