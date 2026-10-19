"use client";

import { useState, useEffect, useContext, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import dynamic from "next/dynamic";
import { toast } from "react-toastify";
import { Trash2, Plus, PenTool, X, RotateCcw } from "lucide-react";

import { loginContext } from "../hooks/LoginContext";
import Header from "../Header";
import Loader from "../ui/Loader";
import MultiFilePicker from "../common/MultiFilePicker";
import { DeliveryNoteFormSchema } from "../Zod";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";

const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false });
const MySwal = withReactContent(Swal);

const selectStyles = (hasError) => ({
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    control: (base) => ({
        ...base,
        borderRadius: "0.75rem",
        borderColor: hasError ? "#ef4444" : "#d1d5db",
        padding: "2px",
        fontSize: "0.875rem",
        boxShadow: "none",
        "&:hover": { borderColor: hasError ? "#ef4444" : "#3b82f6" },
    }),
});

export default function AddDeliveryNote() {
    const router = useRouter();
    const { activeAssignment } = useContext(loginContext) || {};
    const companyId = activeAssignment?.companyId;

    // Form states
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [orderOptions, setOrderOptions] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const [deliveryDate, setDeliveryDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split("T")[0];
    });

    const [receiverName, setReceiverName] = useState("");
    const [addressOptions, setAddressOptions] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [loadingAddresses, setLoadingAddresses] = useState(false);

    // Items table state
    const [deliverableLines, setDeliverableLines] = useState([]);
    const [rows, setRows] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Media
    const [receiverImage, setReceiverImage] = useState(null);
    const [receiverAttachments, setReceiverAttachments] = useState([]);
    const [receiverSignature, setReceiverSignature] = useState(null);

    // Signature Modal
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const sigCanvasRef = useRef(null);

    // Submission & validation state
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Load customer addresses and deliverable orders when customer changes
    useEffect(() => {
        if (!selectedCustomer?.value) {
            setAddressOptions([]);
            setSelectedAddress(null);
            setOrderOptions([]);
            setSelectedOrder(null);
            setDeliverableLines([]);
            setRows([]);
            return;
        }

        const custId = selectedCustomer.value;

        // Fetch Addresses from customer-details/:customerId
        setLoadingAddresses(true);
        fetch("/relayapi", {
            method: "GET",
            headers: {
                ...authHeaders(),
                endpoint: `customer-details/${custId}`,
                module: "customer",
            },
        })
            .then((res) => res.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                let addrs = [];
                if (Array.isArray(data?.addresses) && data.addresses.length > 0) {
                    addrs = data.addresses.map((a) => (typeof a === "string" ? a : a.address || a.street || ""));
                } else {
                    const composite = [data?.AddressLineOne, data?.city, data?.state, data?.country, data?.postalCode]
                        .filter(Boolean)
                        .join(", ");
                    if (composite) addrs.push(composite);
                }

                const opts = addrs.filter(Boolean).map((a) => ({ value: a, label: a }));
                setAddressOptions(opts);
                if (opts.length > 0) {
                    setSelectedAddress(opts[0]);
                } else {
                    setSelectedAddress(null);
                }
            })
            .catch(() => {
                setAddressOptions([]);
                setSelectedAddress(null);
            })
            .finally(() => setLoadingAddresses(false));

        // Fetch deliverable orders for customer
        setLoadingOrders(true);
        fetch("/relayapi", {
            method: "GET",
            headers: {
                ...authHeaders(),
                endpoint: `deliverable-orders/${custId}`,
                module: "delivery-note",
            },
        })
            .then((res) => res.json())
            .then((payload) => {
                const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const orders = result?.data || [];
                const opts = orders.map((o) => ({
                    value: o.orderId,
                    label: o.orderCode || `Order #${o.orderId}`,
                    orderDate: o.orderDate,
                    raw: o,
                }));
                setOrderOptions(opts);
                setSelectedOrder(null);
                setDeliverableLines([]);
                setRows([]);
            })
            .catch(() => {
                setOrderOptions([]);
                setSelectedOrder(null);
                setDeliverableLines([]);
                setRows([]);
            })
            .finally(() => setLoadingOrders(false));
    }, [selectedCustomer]);

    // Fetch deliverable order items
    const fetchOrderItems = async (orderId) => {
        if (!orderId) return;
        setLoadingItems(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `delivery-note-order-items/${orderId}`,
                    module: "delivery-note",
                },
            });
            const payload = await res.json();
            const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (result?.success === 0) {
                toast.error(result?.message || "Order is not deliverable.");
                setDeliverableLines([]);
                setRows([]);
                return;
            }

            const lines = result?.items || [];
            setDeliverableLines(lines);

            const validLines = lines.filter((l) => Number(l.pendingQuantity) > 0);
            if (validLines.length === 0) {
                toast.warning("No deliverable items remaining for this order.");
                setRows([]);
            } else {
                setRows(
                    validLines.map((l) => ({
                        orderItemId: l.orderItemId,
                        itemId: l.itemId,
                        description: l.description || l.itemName || `Item #${l.orderItemId}`,
                        requestedQuantity: Number(l.requestedQuantity),
                        pendingQuantity: Number(l.pendingQuantity),
                        deliverQuantity: String(l.pendingQuantity),
                    }))
                );
            }
        } catch (err) {
            console.error("fetchOrderItems error:", err);
            toast.error("Failed to load order items.");
            setDeliverableLines([]);
            setRows([]);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleOrderSelect = (option) => {
        setSelectedOrder(option);
        if (option?.value) {
            fetchOrderItems(option.value);
        } else {
            setDeliverableLines([]);
            setRows([]);
        }
    };

    const loadCustomerOptions = (inputValue, callback) => {
        fetch("/relayapi", {
            method: "POST",
            headers: {
                ...authHeaders(),
                endpoint: "customer-list",
                module: "customer",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                page: 1,
                limit: 50,
                filters: inputValue ? [{ key: "customerName", value: inputValue, operator: "like" }] : [],
            }),
        })
            .then((res) => res.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const list = data?.data || [];
                callback(
                    list.map((c) => ({
                        value: c.customerId,
                        label: c.customerName,
                        raw: c,
                    }))
                );
            })
            .catch(() => callback([]));
    };

    // Item row operations
    const canAddItem = deliverableLines.length > rows.length;

    const handleAddItem = () => {
        const usedIds = new Set(rows.map((r) => String(r.orderItemId)));
        const nextLine = deliverableLines.find((l) => !usedIds.has(String(l.orderItemId)));
        if (!nextLine) return;

        setRows((prev) => [
            ...prev,
            {
                orderItemId: nextLine.orderItemId,
                itemId: nextLine.itemId,
                description: nextLine.description || nextLine.itemName || `Item #${nextLine.orderItemId}`,
                requestedQuantity: Number(nextLine.requestedQuantity),
                pendingQuantity: Number(nextLine.pendingQuantity),
                deliverQuantity: String(nextLine.pendingQuantity),
            },
        ]);
    };

    const handleLineChange = (index, selectedOption) => {
        if (!selectedOption) return;
        const line = deliverableLines.find((l) => String(l.orderItemId) === String(selectedOption.value));
        if (!line) return;

        setRows((prev) => {
            const next = [...prev];
            next[index] = {
                orderItemId: line.orderItemId,
                itemId: line.itemId,
                description: line.description || line.itemName || `Item #${line.orderItemId}`,
                requestedQuantity: Number(line.requestedQuantity),
                pendingQuantity: Number(line.pendingQuantity),
                deliverQuantity: String(line.pendingQuantity),
            };
            return next;
        });
    };

    const handleQuantityChange = (index, value) => {
        setRows((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], deliverQuantity: value };
            return next;
        });
    };

    const handleRemoveRow = (index) => {
        if (rows.length <= 1) return;
        setRows((prev) => prev.filter((_, i) => i !== index));
    };

    // Row-level validation helper
    const getRowError = (row) => {
        if (!row.orderItemId) return "Item is required.";
        if (row.deliverQuantity === "" || row.deliverQuantity === undefined || row.deliverQuantity === null) {
            return "Deliver Qty is required.";
        }
        const qty = Number(row.deliverQuantity);
        if (isNaN(qty) || qty <= 0) {
            return "Deliver Qty must be > 0.";
        }
        const dec = String(row.deliverQuantity).split(".")[1];
        if (dec && dec.length > 4) {
            return "Max 4 decimal places allowed.";
        }
        if (qty > row.pendingQuantity) {
            return `Cannot exceed pending qty (${row.pendingQuantity}).`;
        }
        return null;
    };

    const handleDiscard = async () => {
        const result = await MySwal.fire({
            title: "Discard changes?",
            text: "All unsaved data will be lost.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Discard",
            confirmButtonColor: "#ef4444",
            cancelButtonText: "Keep editing",
        });
        if (result.isConfirmed) router.push("/delivery-note-list");
    };

    const handleSaveSignature = () => {
        if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
            toast.error("Please provide a signature before saving.");
            return;
        }
        try {
            const dataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL("image/png");
            setReceiverSignature(dataUrl);
            setSignatureModalOpen(false);
        } catch {
            toast.error("Failed to capture signature.");
        }
    };

    const handleSubmit = async () => {
        setSubmitAttempted(true);

        if (!companyId) {
            toast.error("No active company found");
            return;
        }

        if (!selectedCustomer) {
            toast.error("Please select a customer");
            return;
        }

        if (!selectedOrder) {
            toast.error("Please select an order");
            return;
        }

        if (!deliveryDate) {
            toast.error("Please select a delivery date");
            return;
        }

        if (!receiverName.trim()) {
            toast.error("Please enter receiver name");
            return;
        }

        if (!selectedAddress?.value) {
            toast.error("Please select a billing address");
            return;
        }

        if (rows.length === 0) {
            toast.error("At least one deliverable item is required");
            return;
        }

        let hasRowErrors = false;
        rows.forEach((r) => {
            if (getRowError(r)) hasRowErrors = true;
        });

        if (hasRowErrors) {
            toast.error("Please correct the errors in the items table before saving.");
            return;
        }

        const payloadObj = {
            companyId: String(companyId),
            customerId: String(selectedCustomer.value),
            orderId: String(selectedOrder.value),
            deliveryDate,
            receiverName: receiverName.trim(),
            billingAddress: selectedAddress.value,
            receiverSignature: receiverSignature || undefined,
            deliveryNoteItems: rows.map((r) => ({
                orderItemId: Number(r.orderItemId),
                deliverQuantity: Number(r.deliverQuantity),
                pendingQuantity: Number(r.pendingQuantity),
            })),
        };

        const valResult = DeliveryNoteFormSchema.safeParse(payloadObj);
        if (!valResult.success) {
            const firstErr = valResult.error.errors[0]?.message || "Validation failed";
            toast.error(firstErr);
            return;
        }

        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append("companyId", String(companyId));
            fd.append("customerId", String(selectedCustomer.value));
            fd.append("orderId", String(selectedOrder.value));
            fd.append("deliveryDate", deliveryDate);
            fd.append("receiverName", receiverName.trim());
            fd.append("billingAddress", selectedAddress.value);
            if (receiverSignature) {
                fd.append("receiverSignature", receiverSignature);
            }
            fd.append(
                "deliveryNoteItems",
                JSON.stringify(
                    rows.map((r) => ({
                        orderItemId: Number(r.orderItemId),
                        deliverQuantity: Number(r.deliverQuantity),
                    }))
                )
            );

            if (receiverImage) {
                fd.append("receiverImage", receiverImage);
            }

            receiverAttachments.forEach((att) => {
                fd.append("receiverAttachments", att);
            });

            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "delivery-note-add",
                    module: "delivery-note",
                },
                body: fd,
            });

            const payload = await res.json();
            const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (result && result.success === 1) {
                toast.success(result.message || "Delivery note created successfully!");
                router.push("/delivery-note-list");
            } else {
                toast.error(result?.message || "Failed to create delivery note.");
                if (selectedOrder?.value) {
                    fetchOrderItems(selectedOrder.value);
                }
            }
        } catch (err) {
            console.error("Save error:", err);
            toast.error("An unexpected error occurred while saving delivery note.");
            if (selectedOrder?.value) {
                fetchOrderItems(selectedOrder.value);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
            <Header page="add-delivery-note" />

            <div className="px-6 pt-4 pb-2">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-500">Delivery Information</span>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/delivery-note-list" className="cursor-pointer hover:text-blue-600">Delivery Note</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Add New</span>
                </nav>
            </div>

            <div className="flex-1 px-6 py-4 pb-32 space-y-5">
                <h1 className="text-2xl font-bold text-gray-900">Add New</h1>

                {/* Single Full-width White Card */}
                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 space-y-6">
                    {/* Title: Delivery Note with divider */}
                    <div className="pb-3 border-b border-gray-100">
                        <h2 className="text-base font-bold text-gray-900">Delivery Note</h2>
                    </div>

                    {/* Row 1: Customer and Order Number side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Customer */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Customer <span className="text-red-500">*</span>
                            </label>
                            <AsyncSelect
                                instanceId="customer-select"
                                cacheOptions
                                defaultOptions
                                loadOptions={loadCustomerOptions}
                                value={selectedCustomer}
                                onChange={(val) => setSelectedCustomer(val)}
                                placeholder="Select Customer..."
                                styles={selectStyles(submitAttempted && !selectedCustomer)}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {submitAttempted && !selectedCustomer && (
                                <p className="text-red-500 text-xs mt-1">Please select a customer.</p>
                            )}
                        </div>

                        {/* Order Number */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Order Number <span className="text-red-500">*</span>
                            </label>
                            <Select
                                instanceId="order-select"
                                value={selectedOrder}
                                onChange={handleOrderSelect}
                                options={orderOptions}
                                isLoading={loadingOrders}
                                isDisabled={!selectedCustomer}
                                placeholder={
                                    !selectedCustomer
                                        ? "Select a customer first"
                                        : orderOptions.length === 0
                                        ? "No deliverable orders available"
                                        : "Select Order..."
                                }
                                styles={selectStyles(submitAttempted && !selectedOrder)}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {submitAttempted && !selectedOrder && (
                                <p className="text-red-500 text-xs mt-1">Please select an order.</p>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Delivery Date in the left half */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Delivery Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                                    submitAttempted && !deliveryDate
                                        ? "border-red-500 focus:border-red-500"
                                        : "border-gray-300 focus:border-blue-500"
                                }`}
                            />
                            {submitAttempted && !deliveryDate && (
                                <p className="text-red-500 text-xs mt-1">Delivery date is required.</p>
                            )}
                        </div>
                    </div>

                    {/* Item(s) List heading with Add Item button and Items Table */}
                    <div className="pt-2 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900">Item(s) List</h3>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                disabled={!selectedOrder || !canAddItem}
                                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <Plus className="h-4 w-4" /> Add Item
                            </button>
                        </div>

                        {loadingItems ? (
                            <div className="py-8 flex justify-center">
                                <Loader label="Loading deliverable items..." />
                            </div>
                        ) : (
                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-left text-sm text-gray-700">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-600 border-b border-gray-200">
                                        <tr>
                                            <th className="py-3 px-3 w-12 text-center">#</th>
                                            <th className="py-3 px-4 min-w-[280px]">
                                                Description <span className="text-red-500">*</span>
                                            </th>
                                            <th className="py-3 px-4 w-40">Requested Qty (Unit(s))</th>
                                            <th className="py-3 px-4 w-40">Pending Qty (Unit(s))</th>
                                            <th className="py-3 px-4 w-48">
                                                Deliver Qty (Unit(s)) <span className="text-red-500">*</span>
                                            </th>
                                            <th className="py-3 px-3 w-16 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-gray-400">
                                                    {!selectedOrder
                                                        ? "Please select an order to populate deliverable items."
                                                        : "No deliverable items available for this order."}
                                                </td>
                                            </tr>
                                        ) : (
                                            rows.map((row, idx) => {
                                                const rowErr = submitAttempted ? getRowError(row) : null;

                                                const usedIdsOtherRows = new Set(
                                                    rows
                                                        .filter((_, i) => i !== idx)
                                                        .map((r) => String(r.orderItemId))
                                                );
                                                const lineOptions = deliverableLines
                                                    .filter((l) => !usedIdsOtherRows.has(String(l.orderItemId)))
                                                    .map((l) => ({
                                                        value: l.orderItemId,
                                                        label: l.description || l.itemName || `Item #${l.orderItemId}`,
                                                    }));

                                                const currentOpt = lineOptions.find(
                                                    (o) => String(o.value) === String(row.orderItemId)
                                                ) || {
                                                    value: row.orderItemId,
                                                    label: row.description,
                                                };

                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50/50 align-top">
                                                        <td className="py-3 px-3 text-center font-mono text-xs text-gray-500 pt-4">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <Select
                                                                instanceId={`row-select-${idx}`}
                                                                value={currentOpt}
                                                                onChange={(opt) => handleLineChange(idx, opt)}
                                                                options={lineOptions}
                                                                placeholder="Select line..."
                                                                styles={selectStyles(false)}
                                                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4 pt-4 font-medium text-gray-700">
                                                            {row.requestedQuantity}
                                                        </td>
                                                        <td className="py-3 px-4 pt-4 font-semibold text-amber-600">
                                                            {row.pendingQuantity}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                min="0"
                                                                value={row.deliverQuantity}
                                                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                                                placeholder="Enter qty..."
                                                                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                                                                    rowErr
                                                                        ? "border-red-500 focus:border-red-500"
                                                                        : "border-gray-300 focus:border-blue-500"
                                                                }`}
                                                            />
                                                            {rowErr && (
                                                                <p className="text-red-500 text-xs mt-1 font-medium">
                                                                    {rowErr}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3 text-center pt-3.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveRow(idx)}
                                                                disabled={rows.length <= 1}
                                                                title={rows.length <= 1 ? "At least one row required" : "Remove Row"}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Row: Receiver Name (left half) & Billing Address (right half) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        {/* Receiver Name */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Receiver Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={receiverName}
                                onChange={(e) => setReceiverName(e.target.value)}
                                placeholder="Enter receiver name..."
                                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                                    submitAttempted && !receiverName.trim()
                                        ? "border-red-500 focus:border-red-500"
                                        : "border-gray-300 focus:border-blue-500"
                                }`}
                            />
                            {submitAttempted && !receiverName.trim() && (
                                <p className="text-red-500 text-xs mt-1 font-medium">
                                    Receiver name is required.
                                </p>
                            )}
                        </div>

                        {/* Billing Address */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Billing Address <span className="text-red-500">*</span>
                            </label>
                            <Select
                                instanceId="billing-address-select"
                                value={selectedAddress}
                                onChange={(opt) => setSelectedAddress(opt)}
                                options={addressOptions}
                                isLoading={loadingAddresses}
                                isDisabled={!selectedCustomer}
                                placeholder={
                                    !selectedCustomer
                                        ? "Select a customer first"
                                        : addressOptions.length === 0
                                        ? "No addresses found for this customer"
                                        : "Select billing address..."
                                }
                                styles={selectStyles(submitAttempted && !selectedAddress)}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {selectedCustomer && addressOptions.length === 0 && !loadingAddresses && (
                                <p className="text-amber-600 text-xs mt-1 font-medium">
                                    This customer does not have any saved address.
                                </p>
                            )}
                            {submitAttempted && !selectedAddress && addressOptions.length > 0 && (
                                <p className="text-red-500 text-xs mt-1 font-medium">
                                    Billing address is required.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Row: Receiver Image (left half) & Receiver Attachments (right half) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        {/* Receiver Image */}
                        <div>
                            <MultiFilePicker
                                accept="image/*"
                                multiple={false}
                                selectedFiles={receiverImage ? [receiverImage] : []}
                                onFilesChange={(files) => setReceiverImage(files[0] || null)}
                                label="Receiver Image"
                            />
                        </div>

                        {/* Receiver Attachments */}
                        <div>
                            <MultiFilePicker
                                accept="application/pdf,image/*"
                                multiple={true}
                                selectedFiles={receiverAttachments}
                                onFilesChange={(files) => {
                                    if (files.length > 10) {
                                        toast.warning("Maximum 10 attachments allowed.");
                                        setReceiverAttachments(files.slice(0, 10));
                                    } else {
                                        setReceiverAttachments(files);
                                    }
                                }}
                                label="Receiver Attachments (Max 10)"
                            />
                        </div>
                    </div>

                    {/* Receiver Signature below */}
                    <div className="pt-2 space-y-3">
                        <label className="block text-xs font-semibold text-gray-700">
                            Receiver Signature
                        </label>

                        {!receiverSignature ? (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setSignatureModalOpen(true)}
                                    className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                                >
                                    <PenTool className="h-4 w-4 text-blue-600" />
                                    Signature
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <div className="h-20 w-48 rounded-xl border border-gray-200 bg-gray-50 p-2 flex items-center justify-center">
                                    <img
                                        src={receiverSignature}
                                        alt="Receiver Signature"
                                        className="max-h-full max-w-full object-contain"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSignatureModalOpen(true)}
                                        className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" /> Redo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReceiverSignature(null)}
                                        className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition cursor-pointer"
                                    >
                                        <X className="h-3.5 w-3.5" /> Remove
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fixed Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-center gap-4 shadow-lg">
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-sm disabled:opacity-50 cursor-pointer min-w-[120px]"
                >
                    {submitting ? "Saving..." : "Save"}
                </button>
                <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={submitting}
                    className="rounded-xl border border-gray-300 bg-white px-8 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50 min-w-[120px]"
                >
                    Discard
                </button>
            </div>

            {/* Signature Modal */}
            {signatureModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <h3 className="text-lg font-bold text-gray-900">Sign Below</h3>
                            <button
                                type="button"
                                onClick={() => setSignatureModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="border border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                            <SignatureCanvas
                                ref={sigCanvasRef}
                                canvasProps={{
                                    className: "w-full bg-white cursor-crosshair",
                                    style: { width: "100%", height: "200px" },
                                }}
                            />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={() => sigCanvasRef.current?.clear()}
                                className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                            >
                                Clear
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSignatureModalOpen(false)}
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveSignature}
                                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
