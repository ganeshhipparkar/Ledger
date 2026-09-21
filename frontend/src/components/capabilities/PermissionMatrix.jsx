"use client";
import { Fragment } from "react";

export const MODULES = [
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
    {
        section: "Master",
        label: "Terms & Conditions",
        key: "termsConditions",
        permissions: ["termsConditionsList", "termsConditionsView", "termsConditionsAdd", "termsConditionsUpdate"],
    },
    {
        section: "Master",
        label: "Tax Group",
        key: "taxGroup",
        permissions: ["taxGroupList", "taxGroupView", "taxGroupAdd", "taxGroupUpdate"],
    },
    {
        section: "Finance",
        label: "Payment Transaction",
        key: "paymentTransaction",
        permissions: ["paymentTransactionList", "paymentTransactionView", "paymentTransactionAdd", "paymentTransactionUpdate"],
    },
    {
        section: "Finance",
        label: "Quotation",
        key: "quotation",
        permissions: ["quotationList", "quotationView", "quotationAdd", "quotationUpdate"],
    },
    {
        section: "Finance",
        label: "Order",
        key: "order",
        permissions: ["orderList", "orderView", "orderAdd", "orderUpdate"],
    },
    {
        section: "Finance",
        label: "Invoice",
        key: "invoice",
        permissions: ["invoiceList", "invoiceView", "invoiceAdd", "invoiceUpdate"],
    }
];

export const COL_HEADERS = ["List", "View", "Add", "Update"];
export const ALL_PERMS = MODULES.flatMap((m) => m.permissions).filter(Boolean);

export default function PermissionMatrix({ superAdmin, checked, setChecked }) {
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

    const isAllOn = () => {
        const validPerms = ALL_PERMS.filter((p) => {
            if (!superAdmin && p.startsWith("group")) return false;
            return true;
        });
        return validPerms.every((p) => checked[p]);
    };

    const isColAllOn = (ci) => {
        const col = MODULES.map((m) => {
            if (!superAdmin && m.key === "group") return null;
            return m.permissions[ci];
        }).filter(Boolean);
        return col.every((p) => checked[p]);
    };

    const isModuleAllOn = (perms) => {
        const validPerms = perms.filter(Boolean);
        return validPerms.every((p) => checked[p]);
    };

    return (
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
                                {COL_HEADERS.map((_, idx) => {
                                    const perm = mod.permissions[idx];
                                    return (
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
                                    );
                                })}
                            </tr>
                        </Fragment>
                    );
                })}
            </tbody>
        </table>
    );
}
