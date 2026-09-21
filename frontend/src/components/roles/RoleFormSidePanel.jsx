"use client";
import { useState, useContext, useMemo } from "react";
import { toast } from "react-toastify";
import { authHeaders, isSuperAdmin } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { GroupFormSchema } from "@/components/Zod";
import { loginContext } from "@/components/hooks/LoginContext";
import PermissionMatrix, { ALL_PERMS } from "@/components/capabilities/PermissionMatrix";

export default function RoleFormSidePanel({ isOpen, onClose, onSuccess }) {
    const { isLogin } = useContext(loginContext);
    const superAdmin = useMemo(() => isSuperAdmin(isLogin), [isLogin]);

    const [formData, setFormData] = useState({ groupName: "", groupCode: "", status: "active" });
    const [checked, setChecked] = useState(() => Object.fromEntries(ALL_PERMS.map((p) => [p, false])));
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setErrors((prev) => ({ ...prev, [name]: "" }));
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setFormData({ groupName: "", groupCode: "", status: "active" });
        setChecked(Object.fromEntries(ALL_PERMS.map((p) => [p, false])));
        setErrors({});
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = GroupFormSchema.safeParse(formData);
        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) {
                    fieldErrors[field] = err.message;
                }
            });
            setErrors(fieldErrors);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    "Content-Type": "application/json",
                    endpoint: "group-add",
                    module: "group",
                },
                body: JSON.stringify(formData),
            });

            const resJson = await response.json();
            const data = resJson?.encrypted ? decryptResponse(resJson.encrypted) : resJson;

            if (data?.settings?.success === 1 || data?.status?.success === 1 || response.ok) {
                const newGroupId = data?.settings?.id;
                if (!newGroupId) {
                    toast.success("Role created successfully, but unable to assign permissions automatically.", { position: "top-right" });
                    resetForm();
                    onSuccess?.();
                    onClose();
                    return;
                }

                const selectedPerms = Object.keys(checked).filter((k) => checked[k]);
                
                // Second call to save permissions
                const permResponse = await fetch("/relayapi", {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        "Content-Type": "application/json",
                        endpoint: "group-permissions-save",
                        module: "group",
                    },
                    body: JSON.stringify({ groupId: newGroupId, permissions: selectedPerms }),
                });

                const permResJson = await permResponse.json();
                const permData = permResJson?.encrypted ? decryptResponse(permResJson.encrypted) : permResJson;

                if (permData?.success === 1 || permResponse.ok) {
                    toast.success("Role created and permissions saved successfully", { position: "top-right" });
                } else {
                    toast.warning("Role created, but failed to save some permissions.", { position: "top-right" });
                }
                
                resetForm();
                onSuccess?.();
                onClose();
            } else {
                toast.error(data?.message || data?.settings?.message || "Failed to create role.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(`${err}`, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm transition";
    const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";
    const errorClass = "mt-1 text-xs text-red-500";

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 z-40 transition-opacity"
                onClick={handleClose}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Add Role</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Create a new role / group</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="space-y-5">
                        <div>
                            <label className={labelClass}>
                                Group Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="groupName"
                                value={formData.groupName}
                                onChange={handleChange}
                                placeholder="Enter group name"
                                className={inputClass}
                            />
                            {errors.groupName && <p className={errorClass}>{errors.groupName}</p>}
                        </div>

                        <div>
                            <label className={labelClass}>
                                Group Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="groupCode"
                                value={formData.groupCode}
                                onChange={handleChange}
                                placeholder="e.g. GRP01"
                                className={inputClass}
                            />
                            {errors.groupCode && <p className={errorClass}>{errors.groupCode}</p>}
                        </div>

                        <div>
                            <label className={labelClass}>
                                Status <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            {errors.status && <p className={errorClass}>{errors.status}</p>}
                        </div>

                        <div>
                            <label className={`${labelClass} mt-4`}>
                                Permissions <span className="text-red-500">*</span>
                            </label>
                            <div className="overflow-x-auto border border-gray-200 rounded-xl mt-2">
                                <PermissionMatrix superAdmin={superAdmin} checked={checked} setChecked={setChecked} />
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        onClick={handleSubmit}
                        className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition cursor-pointer"
                    >
                        {loading ? "Creating..." : "Add Role"}
                    </button>
                </div>
            </div>
        </>
    );
}

