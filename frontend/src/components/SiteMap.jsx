'use client'

import { useRouter } from "next/navigation";
import Header from "./Header";
import { useContext, useEffect, useState } from "react";
import { loginContext } from "./hooks/LoginContext";
import { isSuperAdmin } from "@/app/lib/auth";

export default function SiteMap() {
    const router = useRouter();
    const { isLogin, can, impersonating, permissions, authReady } = useContext(loginContext);
    const [superAdmin, setSuperAdmin] = useState(false);

    useEffect(() => {
        const activeUser = impersonating || isLogin;
        setSuperAdmin(isSuperAdmin(activeUser));
    }, [isLogin, impersonating, permissions]);

    if (!authReady) {
        return (
            <main className="min-h-screen">
                <Header page="sitemap" />
                <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
                    Loading...
                </div>
            </main>
        );
    }

    const rawSections = [
        {
            title: "Dashboards",
            items: [
                { label: "Sitemap", redirectTo: "/", show: true },
            ],
        },
        {
            title: "Item Management",
            items: [
                { label: "Item Category", redirectTo: "/item-category-list", show: permissions.includes("itemCategoryList") || superAdmin },
                { label: "Manufacturer", redirectTo: "/manufacturer-list", show: permissions.includes("manufacturerList") || superAdmin },
                { label: "Brand", redirectTo: "/brand-list", show: permissions.includes("brandList") || superAdmin },
                { label: "Item", redirectTo: "/item-list", show: permissions.includes("itemList") || superAdmin },

            ],
        },
        {
            title: "Users",
            items: [
                { label: "Users", redirectTo: "/users", show: permissions.includes("userList") || superAdmin },
                { label: "Roles", redirectTo: "/roles", show: permissions.includes("groupList") || superAdmin },
                { label: "Customers", redirectTo: "/customer-list", show: permissions.includes("customerList") },
            ],
        },
        {
            title: "Companies",
            items: [
                { label: "Companies", redirectTo: "/company-list", show: permissions.includes("companyList") || superAdmin },
            ],
        },
        {
            title: "Currencies",
            items: [
                { label: "Currencies", redirectTo: "/currency-list", show: permissions.includes("currencyList") || superAdmin },
            ],
        },
        {
            title: "Item Unit",
            items: [
                { label: "Item UOM", redirectTo: "/uom-list", show: permissions.includes("uomList") },
                { label: "Package Type", redirectTo: "/package-list", show: permissions.includes("packageList") },
            ],
        },
        {
            title: "Item Management",
            items: [
                { label: "Bank", redirectTo: "/bank-list", show: permissions.includes("bankList") || superAdmin },
                { label: "Bank Book", redirectTo: "/bank-book-list", show: permissions.includes("bankBookList") || superAdmin },
            ]
        },

        {
            title: "Master",
            items: [
                { label: "Terms & Conditions", redirectTo: "/terms-conditions-list", show: permissions.includes("termsConditionsList") || superAdmin },
                { label: "Tax Group", redirectTo: "/tax-group-list", show: permissions.includes("taxGroupList") || superAdmin },

            ],
        },
        {
            title: "Sales",
            items: [
                { label: "Payment Transaction", redirectTo: "/payment-transaction-list", show: permissions.includes("paymentTransactionList") || superAdmin },
                { label: "Quotation", redirectTo: "/quotation-list", show: permissions.includes("quotationList") || superAdmin },
                { label: "Order", redirectTo: "/order-list", show: permissions.includes("orderList") || superAdmin },

            ],
        },
    ];

    const dashboardSections = rawSections.filter((s) => s.items.some((i) => i.show));

    const NUM_COLS = 4;
    const columns = Array.from({ length: NUM_COLS }, () => []);
    const colHeights = Array(NUM_COLS).fill(0);

    dashboardSections.forEach((section) => {
        const itemWeight = section.items.filter((i) => i.show).length + 2;
        let minColIdx = 0;
        for (let i = 1; i < NUM_COLS; i++) {
            if (colHeights[i] < colHeights[minColIdx]) {
                minColIdx = i;
            }
        }
        columns[minColIdx].push(section);
        colHeights[minColIdx] += itemWeight;
    });

    const gotoPage = (e, item) => {
        router.push(item);
    };

    const gotoPages = (e, url) => {
        e.preventDefault();
        e.stopPropagation();
    };

    return (

        <main className="min-h-screen">
            <Header
                page="user-details"
                pageProps={{
                    breadcrumbs: [
                        { label: "Home", onClick: (e) => gotoPages(e, "/") },
                    ]
                }}
            />
            <section className="px-6 py-8">
                <h2 className="mb-8 text-4xl font-bold text-gray-800">
                    Welcome { }
                </h2>

                <img src="https://loading.io/asset/814523" alt="" />

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
                    {columns.map((colSections, colIdx) => (
                        <div key={colIdx} className="flex flex-col gap-6">
                            {colSections.map((section, sectionIdx) => (
                                <div
                                    key={sectionIdx}
                                    className="rounded-xl border border-gray-200 bg-white shadow-sm"
                                >
                                    <div className="border-b px-6 py-4">
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {section.title}
                                        </h3>
                                    </div>

                                    <ul className="space-y-3 px-6 py-3">
                                        {section.items.filter((i) => i.show).map((item, itemIndex) => (
                                            <li
                                                key={itemIndex}
                                                className="flex items-center text-gray-600 hover:text-black cursor-pointer transition"
                                                onClick={(e) => { gotoPage(e, item.redirectTo) }}
                                            >
                                                <span className="mr-3 text-xs">•</span>
                                                {item.label}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </section>

        </main>
    );
}