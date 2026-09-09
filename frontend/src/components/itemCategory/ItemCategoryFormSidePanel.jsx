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
import { itemCategoryFormConfig } from "./configs/itemCategoryForm.config";
import Loader from "../ui/Loader";

const getMySwal = () => withReactContent(Swal);

export default function ItemCategoryFormSidePanel({
    isOpen,
    onClose,
    context = "item-category-add",
    id,
    onSuccess,
}) {
    const router = useRouter();
    const { displayUser, activeAssignment } = useContext(loginContext) || {};
    const config = itemCategoryFormConfig.contexts[context];

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

    const [parentCategories, setParentCategories] = useState([]);
    const [parentsLoading, setParentsLoading] = useState(false);

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
    }, [isOpen, context, id]);

    useEffect(() => {
        if (!isOpen) return;
        if (formData.companyId) {
            fetchParentCategories(formData.companyId);
        } else {
            setParentCategories([]);
        }
    }, [formData.companyId, isOpen]);

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
            if (data?.itemCategoryId) {
                setFormData({
                    itemCategoryName: data.itemCategoryName || "",
                    type: data.type || "Goods",
                    companyId: String(data.companyId || ""),
                    parentCategoryId: data.parentCategoryId ? String(data.parentCategoryId) : "",
                    status: data.status || "Active",
                });
            }
        } catch (err) {
            toast.error("Failed to load item category data.", { position: "top-right" });
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
                body: JSON.stringify({ page: 1, limit: 500, filters: [{ key: "status", value: "Active", operator: "=" }], condition: "All" }),
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

    const fetchParentCategories = async (companyId) => {
        setParentsLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "item-category-list",
                    module: "item-category",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    page: 1,
                    limit: 500,
                    filters: [
                        { key: "status", value: "Active", operator: "=" },
                        { key: "companyId", value: Number(companyId), operator: "=" },
                    ],
                    condition: "All",
                }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            let list = data?.data ?? [];

            const currentIdNum = Number(Array.isArray(id) ? id[0] : id);
            if (config.mode === "update" && currentIdNum) {
                list = list.filter((item) => Number(item.itemCategoryId) !== currentIdNum);
            }
            setParentCategories(list);
        } catch {
            toast.error("Failed to load parent categories.", { position: "top-right" });
            setParentCategories([]);
        } finally {
            setParentsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setErrors((prev) => ({ ...prev, [name]: "" }));

        if (name === "companyId") {
            setFormData((prev) => ({ ...prev, [name]: value, parentCategoryId: "" }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleClose = async (e, flag) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (flag) {
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
        } else {
            onClose();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const numericId = Number(Array.isArray(id) ? id[0] : id);
        const validationInput = {
            ...formData,
            companyId: formData.companyId ? Number(formData.companyId) : undefined,
            parentCategoryId: formData.parentCategoryId ? Number(formData.parentCategoryId) : null,
        };
        if (config.mode === "update") {
            validationInput.itemCategoryId = numericId;
        }
        console.log(validationInput, "validatoin lkasdjf")
        const result = config.schema.safeParse(validationInput);
        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
            });
            setErrors(fieldErrors);
            return;
        }

        const isUpdate = config.mode === "update";
        const confirmRes = await getMySwal().fire({
            title: isUpdate ? "Update Item Category?" : "Add Item Category?",
            text: isUpdate
                ? "Are you sure you want to save these changes?"
                : "Are you sure you want to add this item category?",
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
            const payload = isUpdate
                ? {
                    itemCategoryId: numericId,
                    itemCategoryName: formData.itemCategoryName,
                    type: formData.type || undefined,
                    companyId: Number(formData.companyId),
                    parentCategoryId: formData.parentCategoryId ? Number(formData.parentCategoryId) : null,
                    status: formData.status,
                }
                : {
                    itemCategoryName: formData.itemCategoryName,
                    type: formData.type || undefined,
                    companyId: Number(formData.companyId),
                    parentCategoryId: formData.parentCategoryId ? Number(formData.parentCategoryId) : null,
                    status: formData.status,
                    ...(displayUser?.userId ? { addedBy: displayUser.userId } : {}),
                };

            const response = await fetch("/relayapi", {
                method: config.api.method,
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders(),
                    endpoint: config.api.endpoint,
                    module: config.api.module,
                },
                body: JSON.stringify(payload),
            });

            const resJson = await response.json();
            const data = resJson?.encrypted ? decryptResponse(resJson.encrypted) : resJson;

            if (response.status === 401 || response.status === 403) {
                router.push("/forbidden");
                return;
            }

            if (response.ok && (data?.settings?.success === 1 || data?.success === 1)) {
                toast.success(config.successMessage, { position: "top-right" });
                onClose();
                if (onSuccess) setTimeout(onSuccess, 300);
            } else {
                toast.error(data?.message || "Operation failed.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(`${err}`, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    const renderField = (field) => {
        if (field.hidden) return null;

        const inputCls =
            "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition " +
            (errors[field.name]
                ? "border-red-400 focus:border-red-500"
                : "border-gray-200 focus:border-blue-500");

        if (field.type === "select") {
            return (
                <div key={field.name}>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
                    </label>
                    <select
                        name={field.name}
                        value={formData[field.name]}
                        onChange={handleChange}
                        disabled={field.readOnly}
                        className={inputCls + " bg-white cursor-pointer"}
                    >
                        {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {errors[field.name] && (
                        <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                    )}
                </div>
            );
        }

        if (field.type === "parent-category-select") {
            const noCompanySelected = !formData.companyId;
            return (
                <div key={field.name}>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
                    </label>
                    <select
                        name={field.name}
                        value={formData[field.name]}
                        onChange={handleChange}
                        disabled={field.readOnly || noCompanySelected || parentsLoading}
                        className={
                            inputCls +
                            (noCompanySelected || field.readOnly
                                ? " bg-gray-50 text-gray-400 cursor-not-allowed"
                                : " bg-white cursor-pointer")
                        }
                    >
                        {noCompanySelected ? (
                            <option value="">Select a company first</option>
                        ) : (
                            <>
                                <option value="">
                                    {parentsLoading ? "Loading parent categories..." : "None"}
                                </option>
                                {parentCategories.map((c) => (
                                    <option key={c.itemCategoryId} value={String(c.itemCategoryId)}>
                                        {c.itemCategoryName} ({c.itemCategoryCode})
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                    {errors[field.name] && (
                        <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                    )}
                </div>
            );
        }

        if (field.type === "company-select") {
            // Super Admin: dropdown of all active companies
            if (isSuperAdmin) {
                return (
                    <div key={field.name}>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            {field.label}<span className="ml-0.5 text-red-500">*</span>
                        </label>
                        <select
                            name={field.name}
                            value={formData[field.name]}
                            onChange={handleChange}
                            disabled={field.readOnly || companiesLoading}
                            className={inputCls + (field.readOnly ? " bg-gray-50 text-gray-500 cursor-not-allowed" : " bg-white cursor-pointer")}
                        >
                            <option value="">
                                {companiesLoading ? "Loading companies..." : "Select a company"}
                            </option>
                            {companies.map((c) => (
                                <option key={c.companyId} value={String(c.companyId)}>
                                    {c.companyName}
                                </option>
                            ))}
                        </select>
                        {errors[field.name] && (
                            <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                        )}
                    </div>
                );
            }

            const lockedName = activeAssignment?.companyName || "Your Company";
            return (
                <div key={field.name}>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        {field.label}<span className="ml-0.5 text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={lockedName}
                        readOnly
                        className={inputCls + " bg-gray-50 text-gray-500 cursor-not-allowed"}
                    />
                    {errors[field.name] && (
                        <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                    )}
                </div>
            );
        }

        return (
            <div key={field.name}>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
                </label>
                <input
                    type={field.type || "text"}
                    name={field.name}
                    value={formData[field.name]}
                    onChange={handleChange}
                    readOnly={field.readOnly}
                    placeholder={field.placeholder}
                    className={inputCls + (field.readOnly ? " bg-gray-50 text-gray-500 cursor-not-allowed" : " bg-white")}
                />
                {errors[field.name] && (
                    <p className="mt-1 text-sm text-red-500">{errors[field.name]}</p>
                )}
            </div>
        );
    };

    if (!mounted || !visible) return null;

    const panelContent = (
        <>
            <div
                className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                onClick={(e) => handleClose(e, false)}
            />

            <div
                className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                <div className="flex items-center justify-between border-b px-6 py-4 bg-white sticky top-0 z-10">
                    <h2 className="text-lg font-semibold text-gray-800">{config.title}</h2>
                    <button
                        type="button"
                        onClick={(e) => handleClose(e, false)}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                {fetching ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Loader label="Loading..." />
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-1 flex-col overflow-y-auto"
                    >
                        <div className="flex-1 space-y-5 px-6 py-5">
                            {config.fields.map((field) => renderField(field))}
                        </div>

                        <div className="border-t bg-white px-6 py-4 flex gap-3">
                            <button
                                type="button"
                                onClick={(e) => handleClose(e, true)}
                                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition cursor-pointer"
                            >
                                {loading ? config.loadingButtonText : config.submitButtonText}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </>
    );

    return createPortal(panelContent, document.body);
}
