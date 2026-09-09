"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";

export default function PaymentTransactionStatusSidePanel({
    isOpen,
    onClose,
    transactionId,
    action = "approve",
    onSuccess,
}) {
    const [remarks, setRemarks] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const [visible, setVisible] = useState(false);
    const [mounted, setMounted] = useState(false);
    const timerRef = useRef(null);

    const isApprove = action === "approve";
    const title = isApprove
        ? "Approve Payment Transaction"
        : "Cancel Payment Transaction";
    const endpoint = isApprove
        ? "payment-transaction-approve"
        : "payment-transaction-cancel";

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            setRemarks("");
            setError("");
        } else {
            timerRef.current = setTimeout(() => setVisible(false), 300);
        }
        return () => clearTimeout(timerRef.current);
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!remarks || remarks.trim() === "") {
            setError("Remarks are required.");
            return;
        }

        setLoading(true);
        try {
            const numericId = Number(
                Array.isArray(transactionId) ? transactionId[0] : transactionId
            );

            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: {
                    ...authHeaders(),
                    endpoint,
                    module: "payment-transaction",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    paymentTransactionId: numericId,
                    remarks: remarks.trim(),
                }),
            });

            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (res.ok && data?.success === 1) {
                toast.success(
                    isApprove
                        ? "Payment transaction approved successfully"
                        : "Payment transaction cancelled successfully",
                    { position: "top-right" }
                );
                onSuccess?.();
                onClose();
            } else {
                const msg = data?.message || `Failed to ${action} payment transaction.`;
                setError(msg);
                toast.error(msg, { position: "top-right" });
            }
        } catch {
            toast.error("An unexpected error occurred.", { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    if (!mounted || !visible) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">

            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"
                    }`}
                onClick={onClose}
            />


            <div
                className={`absolute inset-y-0 right-0 max-w-full flex pl-10 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">

                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Remarks <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={4}
                                value={remarks}
                                onChange={(e) => {
                                    setRemarks(e.target.value);
                                    if (error) setError("");
                                }}
                                placeholder={
                                    isApprove
                                        ? "Enter approval remarks..."
                                        : "Enter reason for cancellation..."
                                }
                                className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm text-gray-800 outline-none transition ${error
                                    ? "border-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:border-blue-500"
                                    }`}
                            />
                            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                        </div>

                        <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`px-5 py-2 text-sm font-medium text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 ${isApprove
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-red-600 hover:bg-red-700"
                                    }`}
                            >
                                {loading
                                    ? "Processing..."
                                    : isApprove
                                        ? "Approve"
                                        : "Cancel Transaction"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
