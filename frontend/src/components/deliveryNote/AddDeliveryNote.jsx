"use client";

import { useState, useEffect, useContext, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import dynamic from "next/dynamic";
import { toast } from "react-toastify";
import { PenTool, X, RotateCcw } from "lucide-react";

import { loginContext } from "../hooks/LoginContext";
import Header from "../Header";
import MultiFilePicker from "../common/MultiFilePicker";
import { DeliveryNoteFormSchema } from "../Zod";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { Country } from "country-state-city";
import DeliveryNoteItemsTable, {
    newEmptyDeliveryNoteItem,
} from "./DeliveryNoteItemsTable";

const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false });
const MySwal = withReactContent(Swal);

const selectStyles = (hasError) => ({
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    control: (base, state) => ({
        ...base,
        borderRadius: "0.75rem",
        borderColor: hasError ? "#ef4444" : "#d1d5db",
        backgroundColor: state.isDisabled ? "#f9fafb" : "#ffffff",
        cursor: state.isDisabled ? "not-allowed" : "default",
        padding: "2px",
        fontSize: "0.875rem",
        boxShadow: "none",
        "&:hover": { borderColor: hasError ? "#ef4444" : state.isDisabled ? "#d1d5db" : "#3b82f6" },
    }),
    singleValue: (base, state) => ({
        ...base,
        color: state.isDisabled ? "#374151" : base.color,
        fontWeight: state.isDisabled ? 500 : base.fontWeight,
    }),
});

export default function AddDeliveryNote() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromOrderId = searchParams?.get("fromOrder");
    const presetCustomerId = searchParams?.get("customerId");
    const isLocked = Boolean(fromOrderId);
    const isCustomerLocked = isLocked || Boolean(!fromOrderId && presetCustomerId);

    const { activeAssignment } = useContext(loginContext) || {};
    const companyId = activeAssignment?.companyId;

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [orderOptions, setOrderOptions] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const [deliveryDate, setDeliveryDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split("T")[0];
    });

    const [receiverName, setReceiverName] = useState("");
    const [selectedAddress, setSelectedAddress] = useState(null);
    const countries = Country.getAllCountries().map((c) => ({ value: c.name, label: c.name }));

    const [deliverableLines, setDeliverableLines] = useState([]);
    const [items, setItems] = useState([newEmptyDeliveryNoteItem()]);
    const [loadingItems, setLoadingItems] = useState(false);

    const [errors, setErrors] = useState({});
    const [rowErrors, setRowErrors] = useState({});

    const [receiverImage, setReceiverImage] = useState(null);
    const [receiverAttachments, setReceiverAttachments] = useState([]);
    const [receiverSignature, setReceiverSignature] = useState(null);

    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    const sigCanvasRef = useRef(null);

    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!fromOrderId) return;
        let isMounted = true;

        const loadOrder = async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: {
                        ...authHeaders(),
                        endpoint: `order-details/${fromOrderId}`,
                        module: "order",
                    },
                });

                const payload = await res.json().catch(() => ({}));
                const order = payload?.encrypted ? decryptResponse(payload.encrypted) : payload;

                if (!res.ok || !order?.orderId) {
                    const errorMsg =
                        order?.message ||
                        (res.status === 403
                            ? "Access denied: order belongs to another company"
                            : "Order not found.");
                    toast.error(errorMsg);
                    router.push("/order-list");
                    return;
                }

                const isDeliverable =
                    (order.orderStatus === "OPEN" || !order.orderStatus) &&
                    (order.status === "PLACED" || order.status === "PARTIAL_DELIVERED");

                if (!isDeliverable) {
                    toast.error("Order is not deliverable.");
                    router.push(`/order/${fromOrderId}`);
                    return;
                }

                if (!isMounted) return;

                const custLabel =
                    order.customerName ||
                    order.customer?.customerName ||
                    `Customer #${order.customerId}`;
                const custOpt = { value: order.customerId, label: custLabel };
                const ordOpt = {
                    value: order.orderId,
                    label: order.orderCode || `Order #${order.orderId}`,
                    orderDate: order.orderDate,
                    raw: order,
                };

                setSelectedCustomer(custOpt);
                setSelectedOrder(ordOpt);
                setOrderOptions([ordOpt]);

                fetchOrderItems(order.orderId);
            } catch (err) {
                console.error("loadFromOrder error:", err);
                toast.error(err.message || "Failed to load order details.");
                router.push("/order-list");
            }
        };

        loadOrder();
        return () => {
            isMounted = false;
        };
    }, [fromOrderId]);

    useEffect(() => {
        if (fromOrderId || !presetCustomerId) return;
        let isMounted = true;

        const loadPresetCustomer = async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: {
                        ...authHeaders(),
                        endpoint: `customer-details/${presetCustomerId}`,
                        module: "customer",
                    },
                });
                const payload = await res.json().catch(() => ({}));
                const data = payload?.encrypted ? decryptResponse(payload.encrypted) : payload;

                if (!res.ok || !data?.customerId) {
                    toast.error(data?.message || "Customer not found.");
                    return;
                }

                if (!isMounted) return;

                const custLabel = data.customerName || `Customer #${data.customerId}`;
                setSelectedCustomer({ value: data.customerId, label: custLabel });
            } catch (err) {
                console.error("loadPresetCustomer error:", err);
                toast.error("Failed to load customer details.");
            }
        };

        loadPresetCustomer();
        return () => {
            isMounted = false;
        };
    }, [fromOrderId, presetCustomerId]);

    useEffect(() => {
        if (isLocked) return;

        setOrderOptions([]);
        setSelectedOrder(null);
        setDeliverableLines([]);
        setItems([newEmptyDeliveryNoteItem()]);
        setRowErrors({});

        if (!selectedCustomer?.value) {
            return;
        }

        const custId = selectedCustomer.value;

        setLoadingOrders(true);
        fetch("/relayapi", {
            method: "GET",
            headers: {
                ...authHeaders(),
                endpoint: `deliverable-orders/${custId}`,
                module: "delivery-note",
            },
        })
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch orders (HTTP ${res.status})`);
                }
                return res.json();
            })
            .then((payload) => {
                const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (result && result.success === 0) {
                    toast.error(result.message || "Failed to fetch deliverable orders");
                    setOrderOptions([]);
                    setSelectedOrder(null);
                    return;
                }
                const orders = result?.data || [];
                const opts = orders.map((o) => ({
                    value: o.orderId,
                    label: o.orderCode || `Order #${o.orderId}`,
                    orderDate: o.orderDate,
                    raw: o,
                }));
                setOrderOptions(opts);
                setSelectedOrder(null);
            })
            .catch((err) => {
                console.error("fetchDeliverableOrders error:", err);
                toast.error(err.message || "Failed to load deliverable orders.");
                setOrderOptions([]);
                setSelectedOrder(null);
            })
            .finally(() => setLoadingOrders(false));
    }, [selectedCustomer, isLocked]);

    const fetchOrderItems = async (orderId, isRefreshAfterReject = false) => {
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
            if (!res.ok) {
                throw new Error(`Failed to fetch order items (HTTP ${res.status})`);
            }
            const payload = await res.json();
            const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (result && result.success === 0) {
                toast.error(result?.message || "Order is not deliverable.");
                setDeliverableLines([]);
                return;
            }

            const freshLines = result?.items || result?.data || [];
            setDeliverableLines(freshLines);

            if (freshLines.length === 0) {
                toast.info("No deliverable items remaining for this order.");
                return;
            }

            if (isRefreshAfterReject) {
                const linesMap = new Map(
                    freshLines.map((l) => [String(l.orderItemId), l])
                );
                setItems((prev) =>
                    prev.map((row) => {
                        const line = linesMap.get(String(row.orderItemId));
                        if (!line) return row;
                        const freshPending = line.pendingQuantity;
                        const currentDeliver = Number(row.deliverQuantity);
                        return {
                            ...row,
                            requestedQuantity: line.requestedQuantity,
                            deliveredQuantity: line.deliveredQuantity,
                            pendingQuantity: freshPending,
                            deliverQuantity:
                                currentDeliver > freshPending ? String(freshPending) : row.deliverQuantity,
                        };
                    })
                );
            }
        } catch (err) {
            console.error("fetchOrderItems error:", err);
            toast.error(err.message || "Failed to load order items.");
            setDeliverableLines([]);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleCustomerSelect = (val) => {
        setSelectedCustomer(val);
        setSelectedOrder(null);
        setOrderOptions([]);
        setDeliverableLines([]);
        setItems([newEmptyDeliveryNoteItem()]);
        setRowErrors({});
        setErrors((prev) => {
            const next = { ...prev };
            delete next.customerId;
            delete next.orderId;
            delete next.deliveryNoteItems;
            return next;
        });
    };

    const handleOrderSelect = (option) => {
        setSelectedOrder(option);
        setItems([newEmptyDeliveryNoteItem()]);
        setRowErrors({});
        setErrors((prev) => {
            const next = { ...prev };
            delete next.orderId;
            delete next.deliveryNoteItems;
            return next;
        });

        if (option?.value) {
            fetchOrderItems(option.value, false);
        } else {
            setDeliverableLines([]);
        }
    };

    const handleClearRowError = (rowId, field) => {
        setRowErrors((prev) => {
            if (!prev[rowId]?.[field]) return prev;
            const next = { ...prev, [rowId]: { ...prev[rowId] } };
            delete next[rowId][field];
            if (Object.keys(next[rowId]).length === 0) delete next[rowId];
            return next;
        });
        setErrors((prev) => {
            if (!prev.deliveryNoteItems) return prev;
            const next = { ...prev };
            delete next.deliveryNoteItems;
            return next;
        });
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
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Failed to load customers (HTTP ${res.status})`);
                }
                return res.json();
            })
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
            .catch((err) => {
                console.error("loadCustomerOptions error:", err);
                toast.error(err.message || "Failed to load customer list.");
                callback([]);
            });
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
        if (result.isConfirmed) {
            if (fromOrderId) {
                router.push(`/order/${fromOrderId}`);
            } else if (presetCustomerId) {
                router.push(`/customer/${presetCustomerId}#delivery-notes`);
            } else {
                router.push("/delivery-note-list");
            }
        }
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

    const scrollFirstErrorIntoView = (fErrors, rErrors) => {
        setTimeout(() => {
            let target = null;
            if (fErrors.customerId) {
                target = document.querySelector('[data-error-field="customerId"]');
            } else if (fErrors.orderId) {
                target = document.querySelector('[data-error-field="orderId"]');
            } else if (fErrors.deliveryDate) {
                target = document.querySelector('[data-error-field="deliveryDate"]');
            } else if (fErrors.deliveryNoteItems) {
                target = document.querySelector('[data-error-field="deliveryNoteItems"]');
            } else if (rErrors && Object.keys(rErrors).length > 0) {
                const firstRowId = Object.keys(rErrors)[0];
                target =
                    document.querySelector(`[data-row-id="${firstRowId}"]`) ||
                    document.querySelector('[data-error-field="deliveryNoteItems"]');
            } else if (fErrors.receiverName) {
                target = document.querySelector('[data-error-field="receiverName"]');
            } else if (fErrors.billingAddress) {
                target = document.querySelector('[data-error-field="billingAddress"]');
            }

            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                const focusable =
                    target.querySelector("input, select, textarea, button") || target;
                if (focusable && typeof focusable.focus === "function") {
                    focusable.focus();
                }
            }
        }, 50);
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitAttempted(true);

        if (!companyId) {
            toast.error("No active company found");
            return;
        }

        const isBlankRow = (r) =>
            !r.orderItemId &&
            (r.deliverQuantity === "" ||
                r.deliverQuantity === undefined ||
                r.deliverQuantity === null);
        const hasAnyRowData = items.some((r) => !isBlankRow(r));

        const nonBlankRows = [];
        const nonBlankRowIds = [];
        items.forEach((r) => {
            if (hasAnyRowData && isBlankRow(r)) return;
            nonBlankRows.push({
                orderItemId: r.orderItemId || "",
                deliverQuantity:
                    r.deliverQuantity !== "" &&
                        r.deliverQuantity !== undefined &&
                        r.deliverQuantity !== null
                        ? r.deliverQuantity
                        : "",
                pendingQuantity:
                    r.pendingQuantity !== "" && r.pendingQuantity !== undefined
                        ? Number(r.pendingQuantity)
                        : undefined,
            });
            nonBlankRowIds.push(r._id);
        });

        const payloadToValidate = {
            companyId: String(companyId),
            customerId: selectedCustomer?.value ? String(selectedCustomer.value) : "",
            orderId: selectedOrder?.value ? String(selectedOrder.value) : "",
            deliveryDate: deliveryDate || "",
            receiverName: receiverName || "",
            billingAddress: selectedAddress?.value || "",
            receiverSignature: receiverSignature || undefined,
            deliveryNoteItems: nonBlankRows,
        };

        const valResult = DeliveryNoteFormSchema.safeParse(payloadToValidate);
        if (!valResult.success) {
            const fieldErrors = {};
            const rErrors = {};
            valResult.error.issues.forEach((err) => {
                if (err.path[0] === "deliveryNoteItems" && typeof err.path[1] === "number") {
                    const idx = err.path[1];
                    const rowId = nonBlankRowIds[idx];
                    const field = err.path[2];
                    if (rowId && field) {
                        rErrors[rowId] = {
                            ...(rErrors[rowId] || {}),
                            [field]: err.message,
                        };
                    }
                } else if (err.path[0] === "deliveryNoteItems") {
                    if (!fieldErrors.deliveryNoteItems) {
                        fieldErrors.deliveryNoteItems = err.message;
                    }
                } else {
                    const field = err.path[0];
                    if (field && !fieldErrors[field]) {
                        fieldErrors[field] = err.message;
                    }
                }
            });

            setErrors(fieldErrors);
            setRowErrors(rErrors);
            scrollFirstErrorIntoView(fieldErrors, rErrors);
            return;
        }

        setErrors({});
        setRowErrors({});

        const validItems = nonBlankRows.map((r) => ({
            orderItemId: Number(r.orderItemId),
            deliverQuantity: Number(r.deliverQuantity),
        }));

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
                JSON.stringify(validItems)
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
                    endpoint: "delivery-note-add",
                    module: "delivery-note",
                },
                body: fd,
            });

            const payload = await res.json();
            const result = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (result && result.success === 1) {
                toast.success(result.message || "Delivery note created successfully!");
                const invCode = result.invoiceCode || result.data?.invoiceCode;
                const invStatus = result.invoiceStatus || result.data?.invoiceStatus;
                if (invCode) {
                    const statusText = invStatus === "DRAFT" ? "created as Draft" : "created and submitted";
                    toast.success(`Invoice ${invCode} ${statusText}`);
                }
                router.push(fromOrderId ? `/order/${fromOrderId}#deliveryNotes` : "/delivery-note-list");
            } else {
                toast.error(result?.message || "Failed to create delivery note.");
                if (selectedOrder?.value) {
                    fetchOrderItems(selectedOrder.value, true);
                }
            }
        } catch (err) {
            console.error("Save error:", err);
            toast.error(err.message || "An unexpected error occurred while saving delivery note.");
            if (selectedOrder?.value) {
                fetchOrderItems(selectedOrder.value, true);
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

                    {fromOrderId ? (
                        <>
                            <Link href="/order-list" className="cursor-pointer hover:text-blue-600">Orders</Link>
                            <span className="text-gray-400">{">>"}</span>
                            <Link href={`/order/${fromOrderId}`} className="cursor-pointer hover:text-blue-600">
                                {selectedOrder?.label || `Order #${fromOrderId}`}
                            </Link>
                            <span className="text-gray-400">{">>"}</span>
                        </>
                    ) : (
                        <>
                            <Link href="/delivery-note-list" className="cursor-pointer hover:text-blue-600">Delivery Note</Link>
                            <span className="text-gray-400">{">>"}</span>
                        </>
                    )}
                    <span className="text-gray-800">Add New</span>
                </nav>
            </div>

            <div className="flex-1 px-6 py-4 pb-32 space-y-5">
                <h1 className="text-2xl font-bold text-gray-900">Add New</h1>

                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 space-y-6">
                    <div className="pb-3 border-b border-gray-100">
                        <h2 className="text-base font-bold text-gray-900">Delivery Note</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div data-error-field="customerId">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Customer <span className="text-red-500">*</span>
                            </label>
                            <AsyncSelect
                                instanceId="customer-select"
                                cacheOptions
                                defaultOptions
                                loadOptions={isCustomerLocked ? () => { } : loadCustomerOptions}
                                value={selectedCustomer}
                                onChange={handleCustomerSelect}
                                isDisabled={isCustomerLocked}
                                isClearable={!isCustomerLocked}
                                placeholder={isCustomerLocked ? "" : "Select Customer..."}
                                styles={selectStyles(Boolean(errors.customerId))}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {errors.customerId && (
                                <p className="text-red-500 text-xs mt-1 font-medium">{errors.customerId}</p>
                            )}
                        </div>

                        <div data-error-field="orderId">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Order Number <span className="text-red-500">*</span>
                            </label>
                            <Select
                                instanceId="order-select"
                                value={selectedOrder}
                                onChange={handleOrderSelect}
                                options={orderOptions}
                                isLoading={loadingOrders}
                                isDisabled={isLocked || !selectedCustomer}
                                placeholder={
                                    loadingOrders
                                        ? "Loading deliverable orders..."
                                        : !selectedCustomer
                                            ? "Select a customer first"
                                            : orderOptions.length === 0
                                                ? "No deliverable orders available"
                                                : "Select Order..."
                                }
                                styles={selectStyles(Boolean(errors.orderId))}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {errors.orderId && (
                                <p className="text-red-500 text-xs mt-1 font-medium">{errors.orderId}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div data-error-field="deliveryDate">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Delivery Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={deliveryDate}
                                onChange={(e) => {
                                    setDeliveryDate(e.target.value);
                                    if (errors.deliveryDate) {
                                        setErrors((prev) => ({ ...prev, deliveryDate: null }));
                                    }
                                }}
                                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${errors.deliveryDate
                                    ? "border-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:border-blue-500"
                                    }`}
                            />
                            {errors.deliveryDate && (
                                <p className="text-red-500 text-xs mt-1 font-medium">{errors.deliveryDate}</p>
                            )}
                        </div>
                    </div>
                </div>

                <DeliveryNoteItemsTable
                    items={items}
                    onChange={(nextItems) => {
                        setItems(nextItems);
                        if (errors.deliveryNoteItems) {
                            setErrors((prev) => {
                                const next = { ...prev };
                                delete next.deliveryNoteItems;
                                return next;
                            });
                        }
                    }}
                    deliverableLines={deliverableLines}
                    isOrderSelected={!!selectedOrder?.value}
                    rowErrors={rowErrors}
                    tableError={errors.deliveryNoteItems}
                    onClearRowError={handleClearRowError}
                    loadingItems={loadingItems}
                />

                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div data-error-field="receiverName">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Receiver Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={receiverName}
                                onChange={(e) => {
                                    setReceiverName(e.target.value);
                                    if (errors.receiverName) {
                                        setErrors((prev) => ({ ...prev, receiverName: null }));
                                    }
                                }}
                                placeholder="Enter receiver name..."
                                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${errors.receiverName
                                    ? "border-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:border-blue-500"
                                    }`}
                            />
                            {errors.receiverName && (
                                <p className="text-red-500 text-xs mt-1 font-medium">
                                    {errors.receiverName}
                                </p>
                            )}
                        </div>

                        <div data-error-field="billingAddress">
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Billing Address <span className="text-red-500">*</span>
                            </label>
                            <Select
                                instanceId="billing-address-select"
                                value={selectedAddress}
                                onChange={(opt) => {
                                    setSelectedAddress(opt);
                                    if (errors.billingAddress) {
                                        setErrors((prev) => ({ ...prev, billingAddress: null }));
                                    }
                                }}
                                options={countries}
                                isSearchable
                                isClearable
                                placeholder="Select billing country..."
                                styles={selectStyles(Boolean(errors.billingAddress))}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {errors.billingAddress && (
                                <p className="text-red-500 text-xs mt-1 font-medium">
                                    {errors.billingAddress}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-gray-100">
                        <div>
                            <MultiFilePicker
                                accept="image/*"
                                multiple={false}
                                selectedFiles={receiverImage ? [receiverImage] : []}
                                onFilesChange={(files) => setReceiverImage(files[0] || null)}
                                label="Receiver Image"
                            />
                        </div>

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

                    <div className="pt-2 border-t border-gray-100 space-y-3">
                        <label className="block text-xs font-semibold text-gray-700">
                            Receiver Signature
                        </label>

                        {receiverSignature ? (
                            <div className="flex items-center gap-4">
                                <div className="border border-gray-200 rounded-xl p-2 bg-gray-50/50 inline-block">
                                    <img
                                        src={receiverSignature}
                                        alt="Receiver signature"
                                        className="h-16 w-auto object-contain"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSignatureModalOpen(true)}
                                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                                    >
                                        Change Signature
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReceiverSignature(null)}
                                        className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition cursor-pointer"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setSignatureModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                            >
                                <PenTool className="h-4 w-4 text-gray-500" />
                                Add Signature
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={handleDiscard}
                        disabled={submitting}
                        className="rounded-sm border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                    >
                        Discard
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="rounded-sm border border-blue-600 bg-white px-8 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer disabled:opacity-50"
                    >
                        {submitting ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {signatureModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900">Add Signature</h3>
                            <button
                                type="button"
                                onClick={() => setSignatureModalOpen(false)}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="border border-gray-300 rounded-xl overflow-hidden bg-white">
                            <SignatureCanvas
                                ref={sigCanvasRef}
                                penColor="black"
                                canvasProps={{
                                    className: "w-full h-48 cursor-crosshair",
                                }}
                            />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button
                                type="button"
                                onClick={() => sigCanvasRef.current?.clear()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                            >
                                <RotateCcw className="h-3.5 w-3.5" /> Clear
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSignatureModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveSignature}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-sm cursor-pointer"
                                >
                                    Save Signature
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
