"use client";

import { Paperclip, Trash2, UploadCloud } from "lucide-react";

export default function MultiFilePicker({
    selectedFiles = [],
    onFilesChange,
    existingAttachments = [],
    onDeleteExisting,
    label = "Attachments",
    required = false,
}) {
    const handleFileSelect = (e) => {
        const filesArr = Array.from(e.target.files || []);
        if (filesArr.length === 0) return;

        // Prevent duplicate File additions by name + size
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
        e.target.value = "";
    };

    const handleRemoveSelected = (indexToRemove) => {
        const updated = selectedFiles.filter((_, idx) => idx !== indexToRemove);
        onFilesChange?.(updated);
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>

            {/* Drop / Picker zone */}
            <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 hover:bg-gray-100/80 transition-colors text-center cursor-pointer">
                <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-1 text-gray-500">
                    <UploadCloud className="h-6 w-6 text-gray-400" />
                    <p className="text-xs font-medium text-gray-600">
                        <span className="text-blue-600 font-semibold">Click to upload</span> or drag and drop files
                    </p>
                    <p className="text-[11px] text-gray-400">Multiple files supported</p>
                </div>
            </div>

            {/* List of existing attachments */}
            {existingAttachments.length > 0 && (
                <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Existing Attachments
                    </p>
                    <div className="space-y-1">
                        {existingAttachments.map((att) => {
                            const fileName = att.attachmentUrl
                                ? att.attachmentUrl.split("/").pop()
                                : `Attachment #${att.paymentTransactionAttachmentId}`;
                            return (
                                <div
                                    key={att.paymentTransactionAttachmentId}
                                    className="flex items-center justify-between p-2 rounded-lg bg-gray-100 border border-gray-200 text-xs text-gray-700"
                                >
                                    <a
                                        href={att.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 hover:text-blue-600 hover:underline truncate max-w-[80%]"
                                    >
                                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                                        <span className="truncate">{fileName}</span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => onDeleteExisting?.(att.paymentTransactionAttachmentId)}
                                        title="Delete existing attachment"
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* List of newly selected files */}
            {selectedFiles.length > 0 && (
                <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        New Files to Upload ({selectedFiles.length})
                    </p>
                    <div className="space-y-1">
                        {selectedFiles.map((file, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 border border-blue-200 text-xs text-gray-700"
                            >
                                <div className="flex items-center gap-2 truncate max-w-[80%]">
                                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                    <span className="truncate font-medium text-gray-800">{file.name}</span>
                                    <span className="text-[10px] text-gray-400">({formatFileSize(file.size)})</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSelected(idx)}
                                    title="Remove file"
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
