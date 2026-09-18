"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { formatDisplayDate } from "@/lib/utils";
import SidePanel from "../common/SidePanel";
import CustomerSidePanel from "../customer/CustomerSidePanel";
import DetailsSidePanel from "../DetailsSidePanel";
import { itemSidePanelConfig } from "../item/configs/itemSidePanel.config";

export default function OrderSidePanel({ id, onClose }) {
    const router = useRouter();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorType, setErrorType] = useState(null);

    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [selectedItemForPanel, setSelectedItemForPanel] = useState(null);

    useEffect(() => {
        if (!id) return;
        let isMounted = true;
        const fetchData = async () => {
            setLoading(true);
            setErrorType(null);
            try {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: {
                        ...authHeaders(),
                        endpoint: `order-details/${id}`,
                        module: "order",
                    },
                });
                if (res.status === 403) {
                    if (isMounted) setErrorType("forbidden");
                    return;
                }
                const payload = await res.json();
                const result = payload.encrypted
                    ? decryptResponse(payload.encrypted)
                    : payload;
                if (isMounted) {
                    if (result?.orderId) {
                        setData(result);
                    } else {
                        setErrorType("not-found");
                    }
                }
            } catch (err) {
                console.error("[OrderSidePanel] fetch error:", err);
                if (isMounted) setErrorType("not-found");
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [id]);

    const sections = data ? [
        {
            title: "Order Info",
            rows: [
                {
                    label: "Customer",
                    value: data.customerId ? (
                        <button
                            type="button"
                            // onClick={() => setSelectedCustomerId(data.customerId)}
                            // className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left bg-transparent border-none p-0"
                            className="font-medium text-left bg-transparent border-none p-0"

                        >
                            {data.customerName || "Customer Details"}
                        </button>
                    ) : "—"
                },
                { label: "Order Date", value: formatDisplayDate(data.orderDate) || "—" },
                { label: "Delivery Date", value: formatDisplayDate(data.deliveryDate) || "—" },
                {
                    label: "Order Pdf",
                    value: data.invoicePdfPath ? (
                        <a
                            href={`http://localhost:4000${data.invoicePdfPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                        >
                            View
                        </a>
                    ) : "—"
                }
            ]
        }
    ] : [];

    const customContent = data ? (
        <div className="px-6 py-4 space-y-5">
            <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 border-b pb-2">
                    Item(s) — Total: {data.orderItems?.length || 0}
                </h4>
                <div className="space-y-3">
                    {(data.orderItems || []).map((it, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow transition-shadow">
                            <div className="flex-1 min-w-0">
                                {it.itemId ? (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedItemForPanel(it.itemId)}
                                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-sm text-left truncate w-full"
                                    >
                                        {it.item?.itemName ?? it.itemCode ?? "—"}
                                    </button>
                                ) : (
                                    <span className="font-semibold text-gray-800 text-sm truncate block">
                                        {it.description ?? "—"}
                                    </span>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    {it.quantity} {it.itemUomRel?.uomName || "Unit(s)"}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-gray-800">
                                    {data.currencySymbol || ""}{Number(it.finalAmount ?? (it.totalAmount ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 border-b pb-2">
                    Summary — {data.currencyCode || ""} ({data.currencySymbol || ""})
                </h4>
                <div className="space-y-2 text-sm bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-center text-gray-600">
                        <span>Gross Amount</span>
                        <span className="font-medium">{Number(data.taxableAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                        <span>Discount</span>
                        <span className="font-medium text-orange-600">-{Number(data.discount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-gray-900 border-t border-blue-200/50 pt-2 mt-2">
                        <span>Receivable</span>
                        <span className="text-blue-700 text-base">{data.currencySymbol || ""}{Number(data.finalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            <SidePanel
                isOpen={true}
                onClose={onClose}
                loading={loading}
                errorType={errorType}
                title="Order Details"
                name={data?.orderCode || ""}
                status={data?.status || ""}
                onMoreDetails={() => {
                    onClose();
                    router.push(`/order/${id}`);
                }}
                moreDetailsId={id}
                sections={sections}
                customContent={customContent}
            />

            {selectedCustomerId && (
                <CustomerSidePanel
                    id={selectedCustomerId}
                    onClose={() => setSelectedCustomerId(null)}
                />
            )}

            {selectedItemForPanel && (
                <DetailsSidePanel
                    config={itemSidePanelConfig}
                    id={selectedItemForPanel}
                    onClose={() => setSelectedItemForPanel(null)}
                />
            )}
        </>
    );
}
