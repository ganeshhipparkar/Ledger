"use client";
import React, { useEffect, useState, useContext } from "react";
import Link from "next/link";
import { loginContext } from "../hooks/LoginContext";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import Loader from "../ui/Loader";
import { limitPriceDecimals } from "@/lib/utils";

function PaymentTransactionStatusBadge({ status }) {
    let badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    if (status === "Approved") badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "Cancelled") badgeClass = "bg-red-50 text-red-700 border-red-200";

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
            {status || "Pending"}
        </span>
    );
}

export default function InvoicePaymentsTab({ invoiceId, refreshKey }) {
    const { can, displayUser } = useContext(loginContext) || {};
    const [data, setData] = useState([]);
    const [totalApplied, setTotalApplied] = useState(0);
    const [finalAmount, setFinalAmount] = useState(0);
    const [currencySymbol, setCurrencySymbol] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!invoiceId) return;
        const fetchPayments = async () => {
            setLoading(true);
            setError("");
            try {
                const response = await fetch("/relayapi", {
                    method: "GET",
                    headers: {
                        ...authHeaders(),
                        endpoint: `invoice-payments/${invoiceId}`,
                        module: "invoice",
                    },
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch payments");
                }
                const payload = await response.json();
                const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (result.success === 1) {
                    setData(result.data || []);
                    setTotalApplied(result.totalApplied || 0);
                    setFinalAmount(result.finalAmount || 0);
                    setCurrencySymbol(result.currencySymbol || result.currencyCode || "");
                } else {
                    setError(result.message || "Failed to load payments");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchPayments();
    }, [invoiceId, refreshKey]);

    if (loading) return <Loader />;
    if (error) return <div className="p-6 text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-base font-bold text-gray-800">
                    Payments Applied
                </h3>
                <div className="text-sm">
                    <span className="text-gray-500">Total Paid: </span>
                    <span className="font-bold text-green-600">
                        {currencySymbol} {Number(limitPriceDecimals(totalApplied)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="mx-2 text-gray-300">/</span>
                    <span className="text-gray-500">Invoice Total: </span>
                    <span className="font-bold text-gray-800">
                        {currencySymbol} {Number(limitPriceDecimals(finalAmount)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-xl">Payment Code</th>
                                <th className="px-4 py-3">Payment Date</th>
                                <th className="px-4 py-3">Mode</th>
                                <th className="px-4 py-3">Payment Amount</th>
                                <th className="px-4 py-3">Applied to Invoice</th>
                                <th className="px-4 py-3">Applied On</th>
                                <th className="px-4 py-3 rounded-tr-xl">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                        No payments applied for this invoice.
                                    </td>
                                </tr>
                            ) : (
                                data.map((pay) => (
                                    <tr key={pay.paymentTransactionId} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {(can && can("paymentTransactionView")) || displayUser?.isSuperAdmin ? (
                                                <Link href={`/payment-transaction/${pay.paymentTransactionId}`} className="text-blue-600 hover:underline">
                                                    {pay.paymentCode}
                                                </Link>
                                            ) : (
                                                pay.paymentCode
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {new Date(pay.paymentDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {pay.paymentMode}
                                        </td>
                                        <td className="px-4 py-3 font-mono">
                                            {Number(limitPriceDecimals(pay.transactionAmount)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-gray-600 font-medium">
                                            {Number(limitPriceDecimals(pay.amountApplied)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {new Date(pay.appliedDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <PaymentTransactionStatusBadge status={pay.status} />
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
