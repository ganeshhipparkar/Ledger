"use client";

import { useState, useMemo, useEffect } from "react";
import { Paperclip, Trash2, ArrowUp, FileText, Eye, Image as ImageIcon } from "lucide-react";
import { getImageUrl } from "@/lib/utils";
import AttachmentPreviewModal from "../ui/AttachmentPreviewModal";

export function getAttachmentType(fileOrUrl) {
    if (!fileOrUrl) return "other";

    if (typeof fileOrUrl === "object" && fileOrUrl instanceof File) {
        if (fileOrUrl.type.startsWith("image/")) return "image";
        if (fileOrUrl.type.includes("pdf") || fileOrUrl.name.toLowerCase().endsWith(".pdf")) return "pdf";
        const name = fileOrUrl.name.toLowerCase();
        if (/\.(jpg|jpeg|png|webp|gif)$/.test(name)) return "image";
        return "other";
    }

    const str = String(fileOrUrl).toLowerCase();
    if (/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/.test(str) || str.includes("image/")) return "image";
    if (str.endsWith(".pdf") || str.includes(".pdf?") || str.includes("application/pdf")) return "pdf";
    return "other";
}

export default function MultiFilePicker({
    selectedFiles = [],
    onFilesChange,
    existingAttachments = [],
    onDeleteExisting,
    label = "Attachments",
    required = false,
    accept,
    multiple = true,
    readOnly = false,
}) {
    const [error, setError] = useState("");
    const [previewState, setPreviewState] = useState({ open: false, url: "", type: "" });

    // Manage object URLs for newly uploaded local File objects
    const localPreviews = useMemo(() => {
        return selectedFiles.map((file) => {
            if (typeof window !== "undefined" && file instanceof File) {
                return {
                    file,
                    url: URL.createObjectURL(file),
                    type: getAttachmentType(file),
                };
            }
            return { file, url: "", type: "other" };
        });
    }, [selectedFiles]);

    // Cleanup object URLs on unmount/change
    useEffect(() => {
        return () => {
            localPreviews.forEach((item) => {
                if (item.url && item.url.startsWith("blob:")) {
                    URL.revokeObjectURL(item.url);
                }
            });
        };
    }, [localPreviews]);

    const handleFileSelect = (e) => {
        setError("");
        const filesArr = Array.from(e.target.files || []);
        if (filesArr.length === 0) return;

        if (accept) {
            const isPdfOnly = accept.includes("pdf");
            const invalidFile = filesArr.find((f) => {
                if (isPdfOnly) {
                    return !f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf");
                }
                return false;
            });

            if (invalidFile) {
                setError("Only PDF files are allowed.");
                e.target.value = "";
                return;
            }
        }

        if (!multiple) {
            const newFile = filesArr[0];
            onFilesChange?.([newFile]);
        } else {
            const combined = [...selectedFiles];
            filesArr.forEach((newFile) => {
                const exists = combined.some(
                    (f) => f.name === newFile.name && f.size === newFile.size
                );
                if (!exists) {
                    combined.push(newFile);
                }
            });
            onFilesChange?.(combined);
        }

        e.target.value = "";
    };

    const handleRemoveSelected = (indexToRemove) => {
        setError("");
        const updated = selectedFiles.filter((_, idx) => idx !== indexToRemove);
        onFilesChange?.(updated);
    };

    const handleCardClick = (url, type) => {
        if (!url) return;
        setPreviewState({ open: true, url, type });
    };

    const hasAnyAttachments = existingAttachments.length > 0 || localPreviews.length > 0;

    const uploadText = label
        ? label.startsWith("Upload")
            ? label
            : `Upload ${label}`
        : "Upload Attachments";

    return (
        <div className="space-y-3 w-full">
            {readOnly && label && (
                <label className="block text-sm font-semibold text-gray-800">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            {!readOnly && (
                <div className="relative w-full border border-dashed border-blue-500 rounded-lg py-3 px-4 bg-blue-50/10 hover:bg-blue-50/40 transition-colors text-center cursor-pointer flex items-center justify-center gap-2 group">
                    <input
                        type="file"
                        multiple={multiple}
                        accept={accept}
                        onChange={handleFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <ArrowUp className="h-4 w-4 text-blue-600 stroke-[2.5]" />
                    <span className="text-sm font-semibold text-blue-600 hover:underline">
                        {uploadText}
                    </span>
                </div>
            )}

            {error && <p className="text-xs text-red-600 font-medium pt-0.5">{error}</p>}

            {hasAnyAttachments ? (
                <div className="flex flex-wrap gap-2.5 pt-1">
                    {/* Existing Server Attachments */}
                    {existingAttachments.map((att, idx) => {
                        const rawPath = att.attachmentUrl || att.url || att.fileUrl || "";
                        const fullUrl = getImageUrl(rawPath);
                        const type = getAttachmentType(rawPath);
                        const attKey =
                            att.paymentTransactionAttachmentId ||
                            att.quotationAttachmentId ||
                            att.orderAttachmentId ||
                            att.id ||
                            `exist-${idx}`;

                        return (
                            <div
                                key={attKey}
                                onClick={() => handleCardClick(fullUrl, type)}
                                className="relative group w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-center justify-center shrink-0"
                            >
                                {type === "image" ? (
                                    <img
                                        src={fullUrl}
                                        alt="Attachment"
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                ) : type === "pdf" ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-gradient-to-br from-red-50 via-white to-red-100/50">
                                        <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shadow-sm group-hover:scale-110 transition-transform">
                                            <FileText className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-red-600 bg-red-100/80 border border-red-200 px-1 py-0.2 rounded-full mt-0.5">
                                            PDF
                                        </span>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-gradient-to-br from-gray-50 via-white to-gray-100">
                                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shadow-sm group-hover:scale-110 transition-transform">
                                            <Paperclip className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-gray-600 bg-gray-100 border border-gray-200 px-1 py-0.2 rounded-full mt-0.5">
                                            Doc
                                        </span>
                                    </div>
                                )}

                                {/* Hover preview overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <div className="h-6 w-6 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                                        <Eye className="h-3 w-3" />
                                    </div>
                                </div>

                                {/* Delete button in edit/add mode */}
                                {!readOnly && onDeleteExisting && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteExisting(attKey);
                                        }}
                                        title="Delete attachment"
                                        className="absolute top-1 right-1 z-20 p-1 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition cursor-pointer"
                                    >
                                        <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {/* Newly Selected Local Files */}
                    {localPreviews.map((item, idx) => (
                        <div
                            key={`local-${idx}`}
                            onClick={() => handleCardClick(item.url, item.type)}
                            className="relative group w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-blue-200 bg-blue-50/20 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-center justify-center shrink-0"
                        >
                            {item.type === "image" ? (
                                <img
                                    src={item.url}
                                    alt="New attachment"
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                            ) : item.type === "pdf" ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-gradient-to-br from-red-50 via-white to-red-100/50">
                                    <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shadow-sm group-hover:scale-110 transition-transform">
                                        <FileText className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-red-600 bg-red-100/80 border border-red-200 px-1 py-0.2 rounded-full mt-0.5">
                                        PDF
                                    </span>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-gradient-to-br from-gray-50 via-white to-gray-100">
                                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 shadow-sm group-hover:scale-110 transition-transform">
                                        <Paperclip className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-gray-600 bg-gray-100 border border-gray-200 px-1 py-0.2 rounded-full mt-0.5">
                                        Doc
                                    </span>
                                </div>
                            )}

                            {/* Hover preview overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="h-6 w-6 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow">
                                    <Eye className="h-3 w-3" />
                                </div>
                            </div>

                            {/* Delete button in edit/add mode */}
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveSelected(idx);
                                    }}
                                    title="Remove attachment"
                                    className="absolute top-1 right-1 z-20 p-1 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition cursor-pointer"
                                >
                                    <Trash2 className="h-2.5 w-2.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : readOnly ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <Paperclip className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm font-medium">No Attachments found.</p>
                </div>
            ) : null}

            {/* Same-Page Preview Modal */}
            <AttachmentPreviewModal
                open={previewState.open}
                onClose={() => setPreviewState({ open: false, url: "", type: "" })}
                fileUrl={previewState.url}
                fileType={previewState.type}
            />
        </div>
    );
}
