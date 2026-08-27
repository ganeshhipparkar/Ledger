"use client";

import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Header from "../Header";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import { paymentTransactionFormConfig } from "./configs/paymentTransactionForm.config";
import MultiFilePicker from "../common/MultiFilePicker";
import { Layers, DollarSign } from "lucide-react";

const getMySwal = () => withReactContent(Swal);

const getMinDateOneMonthAgo = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
};

export default function AddPaymentTransaction() {
    const router = useRouter();
    const { displayUser, activeAssignment } = useContext(loginContext) || {};
    const config = paymentTransactionFormConfig.contexts["payment-transaction-add"];
    const isSuperAdmin = displayUser?.assignments?.some((a) => a.is_parent === 1) ?? false;

    const minDate = getMinDateOneMonthAgo();

    const buildInitial = () => ({
        customerId: "",
        currencyId: "",
        bankBookId: "",
        companyId: "",
        paymentMode: "Cash",
        paymentDate: new Date().toISOString().split("T")[0],
        exchangeRate: "",
        exchangeDate: new Date().toISOString().split("T")[0],
        narration: "",
        transactionAmount: "",
        baseAmount: "",
        description: "",
    });

    const [formData, setFormData] = useState(buildInitial);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    // Dropdown state
    const [companies, setCompanies] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [bankBooks, setBankBooks] = useState([]);

    // File attachments state
    const [selectedFiles, setSelectedFiles] = useState([]);

    useEffect(() => {
        const initial = buildInitial();
        if (!isSuperAdmin && activeAssignment?.companyId) {
            initial.companyId = String(activeAssignment.companyId);
        }
        setFormData(initial);
        if (isSuperAdmin) fetchCompanies();
        fetchCustomers();
        fetchCurrencies();
        fetchBankBooks();
    }, []);

    // Auto-populate exchangeRate from selected currency (read-only)
    useEffect(() => {
        if (!formData.currencyId) {
            setFormData((prev) => ({ ...prev, exchangeRate: "" }));
            return;
        }
        const selected = currencies.find(
            (c) => String(c.curId) === String(formData.currencyId)
        );
        if (selected && selected.conversionRate != null) {
            setFormData((prev) => ({
                ...prev,
                exchangeRate: String(selected.conversionRate),
            }));
        } else {
            fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `currency-rate/${formData.currencyId}`,
                    module: "currency",
                },
            })
                .then((r) => r.json())
                .then((p) => {
                    const d = p.encrypted ? decryptResponse(p.encrypted) : p;
                    if (d?.conversionRate != null) {
                        setFormData((prev) => ({
                            ...prev,
                            exchangeRate: String(d.conversionRate),
                        }));
                    }
                })
                .catch(() => {});
        }
    }, [formData.currencyId, currencies]);

    // Live calculation for baseAmount = transactionAmount * exchangeRate (4 decimal places)
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

    const fetchList = async (endpoint, module, setter) => {
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint,
                    module,
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
            setter(data?.data ?? []);
        } catch {}
    };

    const fetchCompanies = () => fetchList("company-list", "company", setCompanies);
    const fetchCustomers = () => fetchList("customer-list", "customer", setCustomers);
    const fetchCurrencies = () => fetchList("currency-list", "currency", setCurrencies);
    const fetchBankBooks = () => fetchList("bank-book-list", "bank-book", setBankBooks);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === "companyId") {
            setFormData((prev) => ({ ...prev, companyId: value, bankBookId: "" }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleBack = async () => {
        const result = await getMySwal().fire({
            title: "Discard changes?",
            text: "Any unsaved data will be lost.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#EF4444",
            cancelButtonColor: "#1F2937",
            confirmButtonText: "Yes, discard",
            cancelButtonText: "Keep editing",
            reverseButtons: true,
            focusCancel: true,
            customClass: {
                popup: "rounded-xl",
                confirmButton: "px-6 py-2 font-medium",
                cancelButton: "px-6 py-2 font-medium",
            },
        });
        if (result.isConfirmed) router.push("/payment-transaction-list");
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

        const parseRes = config.schema.safeParse(payloadToValidate);
        if (!parseRes.success) {
            const fieldErrors = {};
            parseRes.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
            });
            setErrors(fieldErrors);
            return;
        }

        const confirmRes = await getMySwal().fire({
            title: "Add Payment Transaction?",
            text: "Are you sure you want to save this transaction?",
            icon: "info",
            showCancelButton: true,
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, save!",
            cancelButtonText: "Cancel",
        });
        if (!confirmRes.isConfirmed) return;

        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("customerId", String(formData.customerId));
            fd.append("currencyId", String(formData.currencyId));
            fd.append("bankBookId", String(formData.bankBookId));
            fd.append("companyId", String(formData.companyId));
            fd.append("paymentMode", formData.paymentMode);
            fd.append("paymentDate", formData.paymentDate);
            fd.append("exchangeRate", String(formData.exchangeRate));
            fd.append("exchangeDate", formData.exchangeDate);
            fd.append("narration", formData.narration);
            fd.append("transactionAmount", String(formData.transactionAmount));
            fd.append("description", formData.description);

            selectedFiles.forEach((file) => fd.append("attachments", file));

            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "payment-transaction-add",
                    module: "payment-transaction",
                },
                body: fd,
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1) {
                toast.success("Payment transaction created successfully", {
                    position: "top-right",
                });
                router.push("/payment-transaction-list");
            } else {
                const msg = data?.message || "Creation failed.";
                setErrors({ global: msg });
                toast.error(msg, { position: "top-right" });
            }
        } catch {
            toast.error("An error occurred during creation.", { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = (name) =>
        `w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
            errors[name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
        } bg-white text-gray-800`;
    const selectClass = (name) =>
        `w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
            errors[name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
        } bg-white text-gray-800`;
    const readonlyClass =
        "w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-600 outline-none cursor-not-allowed font-mono";

    const filteredBankBooks = formData.companyId
        ? bankBooks.filter((b) => String(b.companyId) === String(formData.companyId))
        : bankBooks;

    return (
        <div className="min-h-screen w-full bg-[#f5f6f8] text-black">
            <Header page="payment-transaction-add" />

            <nav
                className="px-6 pt-6 flex items-center space-x-2 text-sm font-medium text-gray-500"
                aria-label="Breadcrumb"
            >
                <span
                    className="cursor-pointer transition-colors hover:text-blue-600 hover:underline"
                    onClick={() => router.push("/")}
                >
                    Home
                </span>
                <span className="text-gray-400">{">>"}</span>
                <span className="text-gray-500 font-medium">Finance</span>
                <span className="text-gray-400">{">>"}</span>
                <span
                    className="cursor-pointer transition-colors hover:text-blue-600 hover:underline"
                    onClick={() => router.push("/payment-transaction-list")}
                >
                    Payment Transaction
                </span>
            </nav>

            <div className="px-6 py-4">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-800">Add New</h1>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Top Section: Primary Fields */}
                    <div className="w-full rounded-2xl bg-white p-6 shadow-sm mb-6">
                        {isSuperAdmin && (
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Company <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="companyId"
                                    value={formData.companyId}
                                    onChange={handleChange}
                                    className={selectClass("companyId")}
                                >
                                    <option value="">Select Company</option>
                                    {companies.map((c) => (
                                        <option key={c.companyId} value={String(c.companyId)}>
                                            {c.companyName}
                                        </option>
                                    ))}
                                </select>
                                {errors.companyId && (
                                    <p className="mt-1 text-sm text-red-500">{errors.companyId}</p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {/* Customer */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Customer <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="customerId"
                                    value={formData.customerId}
                                    onChange={handleChange}
                                    className={selectClass("customerId")}
                                >
                                    <option value="">Select Customer</option>
                                    {customers.map((c) => (
                                        <option key={c.customerId} value={String(c.customerId)}>
                                            {c.customerName}
                                        </option>
                                    ))}
                                </select>
                                {errors.customerId && (
                                    <p className="mt-1 text-sm text-red-500">{errors.customerId}</p>
                                )}
                            </div>

                            {/* Customer Currency */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Customer Currency <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="currencyId"
                                    value={formData.currencyId}
                                    onChange={handleChange}
                                    className={selectClass("currencyId")}
                                >
                                    <option value="">Select Currency</option>
                                    {currencies.map((c) => (
                                        <option key={c.curId} value={String(c.curId)}>
                                            {c.code} - {c.name} ({c.symbol})
                                        </option>
                                    ))}
                                </select>
                                {errors.currencyId && (
                                    <p className="mt-1 text-sm text-red-500">{errors.currencyId}</p>
                                )}
                            </div>

                            {/* Bank Account */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Bank Account <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="bankBookId"
                                    value={formData.bankBookId}
                                    onChange={handleChange}
                                    className={selectClass("bankBookId")}
                                >
                                    <option value="">Select Bank Account</option>
                                    {filteredBankBooks.map((b) => (
                                        <option key={b.bankBookId} value={String(b.bankBookId)}>
                                            {b.bankBookName} ({b.accountNumber || "No Acc #"})
                                        </option>
                                    ))}
                                </select>
                                {errors.bankBookId && (
                                    <p className="mt-1 text-sm text-red-500">{errors.bankBookId}</p>
                                )}
                            </div>

                            {/* Payment Mode */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Payment Mode <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="paymentMode"
                                    value={formData.paymentMode}
                                    onChange={handleChange}
                                    className={selectClass("paymentMode")}
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
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Payment Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="paymentDate"
                                    min={minDate}
                                    value={formData.paymentDate}
                                    onChange={handleChange}
                                    className={inputClass("paymentDate")}
                                />
                                {errors.paymentDate && (
                                    <p className="mt-1 text-sm text-red-500">{errors.paymentDate}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section: Other Details */}
                    <div className="w-full rounded-2xl bg-white p-6 shadow-sm mb-6">
                        <div className="flex items-center gap-2 mb-4 border-b pb-3 text-gray-700">
                            <Layers className="h-5 w-5 text-gray-500" />
                            <h2 className="text-base font-semibold">Other Details</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Exchange Rate <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={formData.exchangeRate}
                                    placeholder="Auto-filled on currency selection"
                                    className={readonlyClass}
                                />
                                {errors.exchangeRate && (
                                    <p className="mt-1 text-sm text-red-500">{errors.exchangeRate}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Exchange Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="exchangeDate"
                                    min={minDate}
                                    value={formData.exchangeDate}
                                    onChange={handleChange}
                                    className={inputClass("exchangeDate")}
                                />
                                {errors.exchangeDate && (
                                    <p className="mt-1 text-sm text-red-500">{errors.exchangeDate}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section: Transaction Amount */}
                    <div className="w-full rounded-2xl bg-white p-6 shadow-sm mb-6">
                        <div className="flex items-center gap-2 mb-4 border-b pb-3 text-gray-700">
                            <DollarSign className="h-5 w-5 text-gray-500" />
                            <h2 className="text-base font-semibold">Transaction Amount</h2>
                        </div>

                        {/* Table-style row layout matching screenshot */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Narration <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="narration"
                                    value={formData.narration}
                                    onChange={handleChange}
                                    placeholder="Enter narration"
                                    className={inputClass("narration")}
                                />
                                {errors.narration && (
                                    <p className="mt-1 text-sm text-red-500">{errors.narration}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Transaction Amount <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    name="transactionAmount"
                                    value={formData.transactionAmount}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    className={inputClass("transactionAmount")}
                                />
                                {errors.transactionAmount && (
                                    <p className="mt-1 text-sm text-red-500">{errors.transactionAmount}</p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Base Amount <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={formData.baseAmount}
                                    placeholder="0.0000"
                                    className={readonlyClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Description & Attachments */}
                    <div className="w-full rounded-2xl bg-white p-6 shadow-sm mb-6 space-y-6">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Description <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                name="description"
                                rows={3}
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Additional details..."
                                className={inputClass("description")}
                            />
                            {errors.description && (
                                <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                            )}
                        </div>

                        <MultiFilePicker
                            selectedFiles={selectedFiles}
                            onFilesChange={setSelectedFiles}
                            label="Attachments"
                        />
                    </div>

                    {/* Footer Buttons */}
                    <div className="mt-8 flex justify-center gap-4 pb-12">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex min-w-[150px] items-center justify-center rounded-xl border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-400 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex min-w-[150px] items-center justify-center rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all hover:bg-blue-700 cursor-pointer disabled:opacity-60"
                        >
                            {loading ? "Saving..." : "Submit"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
