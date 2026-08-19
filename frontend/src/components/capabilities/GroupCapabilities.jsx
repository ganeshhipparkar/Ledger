"use client";
import { useEffect, useState, useContext, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { authHeaders, isSuperAdmin } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import Header from "../Header";
import { loginContext } from "../hooks/LoginContext";
import { GroupFormSchema } from "@/components/Zod";

const MODULES = [
    {
        section: "Users",
        label: "User",
        key: "user",
        permissions: ["userList", "userView", "userAdd", "userUpdate"],
    },
    {
        section: "Users",
        label: "Group",
        key: "group",
        permissions: ["groupList", "groupView", "groupAdd", "groupUpdate"],
    },
    {
        section: "Users",
        label: "Customer",
        key: "customer",
        permissions: ["customerList", "customerView", "customerAdd", "customerUpdate"],
    },

    {
        section: "Companies",
        label: "Company",
        key: "company",
        permissions: ["companyList", "companyView", "companyAdd", "companyUpdate"],
    },

    {
        section: "Currencies",
        label: "Currency",
        key: "currency",
        permissions: ["currencyList", "currencyView", "currencyAdd", "currencyUpdate"],
    },
    {
        section: "Bank",
        label: "Bank",
        key: "bank",
        permissions: ["bankList", "bankView", "bankAdd", "bankUpdate"],
    },
    {
        section: "Bank",
        label: "Bank Book",
        key: "bankBook",
        permissions: ["bankBookList", "bankBookView", "bankBookAdd", "bankBookUpdate"],
    },
    {
        section: "Item Management",
        label: "Item Category",
        key: "itemCategory",
        permissions: ["itemCategoryList", "itemCategoryView", "itemCategoryAdd", "itemCategoryUpdate"],
    },
    {
        section: "Item Management",
        label: "Manufacturer",
        key: "manufacturer",
        permissions: ["manufacturerList", "manufacturerView", "manufacturerAdd", "manufacturerUpdate"],
    },
    {
        section: "Item Management",
        label: "Brand",
        key: "brand",
        permissions: ["brandList", "brandView", "brandAdd", "brandUpdate"],
    },
    {
        section: "Item Management",
        label: "Item",
        key: "item",
        permissions: ["itemList", "itemView", "itemAdd", "itemUpdate"],
    },
    {
        section: "Item Unit",
        label: "UOM",
        key: "uom",
        permissions: ["uomList", "uomView", "uomAdd", "uomUpdate"],
    },
    {
        section: "Item Unit",
        label: "Package",
        key: "package",
        permissions: ["packageList", "packageView", "packageAdd", "packageUpdate"],
    },
];

const COL_HEADERS = ["List", "View", "Add", "Update"];
const ALL_PERMS = MODULES.flatMap((m) => m.permissions).filter(Boolean);

export default function GroupCapabilities({ id }) {
    const { isLogin } = useContext(loginContext);
    const router = useRouter();
    const groupId = Number(Array.isArray(id) ? id[0] : id);

    const superAdmin = useMemo(() => isSuperAdmin(isLogin), [isLogin]);
    const [fetching, setFetching] = useState(true);
    const [loading, setLoading] = useState(false);
    const [group, setGroup] = useState(null);
    const [formData, setFormData] = useState({ groupName: "", groupCode: "", status: "active" });
    const [errors, setErrors] = useState({});
    const [checked, setChecked] = useState(() => Object.fromEntries(ALL_PERMS.map((p) => [p, false])));

    useEffect(() => {
        if (isLogin) {
            fetchGroup();
        }
    }, [isLogin]);

    const fetchGroup = async () => {
        setFetching(true);
        try {
            const [resGroup, resPerms] = await Promise.all([
                fetch("/relayapi", {
                    method: "GET",
                    headers: {
                        ...authHeaders(),
                        endpoint: `group-details/${groupId}`,
                        module: "group",
                    },
                }),
                fetch("/relayapi", {
                    method: "GET",
                    headers: {
                        ...authHeaders(),
                        endpoint: `group-permissions/${groupId}`,
                        module: "group",
                    },
                })
            ]);

            const groupPayload = await resGroup.json();
            const groupData = groupPayload?.encrypted ? decryptResponse(groupPayload.encrypted) : groupPayload;
            const permsPayload = await resPerms.json();
            const permsData = permsPayload?.encrypted ? decryptResponse(permsPayload.encrypted) : permsPayload;

            if (groupData?.groupId) {
                setGroup(groupData);
                setFormData({
                    groupName: groupData.groupName || "",
                    groupCode: groupData.groupCode || "",
                    status: groupData.status || "active",
                });
                const init = Object.fromEntries(ALL_PERMS.map((p) => [p, false]));
                if (permsData?.success === 1 && Array.isArray(permsData.permissions)) {
                    permsData.permissions.forEach((p) => { if (p in init) init[p] = true; });
                }
                setChecked(init);
            }
        } catch (err) {
            toast.error("Failed to load group.", { position: "top-right" });
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setErrors((prev) => ({ ...prev, [name]: "" }));
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const togglePerm = (perm) => setChecked((prev) => ({ ...prev, [perm]: !prev[perm] }));

    const toggleModule = (perms) => {
        const validPerms = perms.filter(Boolean);
        const allOn = validPerms.every((p) => checked[p]);
        setChecked((prev) => {
            const n = { ...prev };
            validPerms.forEach((p) => { n[p] = !allOn; });
            return n;
        });
    };

    const toggleColumn = (ci) => {
        const col = MODULES.map((m) => {
            if (!superAdmin && m.key === "group") return null;
            return m.permissions[ci];
        }).filter(Boolean);
        const allOn = col.every((p) => checked[p]);
        setChecked((prev) => {
            const n = { ...prev };
            col.forEach((p) => { n[p] = !allOn; });
            return n;
        });
    };

    const toggleAll = () => {
        const validPerms = ALL_PERMS.filter((p) => {
            if (!superAdmin && p.startsWith("group")) return false;
            return true;
        });
        const allOn = validPerms.every((p) => checked[p]);
        setChecked((prev) => {
            const n = { ...prev };
            validPerms.forEach((p) => { n[p] = !allOn; });
            return n;
        });
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
            const updateRes = await fetch("/relayapi", {
                method: "PUT",
                headers: {
                    ...authHeaders(),
                    "Content-Type": "application/json",
                    endpoint: "group-update",
                    module: "group",
                },
                body: JSON.stringify({ groupId, ...formData }),
            });

            const updatePayload = await updateRes.json();
            const updateData = updatePayload?.encrypted ? decryptResponse(updatePayload.encrypted) : updatePayload;
            if (updateData?.settings?.success !== 1 && updateData?.status?.success !== 1 && !updateRes.ok) {
                toast.error(updateData?.message || updateData?.settings?.message || "Failed to update role.", { position: "top-right" });
                return;
            }

            const permRes = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    "Content-Type": "application/json",
                    endpoint: "group-permissions-save",
                    module: "group",
                },
                body: JSON.stringify({
                    groupId,
                    permissions: ALL_PERMS.filter((p) => checked[p]),
                }),
            });

            const permPayload = await permRes.json();
            const permData = permPayload?.encrypted ? decryptResponse(permPayload.encrypted) : permPayload;
            if (permData?.success === 1) {
                toast.success("Role saved successfully", { position: "top-right" });
                setTimeout(() => router.push("/roles"), 1000);
            } else {
                toast.error(permData?.message || "Failed to save permissions.", { position: "top-right" });
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

    const isModuleAllOn = (perms) => {
        const validPerms = perms.filter(Boolean);
        return validPerms.length > 0 && validPerms.every((p) => checked[p]);
    };
    const isColAllOn = (ci) => {
        const col = MODULES.map((m) => {
            if (!superAdmin && m.key === "group") return null;
            return m.permissions[ci];
        }).filter(Boolean);
        return col.length > 0 && col.every((p) => checked[p]);
    };
    const isAllOn = () => {
        const validPerms = ALL_PERMS.filter((p) => {
            if (!superAdmin && p.startsWith("group")) return false;
            return true;
        });
        return validPerms.length > 0 && validPerms.every((p) => checked[p]);
    };


    if (!isLogin) return null;

    if (fetching) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="roles" />
                <div className="p-8 text-gray-400 text-sm">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f6f8]">
            <Header page="roles" />

            <div className="px-6 py-6">
                <nav className="mb-4 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={() => router.push("/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={() => router.push("/roles")}>Roles</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">{group?.groupName}</span>
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
                                <input type="text" name="groupCode" value={formData.groupCode} readOnly onChange={handleChange} placeholder="e.g. GRP01" className={`${inputClass} bg-gray-50 cursor-not-allowed`} />
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
                            <label className={`${labelClass} mt-1`}>Select Modules <span className="text-red-500">*</span></label>
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-gray-200">
                                            <th className="w-8 py-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={isAllOn()}
                                                    onChange={toggleAll}
                                                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                                                />
                                            </th>
                                            <th className="py-3 text-left text-gray-500 font-semibold w-36 pl-2">Module</th>
                                            {COL_HEADERS.map((h, ci) => (
                                                <th key={h} className="py-3 text-center px-6">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={isColAllOn(ci)}
                                                            onChange={() => toggleColumn(ci)}
                                                            className="w-4 h-4 accent-blue-600 cursor-pointer"
                                                        />
                                                        <span className="text-gray-500 font-semibold">{h}</span>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {MODULES.map((mod, index) => {
                                            const showSectionHeader = index === 0 || mod.section !== MODULES[index - 1].section;
                                            return (
                                                <Fragment key={mod.key}>
                                                    {showSectionHeader && (
                                                        <tr className="bg-gray-100/90 border-y border-gray-200">
                                                            <td colSpan={COL_HEADERS.length + 2} className="py-2 px-3 font-bold text-gray-700 text-xs tracking-wider uppercase">
                                                                {mod.section}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                                                        <td className="py-3.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={isModuleAllOn(mod.permissions)}
                                                                disabled={!superAdmin && mod.key === "group"}
                                                                onChange={() => toggleModule(mod.permissions)}
                                                                className="w-4 h-4 accent-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                            />
                                                        </td>
                                                        <td className={`py-3.5 pl-2 font-medium ${!superAdmin && mod.key === "group" ? "text-gray-400" : "text-gray-700"}`}>{mod.label}</td>
                                                        {mod.permissions.map((perm, idx) => (
                                                            <td key={perm || idx} className="py-3.5 text-center px-6">
                                                                {perm ? (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!checked[perm]}
                                                                        disabled={!superAdmin && mod.key === "group"}
                                                                        onChange={() => togglePerm(perm)}
                                                                        className="w-4 h-4 accent-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    />
                                                                ) : null}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
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