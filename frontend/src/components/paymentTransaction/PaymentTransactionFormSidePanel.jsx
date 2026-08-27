"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import { paymentTransactionFormConfig } from "./configs/paymentTransactionForm.config";
import Loader from "../ui/Loader";
import MultiFilePicker from "../common/MultiFilePicker";

const getMySwal = () => withReactContent(Swal);

export default function PaymentTransactionFormSidePanel({
    isOpen,
    onClose,
    context = "payment-transaction-add",
    id,
    onSuccess,
}) {
    const { displayUser, activeAssignment } = useContext(loginContext) || {};
    const config =
        paymentTransactionFormConfig.contexts[context] ||
        paymentTransactionFormConfig.contexts["payment-transaction-add"];

    const isSuperAdmin =
        displayUser?.assignments?.some((a) => a.is_parent === 1) ?? false;

    const buildInitial = () =>
        config.fields.reduce((acc, f) => {
            acc[f.name] = f.defaultValue ?? "";
            return acc;
        }, {});

    const [formData, setFormData] = useState(buildInitial);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // Dropdown options states
    const [companies, setCompanies] = useState([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);

    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);

    const [currencies, setCurrencies] = useState([]);
    const [currenciesLoading, setCurrenciesLoading] = useState(false);

    const [bankBooks, setBankBooks] = useState([]);
    const [bankBooksLoading, setBankBooksLoading] = useState(false);

    // Attachments states
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]);

    const [visible, setVisible] = useState(false);
    const [mounted, setMounted] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            timerRef.current = setTimeout(() => setVisible(false), 300);
        }
        return () => clearTimeout(timerRef.current);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setErrors({});
        setSelectedFiles([]);
        setExistingAttachments([]);
        setDeletedAttachmentIds([]);

        if (config.mode === "update" && id) {
            fetchDetails();
        } else {
            const initial = buildInitial();
            if (!isSuperAdmin && activeAssignment?.companyId) {
                initial.companyId = String(activeAssignment.companyId);
            }
            setFormData(initial);
        }

        if (isSuperAdmin) {
            fetchCompanies();
        }
        fetchCustomers();
        fetchCurrencies();
        fetchBankBooks();
    }, [isOpen, context, id]);

    // Live update calculated baseAmount whenever transactionAmount or exchangeRate changes
    useEffect(() => {
        const rate = parseFloat(formData.exchangeRate);
        const amount = parseFloat(formData.transactionAmount);
        if (!isNaN(rate) && !isNaN(amount)) {
            const computed = (amount * rate).toFixed(4);
            if (formData.baseAmount !== computed) {
                setFormData((prev) => ({ ...prev, baseAmount: computed }));
            }
        } else if (formData.baseAmount !== "") {
            setFormData((prev) => ({ ...prev, baseAmount: "" }));
        }
    }, [formData.exchangeRate, formData.transactionAmount]);

    const handleClose = async () => {
        const result = await getMySwal().fire({
            title: "Discard changes?",
            text: "Any unsaved data will be lost.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, discard",
            cancelButtonText: "Stay",
        });
        if (result.isConfirmed) onClose();
    };

    const fetchDetails = async () => {
        setFetching(true);
        try {
            const numericId = Number(Array.isArray(id) ? id[0] : id);
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `${config.api.fetchEndpoint}/${numericId}`,
                    module: config.api.module,
                },
            });
            const payload = await res.json();
            const data = payload.encrypted
                ? decryptResponse(payload.encrypted)
                : payload;
            if (data?.paymentTransactionId) {
                setFormData({
                    customerId: data.customerId ? String(data.customerId) : "",
                    currencyId: data.currencyId ? String(data.currencyId) : "",
                    bankBookId: data.bankBookId ? String(data.bankBookId) : "",
                    companyId: String(data.companyId || ""),
                    paymentMode: data.paymentMode || "Cash",
                    paymentDate: data.paymentDate
                        ? new Date(data.paymentDate).toISOString().split("T")[0]
                        : "",
                    exchangeRate: data.exchangeRate ? String(data.exchangeRate) : "1.000000",
                    exchangeDate: data.exchangeDate
                        ? new Date(data.exchangeDate).toISOString().split("T")[0]
                        : "",
                    narration: data.narration || "",
                    transactionAmount: data.transactionAmount ? String(data.transactionAmount) : "",
                    baseAmount: data.baseAmount ? String(data.baseAmount) : "",
                    description: data.description || "",
                });

                if (Array.isArray(data.attachments)) {
                    setExistingAttachments(data.attachments);
                }
            }
        } catch {
            toast.error("Failed to load payment transaction details.", {
                position: "top-right",
            });
        } finally {
            setFetching(false);
        }
    };

    const fetchCompanies = async () => {
        setCompaniesLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "company-list",
                    module: "company",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    page: 1,
                    limit: 500,
                    filters: [{ key: "status", value: "Active", operator: "=" }],
                    condition: "All",
                }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setCompanies(data?.data ?? []);
        } catch {
            toast.error("Failed to load companies.", { position: "top-right" });
        } finally {
            setCompaniesLoading(false);
        }
    };

    const fetchCustomers = async () => {
        setCustomersLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "customer-list",
                    module: "customer",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    page: 1,
                    limit: 500,
                    filters: [{ key: "status", value: "Active", operator: "=" }],
                    condition: "All",
                }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setCustomers(data?.data ?? []);
        } catch {
            toast.error("Failed to load customers.", { position: "top-right" });
        } finally {
            setCustomersLoading(false);
        }
    };

    const fetchCurrencies = async () => {
        setCurrenciesLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "currency-list",
                    module: "currency",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    page: 1,
                    limit: 500,
                    filters: [{ key: "status", value: "Active", operator: "=" }],
                    condition: "All",
                }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setCurrencies(data?.data ?? []);
        } catch {
            toast.error("Failed to load currencies.", { position: "top-right" });
        } finally {
            setCurrenciesLoading(false);
        }
    };

    const fetchBankBooks = async () => {
        setBankBooksLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "bank-book-list",
                    module: "bank-book",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    page: 1,
                    limit: 500,
                    filters: [{ key: "status", value: "Active", operator: "=" }],
                    condition: "All",
                }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setBankBooks(data?.data ?? []);
        } catch {
            toast.error("Failed to load bank accounts.", { position: "top-right" });
        } finally {
            setBankBooksLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const updated = { ...prev, [name]: value };
            if (name === "companyId") {
                updated.bankBookId = "";
            }
            return updated;
        });
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    };

    const handleDeleteExistingAttachment = (attachmentId) => {
        setExistingAttachments((prev) =>
            prev.filter((a) => a.paymentTransactionAttachmentId !== attachmentId)
        );
        setDeletedAttachmentIds((prev) => [...prev, attachmentId]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        const payloadToValidate = {
            ...formData,
            customerId: formData.customerId ? Number(formData.customerId) : undefined,
            currencyId: formData.currencyId ? Number(formData.currencyId) : undefined,
            bankBookId: formData.bankBookId ? Number(formData.bankBookId) : undefined,
            companyId: formData.companyId ? Number(formData.companyId) : undefined,
            exchangeRate: formData.exchangeRate ? Number(formData.exchangeRate) : undefined,
            transactionAmount: formData.transactionAmount ? Number(formData.transactionAmount) : undefined,
        };

        if (config.mode === "update") {
            payloadToValidate.paymentTransactionId = Number(
                Array.isArray(id) ? id[0] : id
            );
            if (deletedAttachmentIds.length > 0) {
                payloadToValidate.deletedAttachmentIds = deletedAttachmentIds;
            }
        }

        const parseResult = config.schema.safeParse(payloadToValidate);
        if (!parseResult.success) {
            const fieldErrors = {};
            const issues = parseResult.error.issues || parseResult.error.errors || [];
            issues.forEach((err) => {
                const path = err.path[0];
                if (path && !fieldErrors[path]) fieldErrors[path] = err.message;
            });
            setErrors(fieldErrors);
            return;
        }

        setLoading(true);

        const formDataObj = new FormData();
        formDataObj.append("customerId", String(formData.customerId));
        formDataObj.append("currencyId", String(formData.currencyId));
        formDataObj.append("bankBookId", String(formData.bankBookId));
        formDataObj.append("companyId", String(formData.companyId));
        formDataObj.append("paymentMode", formData.paymentMode);
        formDataObj.append("paymentDate", formData.paymentDate);
        formDataObj.append("exchangeRate", String(formData.exchangeRate));
        formDataObj.append("exchangeDate", formData.exchangeDate);
        formDataObj.append("narration", formData.narration);
        formDataObj.append("transactionAmount", String(formData.transactionAmount));
        formDataObj.append("description", formData.description);

        if (config.mode === "update") {
            formDataObj.append(
                "paymentTransactionId",
                String(Array.isArray(id) ? id[0] : id)
            );
            if (deletedAttachmentIds.length > 0) {
                formDataObj.append(
                    "deletedAttachmentIds",
                    JSON.stringify(deletedAttachmentIds)
                );
            }
        }

        selectedFiles.forEach((file) => {
            formDataObj.append("attachments", file);
        });

        try {
            const res = await fetch("/relayapi", {
                method: config.api.method,
                headers: {
                    ...authHeaders(),
                    endpoint: config.api.endpoint,
                    module: config.api.module,
                },
                body: formDataObj,
            });

            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (res.ok && data?.success === 1) {
                toast.success(config.successMessage, { position: "top-right" });
                onSuccess?.();
                onClose();
            } else {
                const msg = data?.message || "Failed to save payment transaction.";
                setErrors({ global: msg });
                toast.error(msg, { position: "top-right" });
            }
        } catch {
            toast.error("An unexpected error occurred.", { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    if (!mounted || !visible) return null;

    const filteredBankBooks = formData.companyId
        ? bankBooks.filter((b) => String(b.companyId) === String(formData.companyId))
        : bankBooks;

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${
                    isOpen ? "opacity-100" : "opacity-0"
                }`}
                onClick={onClose}
            />

            {/* Panel Drawer */}
            <div
                className={`absolute inset-y-0 right-0 max-w-full flex pl-10 transform transition-transform duration-300 ease-in-out ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">
                                {config.title}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {fetching ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader />
                            </div>
                        ) : (
                            <form
                                id="payment-transaction-form"
                                onSubmit={handleSubmit}
                                className="space-y-5"
                            >
                                {errors.global && (
                                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                                        {errors.global}
                                    </div>
                                )}

                                {/* Customer Select */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Customer <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="customerId"
                                        value={formData.customerId}
                                        onChange={handleChange}
                                        disabled={customersLoading}
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.customerId ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    >
                                        <option value="">Select Customer</option>
                                        {customers.map((c) => (
                                            <option key={c.customerId} value={c.customerId}>
                                                {c.customerName} ({c.customerCode})
                                            </option>
                                        ))}
                                    </select>
                                    {errors.customerId && (
                                        <p className="mt-1 text-sm text-red-500">{errors.customerId}</p>
                                    )}
                                </div>

                                {/* Customer Currency Select */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Customer Currency <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="currencyId"
                                        value={formData.currencyId}
                                        onChange={handleChange}
                                        disabled={currenciesLoading}
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.currencyId ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    >
                                        <option value="">Select Currency</option>
                                        {currencies.map((c) => (
                                            <option key={c.curId} value={c.curId}>
                                                {c.code} ({c.symbol}) - {c.name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.currencyId && (
                                        <p className="mt-1 text-sm text-red-500">{errors.currencyId}</p>
                                    )}
                                </div>

                                {/* Bank Account (BankBook) Select */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Bank Account <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="bankBookId"
                                        value={formData.bankBookId}
                                        onChange={handleChange}
                                        disabled={bankBooksLoading || !formData.companyId}
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.bankBookId ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    >
                                        <option value="">
                                            {!formData.companyId
                                                ? "Select a company first"
                                                : filteredBankBooks.length === 0
                                                ? "No bank accounts found for this company"
                                                : "Select Bank Account"}
                                        </option>
                                        {filteredBankBooks.map((bb) => (
                                            <option key={bb.bankBookId} value={bb.bankBookId}>
                                                {bb.bankBookName} ({bb.accountNumber || "No Account #"})
                                            </option>
                                        ))}
                                    </select>
                                    {errors.bankBookId && (
                                        <p className="mt-1 text-sm text-red-500">{errors.bankBookId}</p>
                                    )}
                                </div>

                                {/* Company Select */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Company <span className="text-red-500">*</span>
                                    </label>
                                    {isSuperAdmin ? (
                                        <select
                                            name="companyId"
                                            value={formData.companyId}
                                            onChange={handleChange}
                                            disabled={companiesLoading || config.mode === "update"}
                                            className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                                errors.companyId ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                            }`}
                                        >
                                            <option value="">Select Company</option>
                                            {companies.map((c) => (
                                                <option key={c.companyId} value={c.companyId}>
                                                    {c.companyName}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            readOnly
                                            value={
                                                displayUser?.assignments?.find(
                                                    (a) => Number(a.companyId) === Number(formData.companyId)
                                                )?.companyName || "Active Company"
                                            }
                                            className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 cursor-not-allowed"
                                        />
                                    )}
                                    {errors.companyId && (
                                        <p className="mt-1 text-sm text-red-500">{errors.companyId}</p>
                                    )}
                                </div>

                                {/* Payment Mode Select */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Payment Mode <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="paymentMode"
                                        value={formData.paymentMode}
                                        onChange={handleChange}
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.paymentMode ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Debit Card">Debit Card</option>
                                        <option value="Digital Wallet">Digital Wallet</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Buy Now Pay Later">Buy Now Pay Later</option>
                                    </select>
                                    {errors.paymentMode && (
                                        <p className="mt-1 text-sm text-red-500">{errors.paymentMode}</p>
                                    )}
                                </div>

                                {/* Payment Date */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Payment Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="paymentDate"
                                        value={formData.paymentDate}
                                        onChange={handleChange}
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.paymentDate ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    />
                                    {errors.paymentDate && (
                                        <p className="mt-1 text-sm text-red-500">{errors.paymentDate}</p>
                                    )}
                                </div>

                                {/* Exchange Rate */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Exchange Rate <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        name="exchangeRate"
                                        value={formData.exchangeRate}
                                        onChange={handleChange}
                                        placeholder="e.g. 1.000000"
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.exchangeRate ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    />
                                    {errors.exchangeRate && (
                                        <p className="mt-1 text-sm text-red-500">{errors.exchangeRate}</p>
                                    )}
                                </div>

                                {/* Exchange Date */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Exchange Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="exchangeDate"
                                        value={formData.exchangeDate}
                                        onChange={handleChange}
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.exchangeDate ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    />
                                    {errors.exchangeDate && (
                                        <p className="mt-1 text-sm text-red-500">{errors.exchangeDate}</p>
                                    )}
                                </div>

                                {/* Narration */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Narration <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="narration"
                                        value={formData.narration}
                                        onChange={handleChange}
                                        placeholder="e.g. Payment for Invoice #1024"
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.narration ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    />
                                    {errors.narration && (
                                        <p className="mt-1 text-sm text-red-500">{errors.narration}</p>
                                    )}
                                </div>

                                {/* Transaction Amount */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Transaction Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        name="transactionAmount"
                                        value={formData.transactionAmount}
                                        onChange={handleChange}
                                        placeholder="e.g. 1500.00"
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.transactionAmount ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    />
                                    {errors.transactionAmount && (
                                        <p className="mt-1 text-sm text-red-500">{errors.transactionAmount}</p>
                                    )}
                                </div>

                                {/* Base Amount (Read-Only Live Computed) */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Base Amount (Computed)
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formData.baseAmount}
                                        placeholder="Auto-calculated (Transaction Amount × Exchange Rate)"
                                        className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 font-mono cursor-not-allowed"
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Description <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        name="description"
                                        rows={3}
                                        value={formData.description}
                                        onChange={handleChange}
                                        placeholder="Additional payment details..."
                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${
                                            errors.description ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                        }`}
                                    />
                                    {errors.description && (
                                        <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                                    )}
                                </div>

                                {/* Multi-file Attachments Picker */}
                                <MultiFilePicker
                                    selectedFiles={selectedFiles}
                                    onFilesChange={setSelectedFiles}
                                    existingAttachments={existingAttachments}
                                    onDeleteExisting={handleDeleteExistingAttachment}
                                    label="Attachments"
                                />
                            </form>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-white">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="payment-transaction-form"
                            disabled={loading || fetching}
                            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? config.loadingButtonText : config.submitButtonText}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
