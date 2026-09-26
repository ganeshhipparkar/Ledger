"use client";
import Link from "next/link";

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
import { Plus } from "lucide-react";

const LIMIT = 10;

function GroupNameCell({ row }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const group = row.original;
    const isClickable = can ? (can("groupUpdate") || can("groupView")) : true;

    return (
        <span
            className={`font-semibold ${
                isClickable
                    ? "text-blue-600 cursor-pointer hover:underline"
                    : "text-gray-800"
            }`}
            onClick={(e) => {
                if (!isClickable) return;
                e.stopPropagation();
                router.push(`/roles/${group.groupId}`);
            }}
        >
            {group.groupName ? group.groupName.replace(/([A-Z])/g, " $1").trim() : "-"}
        </span>
    );
}

const roleColumns = [
    {
        accessorKey: "groupName",
        header: "Group Name",
        cell: ({ row }) => <GroupNameCell row={row} />,
        filterFn: "includesString",
    },
    {
        accessorKey: "groupCode",
        header: "Group Code",
        cell: ({ row }) => <span>{row.getValue("groupCode") || "-"}</span>,
        filterFn: "includesString",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") || "inactive";
            const formatted = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            const cls =
                formatted === "Active"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700";
            return (
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${cls}`}>
                    {formatted}
                </span>
            );
        },
        filterFn: "includesString",
    },
];

export default function RolesList() {
    const router = useRouter();
    const { can } = useContext(loginContext);

    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [limit, setLimit] = useState(LIMIT);
    const [currentFilters, setCurrentFilters] = useState({});

    useEffect(() => {
        fetchData(1, {});
    }, []);

    async function fetchData(page = currentPage, searchParams = currentFilters, limitOverride = limit) {
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
                    endpoint: "group-list",
                    module: "group",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (response.status === 401 || response.status === 403) {
                toast.error("You don't have permission to view this list", { position: "top-right" });
                setError("Access denied.");
                return;
            }

            const payload = await response.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setGroups(data?.data ?? []);
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

    const columnsWithAction = [
        ...roleColumns,
        {
            id: "action",
            header: "Action",
            cell: ({ row }) => {
                const group = row.original;
                return can("groupUpdate") ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/roles/${group.groupId}`); }}
                        className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
                    >
                        Manage
                    </button>
                ) : null;
            },
        },
    ];

    return (
        <div className="fixed inset-0 flex flex-col bg-[#f5f6fa] overflow-hidden">
            <Header page="roles" onSearch={handleSearch} />

            <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col min-h-0 overflow-hidden">
                <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600 hover:underline">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Roles</span>
                </nav>

                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {loading && (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
                            <Loader label="Loading roles..." />
                        </div>
                    )}

                    {error && (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 text-red-600 font-semibold">
                            {error}
                        </div>
                    )}

                    {!loading && !error && (
                        <DataTable
                            title="Roles"
                            actions={
                                can && can("groupAdd") ? (
                                    <button
                                        id="add-role-btn"
                                        onClick={() => router.push("/roles/add")}
                                        className="w-full lg:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-sm cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Role
                                    </button>
                                ) : null
                            }
                            columns={columnsWithAction}
                            data={groups}
                            filterableColumns={[
                                { id: "groupName", label: "Group Name", filterKey: "groupName" },
                                { id: "groupCode", label: "Group Code", filterKey: "groupCode" },
                                { id: "status", label: "Status", filterKey: "status" },
                            ]}
                            onColumnFilterChange={handleSearch}
                            loading={loading}
                            emptyMessage="No roles found."
                            containerClassName="flex-1 overflow-y-auto"
                        />
                    )}
                </div>
            </div>

            <div className="w-full flex items-center justify-between bg-white border-t border-gray-200 px-6 py-3 z-30">
                <div className="text-sm font-medium text-gray-800">
                    {totalRecords > 0
                        ? `View ${(currentPage - 1) * limit + 1} - ${Math.min(currentPage * limit, totalRecords)} of ${totalRecords}`
                        : "View 0 of 0"}
                </div>
                <div className="flex items-center gap-3">
                    <AppPagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
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
        </div>
    );
}
