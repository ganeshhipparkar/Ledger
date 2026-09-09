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
import { taxGroupFormConfig } from "./configs/taxGroupForm.config";
import Loader from "../ui/Loader";

const getMySwal = () => withReactContent(Swal);

export default function TaxGroupFormSidePanel({
    isOpen,
    onClose,
    context = "taxGroup-add",
    id,
    onSuccess,
}) {
    const router = useRouter();
    const { displayUser, activeAssignment } = useContext(loginContext) || {};
    const config = taxGroupFormConfig.contexts[context];

    const isSuperAdmin = displayUser?.primaryProfile?.groupName === "superAdmin" || activeAssignment?.groupName === "superAdmin";

    const buildInitial = () =>
        config.fields.reduce((acc, f) => {
            acc[f.name] = f.defaultValue ?? "";
            return acc;
        }, {});

    const [formData, setFormData] = useState(buildInitial);
    const [taxCode, setTaxCode] = useState("");
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);

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
            setTaxCode("");
            const initial = buildInitial();
            if (!isSuperAdmin && activeAssignment?.companyId) {
                initial.companyId = String(activeAssignment.companyId);
            }
            setFormData(initial);
        }

        if (isSuperAdmin) {
            fetchCompanies();
        }
    }, [isOpen, context, id]);

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
            if (data?.taxId) {
                setTaxCode(data.taxCode || "");
                setFormData({
                    taxName: data.taxName || "",
                    taxValue: data.taxValue !== undefined ? String(data.taxValue) : "",
                    companyId: String(data.companyId || ""),
                });
            }
        } catch (err) {
            toast.error("Failed to load tax group data.", { position: "top-right" });
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
                },
                body: JSON.stringify({ page: 1, limit: 200 }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setCompanies(data?.data ?? []);
        } catch (err) {
            console.error(err);
        } finally {
            setCompaniesLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const isFormDirty = () => {
        const initial = buildInitial();
        if (!isSuperAdmin && activeAssignment?.companyId) {
            initial.companyId = String(activeAssignment.companyId);
        }
        return Object.keys(formData).some(
            (key) => (formData[key] || "") !== (initial[key] || "")
        );
    };

    const handleAttemptClose = () => {
        if (config.mode === "add" && isFormDirty()) {
            getMySwal().fire({
                title: "Discard changes?",
                text: "You have unsaved changes. Are you sure you want to close?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, discard",
                cancelButtonText: "Continue editing",
            }).then((result) => {
                if (result.isConfirmed) {
                    onClose();
                }
            });
        } else {
            onClose();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        const validation = config.schema.safeParse({
            ...(config.mode === "update" ? { taxId: Number(Array.isArray(id) ? id[0] : id) } : {}),
            ...formData,
        });

        if (!validation.success) {
            const formatted = {};
            validation.error.issues.forEach((issue) => {
                const path = issue.path[0];
                if (path && !formatted[path]) {
                    formatted[path] = issue.message;
                }
            });
            setErrors(formatted);
            return;
        }

        setLoading(true);

        try {
            const bodyPayload = { ...validation.data };
            const numericId = Number(Array.isArray(id) ? id[0] : id);

            const res = await fetch("/relayapi", {
                method: config.api.method,
                headers: {
                    ...authHeaders(),
                    endpoint: config.api.endpoint,
                    module: config.api.module,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    config.mode === "update"
                        ? { ...bodyPayload, taxId: numericId }
                        : bodyPayload
                ),
            });

            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (res.ok && data?.success !== 0) {
                toast.success(config.successMessage, { position: "top-right" });
                onClose();
                if (onSuccess) onSuccess();
            } else {
                toast.error(data?.message || "Operation failed", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message || "An error occurred", { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    if (!mounted || !visible) return null;

    const inputClass = (field) =>
        `w-full rounded-xl border px-4 py-3 text-sm transition focus:outline-none focus:ring-2 ${errors[field]
            ? "border-red-500 focus:ring-red-200"
            : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
        }`;

    const labelClass = "block text-sm font-semibold text-gray-700 mb-1";
    const errorClass = "mt-1 text-xs text-red-500";

    const content = (
        <div
            className={`fixed inset-0 z-50 overflow-hidden transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"
                }`}
        >
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-xs"
                onClick={handleAttemptClose}
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                <div
                    className={`pointer-events-auto w-screen max-w-md transform bg-white shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"
                        }`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">{config.title}</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {config.mode === "add"
                                    ? "Add new Tax Group."
                                    : "Update Tax Group."}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleAttemptClose}
                            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Form body */}
                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                            {fetching ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader label="Loading data..." />
                                </div>
                            ) : (
                                <>
                                    {/* Code (Read-only display in update mode) */}
                                    {config.mode === "update" && taxCode && (
                                        <div>
                                            <label className={labelClass}>Tax Code</label>
                                            <input
                                                type="text"
                                                value={taxCode}
                                                disabled
                                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono text-gray-600 cursor-not-allowed"
                                            />
                                        </div>
                                    )}

                                    {/* Tax Name */}
                                    <div>
                                        <label className={labelClass}>
                                            Tax Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="taxName"
                                            value={formData.taxName || ""}
                                            onChange={handleChange}
                                            placeholder="e.g. GST 18%"
                                            className={inputClass("taxName")}
                                        />
                                        {errors.taxName && <p className={errorClass}>{errors.taxName}</p>}
                                    </div>

                                    {/* Tax Value */}
                                    <div>
                                        <label className={labelClass}>
                                            Tax Value (%) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            name="taxValue"
                                            step="0.01"
                                            value={formData.taxValue}
                                            onChange={handleChange}
                                            placeholder="e.g. 18"
                                            className={inputClass("taxValue")}
                                        />
                                        {errors.taxValue && <p className={errorClass}>{errors.taxValue}</p>}
                                    </div>


                                    {/* Company Select */}
                                    <div>
                                        <label className={labelClass}>
                                            Company <span className="text-red-500">*</span>
                                        </label>
                                        {isSuperAdmin && config.mode === "add" ? (
                                            <select
                                                name="companyId"
                                                value={formData.companyId}
                                                onChange={handleChange}
                                                className={inputClass("companyId")}
                                                disabled={companiesLoading}
                                            >
                                                <option value="">Select Company</option>
                                                {companies.map((c) => (
                                                    <option key={c.companyId} value={String(c.companyId)}>
                                                        {c.companyName}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                value={
                                                    companies.find(
                                                        (c) => String(c.companyId) === String(formData.companyId)
                                                    )?.companyName ||
                                                    activeAssignment?.companyName ||
                                                    "Assigned Company"
                                                }
                                                disabled
                                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 cursor-not-allowed"
                                            />
                                        )}
                                        {errors.companyId && <p className={errorClass}>{errors.companyId}</p>}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3 bg-gray-50">
                            <button
                                type="button"
                                onClick={handleAttemptClose}
                                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || fetching}
                                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 transition cursor-pointer"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        {config.loadingButtonText}
                                    </span>
                                ) : (
                                    config.submitButtonText
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
