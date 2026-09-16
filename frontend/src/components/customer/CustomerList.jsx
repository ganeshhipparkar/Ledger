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
import { getCustomerColumns, CustomerStatusBadge } from "./CustomerColumn";
import CustomerSidePanel from "./CustomerSidePanel";
import CustomerCard from "./CustomerCard";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import { createPortal } from "react-dom";
import { Plus, MoreVertical, ChevronDown } from "lucide-react";
import { formatDisplayDate } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function CustomerListRow({ customer: c, can, onCustomerClick, expandedRows, toggleRow }) {
    const handleView = () => {
        if (can?.("customerView")) {
            onCustomerClick?.(c.customerId);
        }
    };

    const rowId = c.customerId;
    const isOpen = !!expandedRows[rowId];

    return (
        <div className="bg-white hover:bg-gray-50 rounded-xl border border-gray-100 shadow-sm transition group flex flex-col p-4">
            <div className="flex items-center justify-between ">
                <div className="flex items-center gap-6 flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Customer Name</div>

                        <div
                            className={`w-64 shrink-0 font-semibold text-[15px] truncate ${can?.("customerView") !== false ? "cursor-pointer text-blue-600 hover:underline" : "text-gray-800"}`}
                            onClick={handleView}
                            title={c.customerName || c.customerCode || "—"}
                        >
                            {c.customerName || c.customerCode || "—"}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Customer Code</div>
                        <div className="w-40 shrink-0 font-mono text-sm text-gray-500 font-medium">
                            {c.customerCode || "—"}
                        </div>
                    </div>

                    <div>
                        <div className="text-sm text-gray-500 mb-1">Company Name</div>
                        <div className="w-48 shrink-0 text-sm text-gray-700 truncate">
                            <LinkedCompanyCell companyId={c.companyId} companyName={c.companyName || c.company?.companyName} />
                        </div>
                    </div>

                    <div>
                        <div className="text-sm text-gray-500 mb-1">Customer Code</div>
                        <div className="w-32 shrink-0">
                            <CustomerStatusBadge status={c.status} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                    <button
                        type="button"
                        onClick={() => toggleRow(rowId)}
                        aria-label={isOpen ? "Collapse" : "Expand"}
                        className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                        <ChevronDown
                            className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Email</div>
                        <div className="text-base text-gray-800 break-all">{c.customerEmail || "—"}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Phone</div>
                        <div className="text-base text-gray-800 break-all">{c.phone ? `${c.dialCode || ""} ${c.phone}`.trim() : "—"}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500 mb-1">Added Date</div>
                        <div className="text-base text-gray-800">{formatDisplayDate(c.createdDate) || "—"}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CustomerList() {
    const router = useRouter();
    const { can, viewModes, setViewModeForPage } = useContext(loginContext);

    const activeView = viewModes?.["customer-list"] || "table";
    const setViewMode = (mode) => setViewModeForPage("customer-list", mode);

    const [expandedRows, setExpandedRows] = useState({});
    const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [limit, setLimit] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentFilters, setCurrentFilters] = useState({});

    const [viewId, setViewId] = useState(null);

    const [formPanelOpen, setFormPanelOpen] = useState(false);
    const [formContext, setFormContext] = useState("customer-add");
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
                    endpoint: "customer-list",
                    module: "customer",
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
            setCustomers(data?.data ?? []);
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
        router.push("/add-customer");
    };

    const openEdit = (id) => {
        router.push(`/customer/${id}?edit=true`);
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-[#f5f6fa] overflow-hidden">
            <Header page="customers" onSearch={handleSearch} onAddClick={openAdd} viewMode={activeView} onViewModeChange={setViewMode} />

            <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col min-h-0 overflow-hidden">
                <nav className="mb-4 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span
                        className="cursor-pointer hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/")}
                    >
                        Home
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Customers</span>
                </nav>

                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {loading && (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
                            <Loader label="Loading customers..." />
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center justify-center py-20 text-red-500 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {!loading && !error && (
                        <>
                            {activeView === "table" && (
                                <DataTable
                                    title="Customers"
                                    columns={getCustomerColumns(
                                        (id) => setViewId(id),
                                        openEdit,
                                        router
                                    )}
                                    data={customers}
                                    filterableColumns={[
                                        { id: "customerName", label: "Customer Name", filterKey: "customerName" },
                                        { id: "customerCode", label: "Code", filterKey: "customerCode" },
                                        { id: "companyName", label: "Company", filterKey: "companyName" },
                                        { id: "customerEmail", label: "Email", filterKey: "customerEmail" },
                                        { id: "phone", label: "Phone", filterKey: "phone" },
                                        { id: "status", label: "Status", filterKey: "status" },
                                    ]}
                                    onColumnFilterChange={handleSearch}
                                    loading={loading}
                                    emptyMessage="No customers found."
                                    containerClassName="flex-1 overflow-y-auto"
                                />
                            )}
                            {activeView === "list" && (
                                <div className="flex-1 overflow-y-auto">
                                    <div className="w-full bg-white rounded-2xl border border-gray-200 grid grid-cols-1 gap-5 p-4 mb-12">
                                        {customers.length === 0 ? (
                                            <div className="py-20 text-center text-gray-500 font-medium">No customers found.</div>
                                        ) : (
                                            customers.map((c) => (
                                                <CustomerListRow
                                                    key={c.customerId}
                                                    customer={c}
                                                    can={can}
                                                    onCustomerClick={(id) => setViewId(id)}
                                                    expandedRows={expandedRows}
                                                    toggleRow={toggleRow}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                            {activeView === "grid" && (
                                <div className="flex-1 overflow-y-auto">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 pb-12">
                                        {customers.length === 0 ? (
                                            <div className="col-span-full py-20 text-center text-gray-500 font-medium">No customers found.</div>
                                        ) : (
                                            customers.map((c) => (
                                                <CustomerCard
                                                    key={c.customerId}
                                                    customer={c}
                                                    can={can}
                                                    onCustomerClick={(id) => setViewId(id)}
                                                    onEdit={openEdit}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

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

            {viewId &&
                typeof document !== "undefined" &&
                createPortal(
                    <CustomerSidePanel
                        customerId={viewId}
                        onClose={() => setViewId(null)}
                    />,
                    document.body
                )}
        </div>
    );
}
