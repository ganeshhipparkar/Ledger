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
import { brandFormConfig } from "./configs/brandForm.config";
import Loader from "../ui/Loader";

const getMySwal = () => withReactContent(Swal);

export default function BrandFormSidePanel({
    isOpen,
    onClose,
    context = "brand-add",
    id,
    onSuccess,
}) {
    const router = useRouter();
    const { displayUser, activeAssignment } = useContext(loginContext) || {};
    const config = brandFormConfig.contexts[context] || brandFormConfig.contexts["brand-add"];

    const isSuperAdmin = displayUser?.primaryProfile?.groupName === "superAdmin" || activeAssignment?.groupName === "superAdmin";

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
    const [manufacturers, setManufacturers] = useState([]);
    const [manufacturersLoading, setManufacturersLoading] = useState(false);

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
        fetchManufacturers();
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
            if (data?.brandId) {
                setFormData({
                    brandName: data.brandName || "",
                    companyId: String(data.companyId || ""),
                    manufacturerId: data.manufacturerId ? String(data.manufacturerId) : "",
                    status: data.status || "Active",
                });
            }
        } catch (err) {
            toast.error("Failed to load brand data.", { position: "top-right" });
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

    const fetchManufacturers = async () => {
        setManufacturersLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "manufacturer-list",
                    module: "manufacturer",
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
            setManufacturers(data?.data ?? []);
        } catch {
            toast.error("Failed to load manufacturers.", { position: "top-right" });
        } finally {
            setManufacturersLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        const payloadToValidate = {
            ...formData,
            companyId: formData.companyId ? Number(formData.companyId) : undefined,
            manufacturerId: formData.manufacturerId ? Number(formData.manufacturerId) : undefined,
        };
        if (config.mode === "update") {
            payloadToValidate.brandId = Number(Array.isArray(id) ? id[0] : id);
        }

        const parseRes = config.schema.safeParse(payloadToValidate);
        if (!parseRes.success) {
            const fieldErrors = {};
            parseRes.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) {
                    fieldErrors[field] = err.message;
                }
            });
            setErrors(fieldErrors);
            return;
        }

        const isUpdate = config.mode === "update";
        const confirmRes = await getMySwal().fire({
            title: isUpdate ? "Update Brand?" : "Add Brand?",
            text: isUpdate
                ? "Are you sure you want to save these changes?"
                : "Are you sure you want to add this brand?",
            icon: isUpdate ? "question" : "info",
            showCancelButton: true,
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#6b7280",
            confirmButtonText: isUpdate ? "Yes, update it!" : "Yes, add it!",
            cancelButtonText: "Cancel",
        });
        if (!confirmRes.isConfirmed) return;

        setLoading(true);
        try {
            const bodyObj = {
                brandName: formData.brandName,
                manufacturerId: formData.manufacturerId ? Number(formData.manufacturerId) : null,
                status: formData.status,
            };
            if (config.mode === "add") {
                bodyObj.companyId = Number(formData.companyId);
            } else {
                bodyObj.brandId = Number(Array.isArray(id) ? id[0] : id);
            }

            const res = await fetch("/relayapi", {
                method: config.api.method,
                headers: {
                    ...authHeaders(),
                    endpoint: config.api.endpoint,
                    module: config.api.module,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(bodyObj),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1) {
                toast.success(config.successMessage, { position: "top-right" });
                onClose();
                if (onSuccess) onSuccess();
            } else {
                const msg = data?.message || "Operation failed.";
                setErrors({ global: msg });
                toast.error(msg, { position: "top-right" });
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred.", { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    if (!mounted || (!isOpen && !visible)) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-hidden">
            <div
                className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"
                    }`}
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div
                    className={`w-screen max-w-md bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"
                        }`}
                >
                    {/* Header */}
                    <div className="px-6 py-5 bg-[#1f2937] text-white flex items-center justify-between">
                        <h2 className="text-xl font-semibold">{config.title}</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-300 hover:text-white rounded-lg p-1 transition cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {fetching ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader label="Loading details..." />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {errors.global && (
                                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                                        {errors.global}
                                    </div>
                                )}

                                {config.fields.map((field) => {
                                    if (field.type === "company-select") {
                                        return (
                                            <div key={field.name}>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                {isSuperAdmin ? (
                                                    <select
                                                        name={field.name}
                                                        value={formData[field.name]}
                                                        onChange={handleChange}
                                                        disabled={field.readOnly || companiesLoading}
                                                        className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                                            } ${field.readOnly ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white text-gray-800"}`}
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
                                                        value={activeAssignment?.companyName || "Your Company"}
                                                        className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3.5 py-2.5 text-sm text-gray-500 outline-none cursor-not-allowed"
                                                    />
                                                )}
                                                {errors[field.name] && (
                                                    <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (field.type === "manufacturer-select") {
                                        return (
                                            <div key={field.name}>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                <select
                                                    name={field.name}
                                                    value={formData[field.name]}
                                                    onChange={handleChange}
                                                    disabled={field.readOnly || manufacturersLoading}
                                                    className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                                        } ${field.readOnly ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white text-gray-800"}`}
                                                >
                                                    <option value="">Select Manufacturer</option>
                                                    {manufacturers
                                                        .filter((m) =>
                                                            !formData.companyId || String(m.companyId) === String(formData.companyId)
                                                        )
                                                        .map((m) => (
                                                            <option key={m.manufacturerId} value={m.manufacturerId}>
                                                                {m.manufacturerName}
                                                            </option>
                                                        ))}
                                                </select>
                                                {errors[field.name] && (
                                                    <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (field.type === "select") {
                                        return (
                                            <div key={field.name}>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                <select
                                                    name={field.name}
                                                    value={formData[field.name]}
                                                    onChange={handleChange}
                                                    disabled={field.readOnly}
                                                    className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                                        } ${field.readOnly ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white text-gray-800"}`}
                                                >
                                                    {field.options.map((opt) => (
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

                                    return (
                                        <div key={field.name}>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </label>
                                            <input
                                                type={field.type || "text"}
                                                name={field.name}
                                                value={formData[field.name]}
                                                onChange={handleChange}
                                                readOnly={field.readOnly}
                                                placeholder={field.placeholder}
                                                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition ${errors[field.name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"
                                                    } ${field.readOnly ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white text-gray-800"}`}
                                            />
                                            {errors[field.name] && (
                                                <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                                            )}
                                        </div>
                                    );
                                })}

                                <div className="pt-4 flex items-center justify-end gap-3 border-t">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition cursor-pointer"
                                    >
                                        {loading ? config.loadingButtonText : config.submitButtonText}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
