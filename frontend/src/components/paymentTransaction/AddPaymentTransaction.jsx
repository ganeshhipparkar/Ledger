"use client";
import Link from "next/link";

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
import FormattedNumberInput from "../ui/FormattedNumberInput";
import { limitPriceDecimals } from "@/lib/utils";
import Select from "react-select";
import { Layers, DollarSign, AlignLeft } from "lucide-react";

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
    const isSuperAdmin = displayUser?.primaryProfile?.groupCode === "admin" || activeAssignment?.groupCode === "admin";

    const minDate = getMinDateOneMonthAgo();

    const buildInitial = () => ({
        customerId: "",
        currencyId: "",
        bankBookId: "",
        companyId: "",
        paymentMode: "",
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

    const [companies, setCompanies] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [bankBooks, setBankBooks] = useState([]);

    const [selectedFiles, setSelectedFiles] = useState([]);

    useEffect(() => {
        const initial = buildInitial();
        if (!isSuperAdmin && activeAssignment?.companyId) {
            initial.companyId = String(activeAssignment.companyId);
        }
        setFormData(initial);
        if (isSuperAdmin) fetchCompanies();
    }, [isSuperAdmin, activeAssignment]);

    useEffect(() => {
        fetchCustomers();
        fetchBankBooks();
    }, [formData.companyId]);

    useEffect(() => {
        if (formData.customerId) {
            fetchCustomerCurrencies(formData.customerId);
        } else {
            setCurrencies([]);
        }
    }, [formData.customerId]);

    const fetchCustomerCurrencies = async (customerId) => {
        if (!customerId) { setCurrencies([]); return; }
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { ...authHeaders(), endpoint: "customer-currencies-list", module: "customer", "Content-Type": "application/json" },
                body: JSON.stringify({
                    page: 1,
                    limit: 500,
                    filters: [{ key: "customerId", value: customerId, operator: "equal" }],
                }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            const rows = data?.data ?? [];
            setCurrencies(rows.map((row) => row.currency).filter(Boolean));
        } catch { setCurrencies([]); }
    };

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
                .catch(() => { });
        }
    }, [formData.currencyId, currencies]);

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

    const fetchList = async (endpoint, module, setter, extraFilters = []) => {
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
                    filters: [{ key: "status", value: "Active", operator: "=" }, ...extraFilters],
                    condition: "All",
                }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setter(data?.data ?? []);
        } catch { }
    };

    const fetchCompanies = () => fetchList("company-list", "company", setCompanies);
    const fetchCustomers = () => fetchList("customer-list", "customer", setCustomers,
        formData.companyId ? [{ key: "companyId", value: formData.companyId, operator: "equal" }] : []);
    const fetchBankBooks = () => fetchList("bank-book-list", "bank-book", setBankBooks,
        formData.companyId ? [{ key: "companyId", value: formData.companyId, operator: "equal" }] : []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === "companyId") {
            setFormData((prev) => ({
                ...prev,
                companyId: value,
                customerId: "",
                currencyId: "",
                bankBookId: "",
                exchangeRate: "",
                baseAmount: "",
            }));
        } else if (name === "customerId") {
            setFormData((prev) => ({
                ...prev,
                customerId: value,
                currencyId: "",
                bankBookId: "",
                exchangeRate: "",
                baseAmount: "",
            }));
        } else if (name === "currencyId") {
            setFormData((prev) => {
                const currentBb = bankBooks.find((b) => String(b.bankBookId) === String(prev.bankBookId));
                const isBbValid = currentBb && String(currentBb.currencyId) === String(value);
                return {
                    ...prev,
                    [name]: value,
                    bankBookId: isBbValid ? prev.bankBookId : "",
                };
            });
        } else if (name === "transactionAmount") {
            setFormData((prev) => ({ ...prev, transactionAmount: limitPriceDecimals(value) }));
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

        if (selectedFiles.length === 0) {
            setErrors((prev) => ({ ...prev, attachments: "At least one attachment is required." }));
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
        `w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${errors[name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
        } bg-white text-gray-800`;
    const selectClass = (name) =>
        `w-full rounded-xl border px-4 py-3 text-sm outline-none transition disabled:opacity-50 disabled:cursor-not-allowed ${errors[name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
        } bg-white text-gray-800`;
    const readonlyClass =
        "w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-600 outline-none cursor-not-allowed font-mono";

    return (
        <div className="min-h-screen w-full bg-[#f5f6f8] text-black">
            <Header page="payment-transaction-add" />

            <nav
                className="px-6 pt-6 flex items-center space-x-2 text-sm font-medium text-gray-500"
                aria-label="Breadcrumb"
            >
                <Link href="/" className="cursor-pointer transition-colors hover:text-blue-600 hover:underline">
                    Home
                </Link>
                <span className="text-gray-400">{">>"}</span>
                <Link href="/payment-transaction-list" className="cursor-pointer transition-colors hover:text-blue-600 hover:underline">
                    Payment Transaction
                </Link>
                <span className="text-gray-400">{">>"}</span>
                <span className="text-gray-400">{"Add"}</span>

            </nav>
            <div className="px-6 py-4">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-800">Add New</h1>
                </div>

                <form onSubmit={handleSubmit}>
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

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Customer <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    instanceId="customerId-select"
                                    name="customerId"
                                    value={formData.customerId ? {
                                        value: String(formData.customerId),
                                        label: customers.find(c => String(c.customerId) === String(formData.customerId))?.customerName || ""
                                    } : null}
                                    onChange={(selected) => {
                                        handleChange({ target: { name: "customerId", value: selected ? selected.value : "" } });
                                    }}
                                    options={customers.map((c) => ({
                                        value: String(c.customerId),
                                        label: c.customerName,
                                    }))}
                                    placeholder="Select Customer"
                                    isClearable
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            padding: "4px 8px",
                                            borderRadius: "0.75rem",
                                            borderColor: errors.customerId ? "#ef4444" : "#d1d5db",
                                            boxShadow: "none",
                                            "&:hover": { borderColor: errors.customerId ? "#ef4444" : "#3b82f6" },
                                        }),
                                    }}
                                />
                                {errors.customerId && (
                                    <p className="mt-1 text-sm text-red-500">{errors.customerId}</p>
                                )}
                            </div>


                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Customer Currency <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    instanceId="currencyId-select"
                                    name="currencyId"
                                    value={formData.currencyId ? {
                                        value: String(formData.currencyId),
                                        label: currencies.find(c => String(c.curId) === String(formData.currencyId)) ? (() => {
                                            const c = currencies.find(c => String(c.curId) === String(formData.currencyId));
                                            return `${c.code} - ${c.name} (${c.symbol})`;
                                        })() : ""
                                    } : null}
                                    onChange={(selected) => {
                                        handleChange({ target: { name: "currencyId", value: selected ? selected.value : "" } });
                                    }}
                                    options={currencies.map((c) => ({
                                        value: String(c.curId),
                                        label: `${c.code} - ${c.name} (${c.symbol})`,
                                    }))}
                                    isDisabled={!formData?.customerId}
                                    placeholder="Select Currency"
                                    isClearable
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            padding: "4px 8px",
                                            borderRadius: "0.75rem",
                                            borderColor: errors.currencyId ? "#ef4444" : "#d1d5db",
                                            boxShadow: "none",
                                            "&:hover": { borderColor: errors.currencyId ? "#ef4444" : "#3b82f6" },
                                        }),
                                    }}
                                />
                                {errors.currencyId && (
                                    <p className="mt-1 text-sm text-red-500">{errors.currencyId}</p>
                                )}
                            </div>


                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Bank Account <span className="text-red-500">*</span>
                                </label>
                                {(() => {
                                    const filteredBankBooks = formData.currencyId
                                        ? bankBooks.filter((b) => String(b.currencyId) === String(formData.currencyId))
                                        : [];
                                    return (
                                        <Select
                                            instanceId="bankBookId-select"
                                            name="bankBookId"
                                            value={formData.bankBookId ? {
                                                value: formData.bankBookId,
                                                label: filteredBankBooks.find(b => String(b.bankBookId ?? b.value) === String(formData.bankBookId)) ? (() => {
                                                    const bb = filteredBankBooks.find(b => String(b.bankBookId ?? b.value) === String(formData.bankBookId));
                                                    return bb.bankBookName || (bb.accountNumber ? `${bb.accountNumber}${bb.bankName ? ` — ${bb.bankName}` : ""}` : `Bank Account #${bb.bankBookId ?? bb.value}`);
                                                })() : ""
                                            } : null}
                                            onChange={(selected) => {
                                                const val = selected ? selected.value : "";
                                                handleChange({ target: { name: "bankBookId", value: val } });
                                            }}
                                            options={filteredBankBooks.map(bb => {
                                                const baseName = bb.bankBookName || (bb.accountNumber ? `${bb.accountNumber}${bb.bankName ? ` — ${bb.bankName}` : ""}` : `Bank Account #${bb.bankBookId ?? bb.value}`);
                                                return {
                                                    label: baseName,
                                                    value: String(bb.bankBookId ?? bb.value),
                                                };
                                            })}
                                            isDisabled={!formData.currencyId || filteredBankBooks.length === 0}
                                            placeholder={formData.currencyId ? "-- Select bank account --" : "Select currency first"}
                                            isClearable
                                            styles={{
                                                control: (base) => ({
                                                    ...base,
                                                    padding: "4px 8px",
                                                    borderRadius: "0.75rem",
                                                    borderColor: errors.bankBookId ? "#ef4444" : "#d1d5db",
                                                    boxShadow: "none",
                                                    "&:hover": { borderColor: errors.bankBookId ? "#ef4444" : "#3b82f6" },
                                                }),
                                            }}
                                        />
                                    );
                                })()}
                                {errors.bankBookId && (
                                    <p className="mt-1 text-sm text-red-500">{errors.bankBookId}</p>
                                )}
                            </div>


                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Payment Mode <span className="text-red-500">*</span>
                                </label>
                                <Select
                                    instanceId="paymentMode-select"
                                    name="paymentMode"
                                    value={formData.paymentMode ? {
                                        value: formData.paymentMode,
                                        label: formData.paymentMode
                                    } : null}
                                    onChange={(selected) => {
                                        handleChange({ target: { name: "paymentMode", value: selected ? selected.value : "" } });
                                    }}
                                    options={[
                                        { value: "Cash", label: "Cash" },
                                        { value: "Credit Card", label: "Credit Card" },
                                        { value: "Debit Card", label: "Debit Card" },
                                        { value: "Digital Wallet", label: "Digital Wallet" },
                                        { value: "Bank Transfer", label: "Bank Transfer" },
                                        { value: "UPI", label: "UPI" },
                                        { value: "Buy Now Pay Later", label: "Buy Now Pay Later" },
                                    ]}
                                    placeholder="Select Payment Mode"
                                    isClearable
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            padding: "4px 8px",
                                            borderRadius: "0.75rem",
                                            borderColor: errors.paymentMode ? "#ef4444" : "#d1d5db",
                                            boxShadow: "none",
                                            "&:hover": { borderColor: errors.paymentMode ? "#ef4444" : "#3b82f6" },
                                        }),
                                    }}
                                />
                                {errors.paymentMode && (
                                    <p className="mt-1 text-sm text-red-500">{errors.paymentMode}</p>
                                )}
                            </div>

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
                                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                    className={inputClass("paymentDate")}
                                />
                                {errors.paymentDate && (
                                    <p className="mt-1 text-sm text-red-500">{errors.paymentDate}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="w-full rounded-2xl bg-white p-6 shadow-sm mb-6">
                        <div className="flex items-center gap-2 mb-4 border-b pb-3 text-gray-700">
                            <Layers className="h-5 w-5 text-gray-500" />
                            <h2 className="text-base font-semibold">Other Details</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Exchange Rate
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
                                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                    className={inputClass("exchangeDate")}
                                />
                                {errors.exchangeDate && (
                                    <p className="mt-1 text-sm text-red-500">{errors.exchangeDate}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="w-full rounded-2xl bg-white p-6 shadow-sm mb-6">
                        <div className="flex items-center gap-2 mb-4 border-b pb-3 text-gray-700">
                            <h2 className="text-base font-semibold">Transaction Amount</h2>
                        </div>

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
                                <FormattedNumberInput
                                    id="transactionAmount"
                                    name="transactionAmount"
                                    value={String(limitPriceDecimals(formData.transactionAmount ?? ""))}
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
                                    Base Amount
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

                    <div className="w-full rounded-2xl bg-white p-6 shadow-sm mb-6">
                        <div className="flex items-center gap-2 mb-4 border-b pb-3 text-gray-700">
                            <AlignLeft className="h-5 w-5 text-gray-500" />
                            <h2 className="text-base font-semibold">Additional Information</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    name="description"
                                    rows={4}
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Enter description..."
                                    className={inputClass("description")}
                                />
                                {errors.description && (
                                    <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                                )}
                            </div>

                            <div className="">
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Attachments <span className="text-red-500">*</span>
                                </label>
                                <MultiFilePicker
                                    selectedFiles={selectedFiles}
                                    onFilesChange={(files) => {
                                        setSelectedFiles(files);
                                        if (files.length > 0) setErrors((prev) => ({ ...prev, attachments: "" }));
                                    }}
                                    label="Attachments"
                                    required={true}
                                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                                />
                                {errors.attachments && (
                                    <p className="mt-1 text-sm text-red-500">{errors.attachments}</p>
                                )}
                            </div>
                        </div>
                    </div>

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
