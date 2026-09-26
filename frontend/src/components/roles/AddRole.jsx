"use client";
import Link from "next/link";
import { useState, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { authHeaders, isSuperAdmin } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import Header from "../Header";
import { loginContext } from "../hooks/LoginContext";
import { GroupFormSchema } from "@/components/Zod";
import PermissionMatrix, { ALL_PERMS } from "../capabilities/PermissionMatrix";

export default function AddRole() {
    const { isLogin } = useContext(loginContext);
    const router = useRouter();

    const superAdmin = useMemo(() => isSuperAdmin(isLogin), [isLogin]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ groupName: "", groupCode: "", status: "active" });
    const [errors, setErrors] = useState({});
    const [checked, setChecked] = useState(() => Object.fromEntries(ALL_PERMS.map((p) => [p, false])));

    const handleChange = (e) => {
        const { name, value } = e.target;
        setErrors((prev) => ({ ...prev, [name]: "" }));
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = GroupFormSchema.safeParse(formData);
        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
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

            if (data?.settings?.success === 1) {
                const newGroupId = data?.settings?.id;
                if (!newGroupId) {
                    toast.success("Role created successfully, but unable to assign permissions automatically.", { position: "top-right" });
                    setTimeout(() => router.push("/roles"), 1000);
                    return;
                }

                const selectedPerms = Object.keys(checked).filter((k) => checked[k]);

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

                setTimeout(() => router.push("/roles"), 1000);
            } else {
                toast.error(data?.message || data?.settings?.message || "Failed to create role.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(`${err}`, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-blue-500 text-sm bg-white";
    const labelClass = "text-sm font-medium text-gray-700 w-40 shrink-0 pt-2.5";
    const errorClass = "mt-1 text-sm text-red-500";

    if (!isLogin) return null;

    return (
        <div className="min-h-screen bg-[#f5f6f8]">
            <Header page="roles" />

            <div className="px-6 py-6">
                <nav className="mb-4 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600 hover:underline">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/roles" className="cursor-pointer hover:text-blue-600 hover:underline">Roles</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Add Role</span>
                </nav>

                <div className="mb-6 flex items-center justify-end">
                    <button
                        onClick={() => router.push("/roles")}
                        className="rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300 cursor-pointer"
                    >
                        ← Back
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="rounded-2xl bg-white p-8 shadow-sm space-y-6">

                        <div className="flex items-start gap-6">
                            <label className={labelClass}>Group Name <span className="text-red-500">*</span></label>
                            <div className="flex-1">
                                <input type="text" name="groupName" value={formData.groupName} onChange={handleChange} placeholder="Enter group name" className={inputClass} />
                                {errors.groupName && <p className={errorClass}>{errors.groupName}</p>}
                            </div>
                        </div>
                        <div className="flex items-start gap-6">
                            <label className={labelClass}>Group Code <span className="text-red-500">*</span></label>
                            <div className="flex-1">
                                <input type="text" name="groupCode" value={formData.groupCode} onChange={handleChange} placeholder="e.g. GRP01" className={inputClass} />
                                {errors.groupCode && <p className={errorClass}>{errors.groupCode}</p>}
                            </div>
                        </div>

                        <div className="flex items-start gap-6">
                            <label className={labelClass}>Status <span className="text-red-500">*</span></label>
                            <div className="flex-1">
                                <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-start gap-6">
                            <label className={`${labelClass} mt-1`}>Select Modules</label>
                            <div className="flex-1 overflow-x-auto">
                                <PermissionMatrix superAdmin={superAdmin} checked={checked} setChecked={setChecked} />
                            </div>
                        </div>

                    </div>

                    <div className="mt-6 flex justify-end gap-4">
                        <button type="button" onClick={() => router.push("/roles")} className="rounded-lg bg-gray-200 px-8 py-2.5 font-medium text-gray-700 hover:bg-gray-300 transition cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-8 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition cursor-pointer">
                            {loading ? "Saving..." : "Save Role"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
