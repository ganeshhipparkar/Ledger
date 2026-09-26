"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { X, Calendar } from "lucide-react";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { formatDisplayDate } from "@/lib/utils";

export default function InvoiceDueDatePanel({ invoice, onClose, onSuccess }) {
    const today = new Date().toISOString().split("T")[0];
    const oneMonthAgo = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split("T")[0];
    })();

    const [newDueDate, setNewDueDate] = useState("");
    const [remarks, setRemarks] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (invoice) {
            setNewDueDate("");
            setRemarks("");
        }
    }, [invoice]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newDueDate) {
            toast.error("Please select a new due date.", { position: "top-right" });
            return;
        }
        if (!remarks.trim()) {
            toast.error("Please provide remarks for changing the due date.", { position: "top-right" });
            return;
        }
        if (false) {
            toast.error("Please select a new due date.", { position: "top-right" });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: {
                    ...authHeaders(),
                    endpoint: "invoice-update-due-date",
                    module: "invoice",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    invoiceId: invoice.invoiceId,
                    newDueDate,
                    remarks: remarks.trim() || undefined,
                }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success("Due date updated successfully.", { position: "top-right" });
                onSuccess?.();
            } else {
                toast.error(data?.message || "Failed to update due date.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    if (!invoice) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
                <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-blue-500" />
                            Update Due Date
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Invoice: <span className="font-medium text-gray-700">{invoice.invoiceCode}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-sm p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                    <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                        <div className="text-xs text-gray-500 mb-0.5">Current Exchange Date</div>
                        <div className="text-sm font-medium text-gray-800">{formatDisplayDate(invoice.deliveryDate) || "—"}</div>
                    </div>


                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            New Due Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            id="invoice-new-due-date"
                            value={newDueDate}
                            min={oneMonthAgo}
                            onChange={(e) => setNewDueDate(e.target.value)}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            required
                            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                    </div>


                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks <span className="text-red-500">*</span></label>
                        <textarea
                            id="invoice-due-date-remarks"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            required
                            rows={3}
                            placeholder="Reason for changing due date..."
                            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                        />
                    </div>


                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {loading ? "Updating…" : "Update "}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
