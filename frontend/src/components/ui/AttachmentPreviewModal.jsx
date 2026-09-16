"use client";

import { useEffect, useState } from "react";
import { X, FileText, Image as ImageIcon } from "lucide-react";

export default function AttachmentPreviewModal({
    open,
    onClose,
    fileUrl,
    fileType = "",
    alt = "Attachment Preview",
    title = "Attachment Preview",
}) {
    const [render, setRender] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (open) {
            setRender(true);
            const timer = setTimeout(() => {
                setVisible(true);
            }, 10);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
            const timer = setTimeout(() => {
                setRender(false);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    if (!render || !fileUrl) return null;

    const lowerUrl = typeof fileUrl === "string" ? fileUrl.toLowerCase() : "";
    const lowerType = typeof fileType === "string" ? fileType.toLowerCase() : "";

    const isPdf =
        lowerType.includes("pdf") ||
        lowerUrl.endsWith(".pdf") ||
        lowerUrl.includes(".pdf?") ||
        lowerUrl.includes("application/pdf");

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-200 ease-in-out ${visible ? "opacity-100" : "opacity-0"
                }`}
            onClick={onClose}
        >
            <div
                className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ease-in-out flex flex-col ${isPdf ? "w-full max-w-5xl h-[88vh]" : "w-full max-w-5xl max-h-[90vh] h-auto"
                    } ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/80">
                    <div className="flex items-center gap-2">
                        {isPdf ? (
                            <FileText className="h-5 w-5 text-red-500 shrink-0" />
                        ) : (
                            <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-gray-800">
                            {isPdf ? "Document Preview" : "Image Preview"}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition cursor-pointer"
                        title="Close preview"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 p-3 overflow-auto flex items-center justify-center bg-gray-900/5">
                    {isPdf ? (
                        <iframe
                            src={fileUrl}
                            title="Document Preview"
                            className="w-full h-full border-0 rounded-xl bg-white shadow-inner min-h-[500px]"
                        />
                    ) : (
                        <img
                            src={fileUrl}
                            alt={alt}
                            className="w-full h-auto max-h-[82vh] object-contain rounded-xl shadow-sm"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
