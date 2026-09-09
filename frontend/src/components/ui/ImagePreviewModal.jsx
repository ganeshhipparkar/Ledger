"use client";

import AttachmentPreviewModal from "./AttachmentPreviewModal";

export default function ImagePreviewModal({ open, onClose, imageUrl, alt = "preview" }) {
    return (
        <AttachmentPreviewModal
            open={open}
            onClose={onClose}
            fileUrl={imageUrl}
            fileType="image"
            alt={alt}
        />
    );
}
