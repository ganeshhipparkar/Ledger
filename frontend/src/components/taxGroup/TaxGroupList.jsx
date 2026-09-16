"use client";

import { decryptResponse } from "@/app/lib/crypto";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { loginContext } from "../hooks/LoginContext";
import Header from "../Header";
import { toast } from "react-toastify";
import { authHeaders } from "@/app/lib/auth";
import AppPagination from "../ui/AppPagination";
import Loader from "../ui/Loader";
import { DataTable } from "../data-table";
import DetailsSidePanel from "../DetailsSidePanel";
import { taxGroupSidePanelConfig } from "./configs/taxGroupSidePanel.config";
import TaxGroupFormSidePanel from "./TaxGroupFormSidePanel";

import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { getTaxGroupColumns } from "./TaxGroupColumn";

export default function TaxGroupList() {
    const router = useRouter();
    const { can } = useContext(loginContext);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [limit, setLimit] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentFilters, setCurrentFilters] = useState({});

    const [viewId, setViewId] = useState(null);

    const [formPanelOpen, setFormPanelOpen] = useState(false);
    const [formContext, setFormContext] = useState("taxGroup-add");
    const [editId, setEditId] = useState(null);

    useEffect(() => {
        fetchData(1, {});
    }, []);

    async function fetchData(
        page = currentPage,
        searchParams = currentFilters,
        limitOverride = limit
    ) {
        setError("");
        try {
            const body = { page, limit: limitOverride };
            if (searchParams?.filters?.length > 0) {
                body.condition = searchParams.condition || "All";
                body.filters = searchParams.filters;
            }
            const response = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "tax-group-list",
                    module: "tax-group",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (response.status === 401 || response.status === 403) {
                toast.error("You don't have permission to view this list", {
                    position: "top-right",
                });
                setError("Access denied.");
                return;
            }

            const payload = await response.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setItems(data?.data ?? []);
            setTotalPages(Math.ceil((data?.total || 1) / limitOverride));
            setTotalRecords(data?.total || 0);
        } catch (err) {
            toast.error(`${err}`, { position: "top-right" });
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleSearch = (searchParams) => {
        setCurrentPage(1);
        setCurrentFilters(searchParams);
        fetchData(1, searchParams);
    };

    const handleLimitChange = (newLimit) => {
        setLimit(newLimit);
        setCurrentPage(1);
        fetchData(1, currentFilters, newLimit);
    };

    const goToPage = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        fetchData(page, currentFilters);
    };

    const gotoPages = (e, url) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(url);
    };

    const openAdd = () => {
        setEditId(null);
        setFormContext("taxGroup-add");
        setFormPanelOpen(true);
    };

    const openEdit = (id) => {
        setEditId(id);
        setFormContext("taxGroup-update");
        setFormPanelOpen(true);
        setViewId(null);
    };

    const handleFormSuccess = () => {
        fetchData(currentPage, currentFilters);
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-[#f5f6fa] overflow-hidden">
            <Header page="tax-groups" onSearch={handleSearch} onAddClick={openAdd} />

            <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col min-h-0 overflow-hidden">

                <nav className="mb-4 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span
                        className="cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/")}
                    >
                        Home
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Tax-Groups</span>
                </nav>

                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {loading && (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
                            <Loader label="Loading tax groups..." />
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center justify-center py-20 text-red-500 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {!loading && !error && (
                        <DataTable
                            title="Tax Group"
                            columns={getTaxGroupColumns(
                                (id) => setViewId(id),
                                openEdit
                            )}
                            data={items}
                            filterableColumns={[
                                { id: "taxName", label: "Tax Name", filterKey: "taxName" },
                                { id: "taxCode", label: "Tax Code", filterKey: "taxCode" },
                                { id: "companyName", label: "Company", filterKey: "companyName" },
                            ]}

                            onColumnFilterChange={handleSearch}
                            loading={loading}
                            emptyMessage="No tax groups found."
                            containerClassName="flex-1 overflow-y-auto"
                        />
                    )}
                </div>
            </div>

            {/* Pagination footer */}
            <div className="w-full flex items-center justify-between bg-white border-t border-gray-200 px-6 py-3 z-30">
                <div className="text-sm font-medium text-gray-800">
                    {totalRecords > 0
                        ? `View ${(currentPage - 1) * limit + 1} - ${Math.min(
                            currentPage * limit,
                            totalRecords
                        )} of ${totalRecords}`
                        : "View 0 of 0"}
                </div>
                <div className="flex items-center gap-3">
                    <AppPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={goToPage}
                    />
                    <select
                        value={limit}
                        onChange={(e) => handleLimitChange(Number(e.target.value))}
                        className="h-9 rounded-lg border border-blue-500 bg-white px-3 text-sm text-gray-700 outline-none cursor-pointer"
                    >
                        <option value={5}>5</option>
                        <option value={8}>8</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            {/* Read-only view side panel */}
            {viewId &&
                typeof document !== "undefined" &&
                createPortal(
                    <DetailsSidePanel
                        config={taxGroupSidePanelConfig}
                        id={viewId}
                        onClose={() => setViewId(null)}
                    />,
                    document.body
                )}


            {/* Add / Edit form side panel */}
            {typeof document !== "undefined" &&
                createPortal(
                    <TaxGroupFormSidePanel
                        isOpen={formPanelOpen}
                        onClose={() => setFormPanelOpen(false)}
                        context={formContext}
                        id={editId}
                        onSuccess={handleFormSuccess}
                    />,
                    document.body
                )}
        </div>
    );
}
