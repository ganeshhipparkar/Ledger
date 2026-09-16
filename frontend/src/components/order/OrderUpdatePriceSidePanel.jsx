"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { limitDecimals, formatDisplayDate } from "@/lib/utils";
import OrderSidePanel from "./OrderSidePanel";
import Loader from "../ui/Loader";

export default function OrderUpdatePriceSidePanel({
    isOpen,
    onClose,
    order,
    onSuccess,
}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingOrder, setFetchingOrder] = useState(false);
    const [selectedOrderIdForPanel, setSelectedOrderIdForPanel] = useState(null);

    useEffect(() => {
        if (!isOpen || !order?.orderId) {
            setItems([]);
            return;
        }

        const rawItems = order.orderItems || order.items;
        if (Array.isArray(rawItems) && rawItems.length > 0) {
            setItems(
                rawItems.map((it) => ({
                    orderItemId: it.orderItemId,
                    itemLabel: it.item?.itemName || it.itemName || it.description || `Item #${it.orderItemId}`,
                    currentPrice: it.unitPrice != null ? String(it.unitPrice) : "0",
                    newPrice: it.unitPrice != null ? String(it.unitPrice) : "0",
                }))
            );
        } else {
            setFetchingOrder(true);
            fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `order-details/${order.orderId}`,
                    module: "order",
                },
            })
                .then((res) => res.json())
                .then((payload) => {
                    const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                    const fetchedItems = data?.orderItems || data?.items || [];
                    setItems(
                        fetchedItems.map((it) => ({
                            orderItemId: it.orderItemId,
                            itemLabel: it.item?.itemName || it.itemName || it.description || `Item #${it.orderItemId}`,
                            currentPrice: it.unitPrice != null ? String(it.unitPrice) : "0",
                            newPrice: it.unitPrice != null ? String(it.unitPrice) : "0",
                        }))
                    );
                })
                .catch(() => {
                    toast.error("Failed to load order items for price update.");
                })
                .finally(() => {
                    setFetchingOrder(false);
                });
        }
    }, [isOpen, order]);

    const handleChange = (idx, value) => {
        const updated = [...items];
        updated[idx].newPrice = limitDecimals(value);
        setItems(updated);
    };

    const handleSave = async () => {
        const changedItems = items
            .filter((it) => {
                const cur = parseFloat(it.currentPrice) || 0;
                const next = parseFloat(it.newPrice) || 0;
                return cur !== next;
            })
            .map((it) => ({
                orderItemId: it.orderItemId,
                newUnitPrice: parseFloat(it.newPrice) || 0,
            }));

        if (changedItems.length === 0) {
            onClose();
            return;
        }

        setLoading(true);
        try {
            const body = {
                orderId: order.orderId,
                items: changedItems,
            };

            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: {
                    ...authHeaders(),
                    endpoint: "order-update-price",
                    module: "order",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (res.status === 401 || res.status === 403) {
                toast.error("Unauthorized to update order price.");
                return;
            }

            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1 || data?.status === true) {
                toast.success("Order price updated successfully.");
                onSuccess?.();
                onClose();
            } else {
                toast.error(data?.message || "Failed to update price.");
            }
        } catch (error) {
            toast.error(error.message || "Failed to update price.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
                <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">Update Item Price</h2>
                        {order?.orderCode && (
                            <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                                Order:
                                <button
                                    type="button"
                                    onClick={() => setSelectedOrderIdForPanel(order.orderId)}
                                    className="text-blue-600 hover:underline cursor-pointer border-none bg-transparent p-0 font-mono"
                                >
                                    {order.orderCode}
                                </button>
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer disabled:opacity-50"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {fetchingOrder ? (
                        <div className="flex justify-center py-16">
                            <Loader label="Loading items..." />
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-center text-gray-400 py-16">No items found for this order.</p>
                    ) : (
                        <table className="w-full text-left text-sm text-gray-600 border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 font-semibold w-12">#</th>
                                    <th className="px-4 py-3 font-semibold">Description</th>
                                    <th className="px-4 py-3 font-semibold text-right w-32">Current Price</th>
                                    <th className="px-4 py-3 font-semibold w-36">New Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((it, idx) => (
                                    <tr key={it.orderItemId} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3">{idx + 1}</td>
                                        <td className="px-4 py-3 font-medium text-gray-800 break-words">{it.itemLabel}</td>
                                        <td className="px-4 py-3 text-right">
                                            {it.currentPrice != null ? String(it.currentPrice) : "0"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={it.newPrice}
                                                onChange={(e) => handleChange(idx, e.target.value)}
                                                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="border-t px-6 py-4 flex gap-3 bg-white">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading || fetchingOrder}
                        className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                    >
                        Discard
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading || fetchingOrder}
                        className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer flex items-center justify-center disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {selectedOrderIdForPanel && (
                <OrderSidePanel
                    id={selectedOrderIdForPanel}
                    onClose={() => setSelectedOrderIdForPanel(null)}
                />
            )}
        </>
    );
}
