"use client";
import React, { useEffect, useState, useContext } from "react";
import Link from "next/link";
import { loginContext } from "../hooks/LoginContext";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import Loader from "../ui/Loader";
import { STATUS_COLORS, STATUS_LABELS } from "../invoice/InvoiceList";
import { limitPriceDecimals } from "@/lib/utils";

export default function PaymentInvoicesTab({ paymentTransactionId, refreshKey }) {
    const { can, displayUser } = useContext(loginContext) || {};
    const [data, setData] = useState([]);
    const [totalApplied, setTotalApplied] = useState(0);
    const [transactionAmount, setTransactionAmount] = useState(0);
    const [currencySymbol, setCurrencySymbol] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!paymentTransactionId) return;
        const fetchInvoices = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await fetch("/relayapi", {
                    method: "GET",
                    headers: {
                        ...authHeaders(),
                        endpoint: `payment-transaction-invoices/${paymentTransactionId}`,
                        module: "payment-transaction",
                    },
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch invoices");
                }
                const payload = await response.json();
                const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (result.success === 1) {
                    setData(result.data || []);
                    setTotalApplied(result.totalApplied || 0);
                    setTransactionAmount(result.transactionAmount || 0);
                    setCurrencySymbol(result.currencySymbol || result.currencyCode || "");
                } else {
                    setError(result.message || "Failed to load invoices");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchInvoices();
    }, [paymentTransactionId, refreshKey]);

    if (loading) return <Loader />;
    if (error) return <div className="p-6 text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-base font-bold text-gray-800">
                    Invoices Applied
                </h3>
                <div className="text-sm">
                    <span className="text-gray-500">Total Applied: </span>
                    <span className="font-bold text-green-600">
                        {currencySymbol} {Number(limitPriceDecimals(totalApplied)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="mx-2 text-gray-300">/</span>
                    <span className="text-gray-500">Payment Amount: </span>
                    <span className="font-bold text-gray-800">
                        {currencySymbol} {Number(limitPriceDecimals(transactionAmount)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-xl">Invoice No.</th>
                                <th className="px-4 py-3">Invoice Date</th>
                                <th className="px-4 py-3">Invoice Total</th>
                                <th className="px-4 py-3">Applied from Payment</th>
                                <th className="px-4 py-3">Applied On</th>
                                <th className="px-4 py-3 rounded-tr-xl">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                                        No invoices applied for this payment.
                                    </td>
                                </tr>
                            ) : (
                                data.map((inv) => (
                                    <tr key={inv.invoiceId} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {(can && can("invoiceView")) || displayUser?.isSuperAdmin ? (
                                                <Link href={`/invoice/${inv.invoiceId}`} className="text-blue-600 hover:underline">
                                                    {inv.invoiceCode}
                                                </Link>
                                            ) : (
                                                inv.invoiceCode
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {new Date(inv.invoiceDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 font-mono">
                                            {Number(limitPriceDecimals(inv.finalAmount)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-gray-600 font-medium">
                                            {Number(limitPriceDecimals(inv.amountApplied)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {new Date(inv.appliedDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                                                {STATUS_LABELS[inv.status] || inv.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
