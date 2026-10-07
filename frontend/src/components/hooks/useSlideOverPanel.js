"use client";
import { useEffect, useState } from "react";

export function useSlideOverPanel(onClose, duration = 300) {
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        const timer = requestAnimationFrame(() => {
            setIsOpen(true);
        });
        return () => cancelAnimationFrame(timer);
    }, []);

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);
        setIsOpen(false);
        setTimeout(() => {
            if (onClose) onClose();
        }, duration);
    };

    return {
        isOpen,
        isClosing,
        handleClose,
    };
}
