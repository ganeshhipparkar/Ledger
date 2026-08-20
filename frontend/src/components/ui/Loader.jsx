"use client";
import { Loader2 } from "lucide-react";

export default function Loader({ label, className = "", spinnerClassName = "" }) {
    return (
        <div className={`flex flex-col items-center justify-center p-8 gap-3 text-gray-600 ${className}`}>
            <Loader2 className={`h-8 w-8 animate-spin text-blue-600 ${spinnerClassName}`} />
            {label && <span className="text-base font-medium text-gray-600">{label}</span>}
        </div>
    );
}
