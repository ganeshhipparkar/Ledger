"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import { bankBookFormConfig } from "./configs/bankBookForm.config";
import Loader from "../ui/Loader";

const getMySwal = () => withReactContent(Swal);

export default function BankBookFormSidePanel({
    isOpen,
    onClose,
    context = "bank-book-add",
    id,
    onSuccess,
}) {
    const router = useRouter();
    const { displayUser, activeAssignment } = useContext(loginContext) || {};
    const config = bankBookFormConfig.contexts[context] || bankBookFormConfig.contexts["bank-book-add"];

    const isSuperAdmin = displayUser?.assignments?.some(
        (a) => a.is_parent === 1
    ) ?? false;

    const buildInitial = () =>
        config.fields.reduce((acc, f) => {
            acc[f.name] = f.defaultValue ?? "";
            return acc;
        }, {});

    const [formData, setFormData] = useState(buildInitial);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    const [companies, setCompanies] = useState([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);

    const [banks, setBanks] = useState([]);
    const [banksLoading, setBanksLoading] = useState(false);

    const [currencies, setCurrencies] = useState([]);
    const [currenciesLoading, setCurrenciesLoading] = useState(false);

    const [visible, setVisible] = useState(false);
    const [mounted, setMounted] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => { setMounted(true); }, []);

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
        fetchBanks();
        fetchCurrencies();
    }, [isOpen, context, id]);

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
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.bankBookId) {
                setFormData({
                    bankBookCode: data.bankBookCode || "",
                    bankBookName: data.bankBookName || "",
                    companyId: String(data.companyId || ""),
                    bankId: data.bankId ? String(data.bankId) : "",
                    currencyId: data.currencyId ? String(data.currencyId) : "",
                    beneficiaryName: data.beneficiaryName || "",
                    accountNumber: data.accountNumber || "",
                    branchName: data.branchName || "",
                    remarks: data.remarks || "",
                    status: data.status || "Active",
                });
            }
        } catch (err) {
            toast.error("Failed to load bank book data.", { position: "top-right" });
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

    const fetchBanks = async () => {
        setBanksLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "bank-list",
                    module: "bank",
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
            setBanks(data?.data ?? []);
        } catch {
            toast.error("Failed to load banks.", { position: "top-right" });
        } finally {
            setBanksLoading(false);
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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const updated = { ...prev, [name]: value };
            if (name === "companyId") {
                updated.bankId = "";
            }
            return updated;
        });
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        const payloadToValidate = {
            ...formData,
            bankId: formData.bankId ? Number(formData.bankId) : undefined,
            companyId: formData.companyId ? Number(formData.companyId) : undefined,
            currencyId: formData.currencyId ? Number(formData.currencyId) : undefined,
        };

        if (config.mode === "update") {
            payloadToValidate.bankBookId = Number(Array.isArray(id) ? id[0] : id);
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

        const bodyData = {
            bankBookName: formData.bankBookName,
            companyId: Number(formData.companyId),
            bankId: Number(formData.bankId),
            currencyId: Number(formData.currencyId),
            beneficiaryName: formData.beneficiaryName,
            accountNumber: formData.accountNumber,
            branchName: formData.branchName,
            remarks: formData.remarks,
            status: formData.status,
        };

        if (config.mode === "update") {
            bodyData.bankBookId = Number(Array.isArray(id) ? id[0] : id);
        }

        try {
            const res = await fetch("/relayapi", {
                method: config.api.method,
                headers: {
                    ...authHeaders(),
                    endpoint: config.api.endpoint,
                    module: config.api.module,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(bodyData),
            });

            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (res.ok && data?.success === 1) {
                toast.success(config.successMessage, { position: "top-right" });
                onSuccess?.();
                onClose();
            } else {
                const msg = data?.message || "Failed to save bank book.";
                setErrors({ global: msg });
                toast.error(msg, { position: "top-right" });
            }
        } catch (err) {
            toast.error("An unexpected error occurred.", { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    if (!mounted || !visible) return null;

    const filteredBanks = formData.companyId
        ? banks.filter((b) => String(b.companyId) === String(formData.companyId))
        : banks;

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"
                    }`}
                onClick={onClose}
            />

            {/* Panel Drawer */}
            <div
                className={`absolute inset-y-0 right-0 max-w-full flex pl-10 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">
                                {config.title}
                            </h2>
                            {config.mode === "update" && formData.bankBookCode && (
                                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                    {formData.bankBookCode}
                                </span>
                            )}
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
                            <form id="bank-book-form" onSubmit={handleSubmit} className="space-y-5">
                                {errors.global && (
                                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                                        {errors.global}
                                    </div>
                                )}

                                {config.fields.map((field) => {
                                    if (field.hidden) return null;

                                    if (field.type === "company-select") {
                                        return (
                                            <div key={field.name} className="space-y-1">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                {isSuperAdmin ? (
                                                    <select
                                                        name={field.name}
                                                        value={formData[field.name]}
                                                        onChange={handleChange}
                                                        disabled={field.readOnly || companiesLoading}
                                                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
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
                                                                (a) => Number(a.companyId) === Number(formData[field.name])
                                                            )?.companyName || "Active Company"
                                                        }
                                                        className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 cursor-not-allowed"
                                                    />
                                                )}
                                                {errors[field.name] && (
                                                    <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (field.name === "bankId") {
                                        return (
                                            <div key={field.name} className="space-y-1">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                <select
                                                    name={field.name}
                                                    value={formData[field.name]}
                                                    onChange={handleChange}
                                                    disabled={field.readOnly || banksLoading || !formData.companyId}
                                                    className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                                        }`}
                                                >
                                                    <option value="">
                                                        {!formData.companyId
                                                            ? "Select a company first"
                                                            : filteredBanks.length === 0
                                                                ? "No banks found for this company"
                                                                : "Select Bank"}
                                                    </option>
                                                    {filteredBanks.map((b) => (
                                                        <option key={b.bankId} value={b.bankId}>
                                                            {b.bankName} ({b.bankCode})
                                                        </option>
                                                    ))}
                                                </select>
                                                {errors[field.name] && (
                                                    <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (field.name === "currencyId") {
                                        return (
                                            <div key={field.name} className="space-y-1">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                <select
                                                    name={field.name}
                                                    value={formData[field.name]}
                                                    onChange={handleChange}
                                                    disabled={field.readOnly || currenciesLoading}
                                                    className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                                        }`}
                                                >
                                                    <option value="">Select Currency</option>
                                                    {currencies.map((c) => (
                                                        <option key={c.curId} value={c.curId}>
                                                            {c.code} ({c.symbol}) - {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {errors[field.name] && (
                                                    <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (field.type === "textarea") {
                                        return (
                                            <div key={field.name} className="space-y-1">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                <textarea
                                                    name={field.name}
                                                    rows={3}
                                                    value={formData[field.name]}
                                                    onChange={handleChange}
                                                    placeholder={field.placeholder}
                                                    readOnly={field.readOnly}
                                                    className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                                        }`}
                                                />
                                                {errors[field.name] && (
                                                    <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (field.type === "select") {
                                        return (
                                            <div key={field.name} className="space-y-1">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                <select
                                                    name={field.name}
                                                    value={formData[field.name]}
                                                    onChange={handleChange}
                                                    disabled={field.readOnly}
                                                    className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-800 outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                                        }`}
                                                >
                                                    {field.options?.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                {errors[field.name] && (
                                                    <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                                                )}
                                            </div>
                                        );
                                    }

                                    // Default text / number input
                                    return (
                                        <div key={field.name} className="space-y-1">
                                            <label className="block text-sm font-medium text-gray-700">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </label>
                                            <input
                                                type={field.type || "text"}
                                                name={field.name}
                                                value={formData[field.name]}
                                                onChange={handleChange}
                                                placeholder={field.placeholder}
                                                readOnly={field.readOnly}
                                                className={`w-full px-3.5 py-2.5 ${field.readOnly ? "bg-gray-100 cursor-not-allowed text-gray-600" : "bg-gray-50 text-gray-800"
                                                    } border rounded-lg text-sm outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                                    }`}
                                            />
                                            {errors[field.name] && (
                                                <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                                            )}
                                        </div>
                                    );
                                })}
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
                            form="bank-book-form"
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
