'use client';

import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginContext } from "./hooks/LoginContext";
import { isSuperAdmin } from "@/app/lib/auth";

export default function HeaderMenuPanel({ isOpen, onClose, hasMounted }) {
    const router = useRouter();
    const { isLogin, impersonating, permissions, displayUser } = useContext(loginContext);

    const [activeCategory, setActiveCategory] = useState("dashboard");
    const [superAdmin, setSuperAdmin] = useState(false);

    useEffect(() => {
        const activeUser = impersonating || isLogin;
        setSuperAdmin(isSuperAdmin(activeUser));
    }, [displayUser, impersonating, permissions]);

    const activePermissions = hasMounted ? (permissions || []) : [];
    const isSuper = hasMounted ? superAdmin : false;

    const rawCategories = [
        {
            id: "dashboard",
            title: "Dashboard",
            items: [
                { label: "Sitemap", redirectTo: "/", show: true },
            ]
        },
        {
            id: "users",
            title: "Users",
            items: [
                { label: "Users", redirectTo: "/users", show: activePermissions.includes("userList") },
                { label: "Customers", redirectTo: "/customer-list", show: activePermissions.includes("customerList") },
            ]
        },
        {
            id: "master",
            title: "Master",
            items: [
                { label: "Companies", redirectTo: "/company-list", show: activePermissions.includes("companyList") || isSuper },
                { label: "Roles", redirectTo: "/roles", show: activePermissions.includes("groupList") || isSuper },
                { label: "Currencies", redirectTo: "/currency-list", show: activePermissions.includes("currencyList") || isSuper },
                { label: "Terms & Conditions", redirectTo: "/terms-conditions-list", show: activePermissions.includes("termsConditionsList") || isSuper },
                { label: "Tax Group", redirectTo: "/tax-group-list", show: activePermissions.includes("taxGroupList") },

                {
                    groupLabel: "Item Management",
                    children: [
                        { label: "Item Category", redirectTo: "/item-category-list", show: activePermissions.includes("itemCategoryList") },
                        { label: "Manufacturer", redirectTo: "/manufacturer-list", show: activePermissions.includes("manufacturerList") },
                        { label: "Bank", redirectTo: "/bank-list", show: activePermissions.includes("bankList") },
                        { label: "Bank Book", redirectTo: "/bank-book-list", show: activePermissions.includes("bankBookList") },
                        { label: "Brand", redirectTo: "/brand-list", show: activePermissions.includes("brandList") },
                        { label: "Items", redirectTo: "/item-list", show: activePermissions.includes("itemList") },

                    ]
                },

                {
                    groupLabel: "Item Unit",
                    children: [
                        { label: "UOM", redirectTo: "/uom-list", show: activePermissions.includes("uomList") },
                        { label: "Package", redirectTo: "/package-list", show: activePermissions.includes("packageList") },
                    ]
                },
            ]
        },
        {
            id: "finance",
            title: "Finance",
            items: [
                { label: "Payment Transaction", redirectTo: "/payment-transaction-list", show: activePermissions.includes("paymentTransactionList") || isSuper },
            ]
        }
    ];

    const menuCategories = rawCategories
        .map(cat => {
            const filteredItems = cat.items
                .map(item => {
                    if (item.children) {
                        const visibleChildren = item.children.filter(child => child.show);
                        return visibleChildren.length > 0
                            ? { ...item, children: visibleChildren }
                            : null;
                    }
                    return item.show ? item : null;
                })
                .filter(Boolean);

            const totalLeafCount = filteredItems.reduce((acc, item) => {
                if (item.children) {
                    return acc + item.children.length;
                }
                return acc + 1;
            }, 0);

            return {
                ...cat,
                items: filteredItems,
                count: totalLeafCount,
            };
        })
        .filter(cat => cat.items.length > 0);

    const currentCat = menuCategories.find(c => c.id === activeCategory) || menuCategories[0];
    const currentCatId = currentCat?.id;

    return (
        <>
            {/* Menu Panel Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 top-[72px] bg-black/40 z-30 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Menu Panel Drawer */}
            <div
                className={`fixed inset-x-0 bottom-0 top-[72px] bg-white z-40 shadow-2xl flex transition-transform duration-300 ease-in-out ${isOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
                    }`}
            >
                {/* Left sidebar: category selector */}
                <div className="w-64 border-r border-gray-200 bg-gray-50/50 p-4 flex flex-col gap-1 overflow-y-auto">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Modules
                    </div>
                    {menuCategories.map((cat) => {
                        const isActive = cat.id === currentCatId;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer text-left ${isActive
                                    ? "bg-blue-50 text-blue-700 font-semibold"
                                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                    }`}
                            >
                                <span>{cat.title}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200/60 text-gray-600">
                                    {cat.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Right main area: category items */}
                <div className="flex-1 p-6 overflow-y-auto bg-white">
                    {currentCat && (
                        <div className="space-y-6">
                            <div className="pb-3 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-800">{currentCat.title}</h3>
                            </div>

                            {/* Flat Items */}
                            {currentCat.items.some(item => !item.children) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {currentCat.items
                                        .filter(item => !item.children)
                                        .map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    onClose();
                                                    router.push(item.redirectTo);
                                                }}
                                                className="group flex flex-col gap-1 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-500 hover:shadow-md transition-all cursor-pointer text-left"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-gray-800 group-hover:text-blue-600">
                                                        {item.label}
                                                    </span>
                                                    <span className="text-gray-400 group-hover:text-blue-600 text-sm">
                                                        →
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            )}

                            {/* Grouped Sub-sections */}
                            {currentCat.items
                                .filter(item => item.children)
                                .map((group, gIdx) => (
                                    <div key={gIdx} className="space-y-3 pt-2">
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                            {group.groupLabel}
                                        </h4>
                                        <div className="flex flex-col gap-3">
                                            {group.children.map((child, cIdx) => (
                                                <button
                                                    key={cIdx}
                                                    onClick={() => {
                                                        onClose();
                                                        router.push(child.redirectTo);
                                                    }}
                                                    className="group flex flex-col gap-1 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-500 hover:shadow-md transition-all cursor-pointer text-left"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-gray-800 group-hover:text-blue-600">
                                                            {child.label}
                                                        </span>
                                                        <span className="text-gray-400 group-hover:text-blue-600 text-sm">
                                                            →
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
