"use client";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import Header from "../Header";
import { userListContext } from "../hooks/UserListContext";
import AppPagination from "../ui/AppPagination";
import Loader from "../ui/Loader";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import { toast } from "react-toastify";
import { DataTable } from "../data-table";
import { columns, getColumns } from "../Column";
import { loginContext } from "../hooks/LoginContext";
import { isSuperAdmin, isCompanyAdmin, authHeaders } from "../../app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { ChevronDown, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import CompanySidePanel from "../company/CompanySidePanel";
import UserSidePanel from "./UserSidePanel";
import { createPortal } from "react-dom";
function getInitials(name) {
    if (!name) return "?";
    const parts = name.split(" ");
    const initials = parts.map(p => p[0] || "").join("");
    return initials.substring(0, 2).toUpperCase();
}
function formatRoles(assignments) {
    if (!Array.isArray(assignments) || assignments.length === 0) return "N/A";
    return [...new Set(assignments.map((a) => a.groupName).filter(Boolean))]
        .map((n) => n.replace(/([A-Z])/g, " $1").trim())
        .join(", ");
}

function formatCompanies(assignments, onCompanyClick) {
    if (!Array.isArray(assignments) || assignments.length === 0) return <span>-</span>;
    const unique = [...new Map(assignments.filter(a => a.companyName).map(a => [a.companyId, a])).values()];
    return unique.map((a, i) => (
        <span key={a.companyId}>
            <span
                className="text-blue-600 cursor-pointer hover:underline"
                onClick={(e) => { e.stopPropagation(); onCompanyClick(a.companyId); }}
            >
                {a.companyName}
            </span>
            {i < unique.length - 1 && ", "}
        </span>
    ));
}

export default function UsersPage() {
    const router = useRouter();
    const { users, setUsers, savedPage, setSavedPage, savedTotalPages, setSavedTotalPages } = useContext(userListContext);
    const { isLogin, displayUser } = useContext(loginContext);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchValue, setSearchValue] = useState("");
    const [limit, setLimit] = useState(8);
    const [currentPage, setCurrentPage] = useState(savedPage);
    const [totalPages, setTotalPages] = useState(savedTotalPages);
    const [totalRecords, setTotalRecords] = useState(0);
    const { viewModes, setViewModeForPage } = useContext(loginContext);
    const viewMode = viewModes?.users || "grid";
    const setViewMode = (mode) => setViewModeForPage("users", mode);
    const [count, setCount] = useState(1);
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);

    const [superAdmin, setSuperAdmin] = useState(false);
    const [companyAdmin, setCompanyAdmin] = useState(false);

    useEffect(() => {
        setSuperAdmin(isSuperAdmin(displayUser));
        setCompanyAdmin(isCompanyAdmin(displayUser));
    }, [displayUser]);

    const [expandedRows, setExpandedRows] = useState({});
    const [previewUser, setPreviewUser] = useState(null);
    const [openActionMenu, setOpenActionMenu] = useState(null);

    useEffect(() => {
        const closeMenu = (e) => {
            if (!e.target.closest(".user-action-menu")) {
                setOpenActionMenu(null);
            }
        };
        document.addEventListener("mousedown", closeMenu);
        return () => document.removeEventListener("mousedown", closeMenu);
    }, []);

    const toggleRow = (id) => {
        setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    useEffect(() => {
        fetchData(savedPage, {});
    }, []);

    async function fetchData(page = currentPage, searchParams = {}, limitOverride = limit) {
        // setLoading(true);
        setError("");
        try {
            let body = { page, limit: limitOverride };

            if (searchParams.filters && searchParams.filters.length > 0) {
                body.condition = searchParams.condition || "All";
                body.filters = searchParams.filters;
            }

            const response = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "user-list",
                    module: "user"
                },
                body: JSON.stringify(body),
            });

            if (response.status === 401 || response.status === 403) {
                router.push("/forbidden");
                return;
            }

            if (!response.ok) {
                toast.error("Failed to fetch users", { position: "top-right" });
            }
            const payload = await response.json();


            const data = payload.encrypted
                ? decryptResponse(payload.encrypted)
                : payload;

            setUsers(
                Array.isArray(data)
                    ? data
                    : (data.data ?? []).map((user) => ({
                        user_userId: user.userId,
                        user_name: user.name,
                        user_fName: user.firstName,
                        user_sName: user.surname,
                        user_email: user.email,
                        user_dialCode: user.dialCode,
                        user_phone: user.phone,
                        user_status: user.status,
                        user_userFile: user.userFile,
                        user_age: user.age,
                        assignments: Array.isArray(user.assignments) ? user.assignments : [],
                    }))
            );
            setTotalPages(Math.ceil((data?.total || 1) / limitOverride));
            setTotalRecords(data?.total || 0);
            setSavedPage(page);
            setSavedTotalPages(Math.ceil((data?.total || 1) / limitOverride));
        } catch (err) {
            toast.error(`${err}`, { position: "top-right" });
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleSearch = (searchParams) => {
        fetchData(1, searchParams);
    };

    const gotoUser = (e, user) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedUserId(user.user_userId);
    };

    const route = useRouter();

    const gotoPages = (e, url) => {
        e.preventDefault();
        e.stopPropagation();
        route.push(`http://localhost:3000${url}`);
    };

    const goToPage = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        setSavedPage(page);
        fetchData(page);
    };

    const handleLimitChange = (newLimit) => {
        setLimit(newLimit);
        setCurrentPage(1);
        fetchData(1, {}, newLimit);
    };
    const { impersonating, loginAs, stopImpersonating, can } = useContext(loginContext);

    const handleLoginAs = async (e, user) => {
        e.stopPropagation();
        if (user.user_status === "Inactive") {
            toast.error("Cannot log in as an inactive user", { position: "top-right" });
            return;
        }
        const success = await loginAs(user.user_userId);
        if (success) {
            toast.success(`Now acting as ${user.user_name}`, { position: "top-right" });
            window.location.href = "/";
        } else {
            toast.error("Failed to switch user", { position: "top-right" });
        }
    };
    const handleResetPassword = (e, user) => {
        e.stopPropagation();
        setOpenActionMenu(null);
        router.push(`/admin-reset-pass?userId=${user.user_userId}`);
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-[#f5f6fa] overflow-hidden">
            <Header onSearch={handleSearch} page="users" viewMode={viewMode} onViewModeChange={setViewMode} onAddClick={() => router.push("/add-user")} />

            <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col min-h-0 overflow-hidden">
                <nav
                    className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500"
                    aria-label="Breadcrumb"
                >
                    <span
                        className="cursor-pointer transition-colors hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/")}
                    >
                        Home
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800" onClick={(e) => gotoPages(e, "/users")}>
                        Users
                    </span>
                </nav>

                {viewMode !== "table" && (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                        <h1 className="text-2xl font-semibold text-[#1f2937]">
                            {superAdmin ? "All Users" : companyAdmin ? "Company Users" : "Users"}
                        </h1>
                    </div>
                )}

                <div className={viewMode === "table" ? "flex-1 min-h-0 flex flex-col overflow-hidden" : "flex-1 min-h-0 overflow-y-auto pb-6"}>
                    {loading && (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
                            <Loader label="Loading users..." />
                        </div>
                    )}

                    {error && (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 text-red-600 font-semibold">
                            {error}
                        </div>
                    )}

                    {!loading && !error && viewMode === "grid" && (
                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                            {users?.map((user, index) => (
                                <div
                                    key={user.user_userId || index}
                                    className="relative bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition"
                                >
                                    {can("userUpdate") && (
                                        <div className="absolute top-4 right-4 z-10">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <span
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="inline-flex p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                                                        title="Actions"
                                                    >
                                                        <MoreVertical className="h-5 w-5" />
                                                    </span>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg rounded-xl">
                                                    <DropdownMenuItem
                                                        className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/user/${user.user_userId}?tab=summary`);
                                                        }}
                                                    >
                                                        Profile
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/user/${user.user_userId}?tab=profiles`);
                                                        }}
                                                    >
                                                        Other Profiles
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/user/${user.user_userId}?tab=activity`);
                                                        }}
                                                    >
                                                        Activities
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="flex h-20 w-20 min-w-[80px] items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold uppercase text-blue-600 shadow-md">
                                            {user.user_userFile ? (
                                                <img
                                                    src={`http://localhost:4000/upload/user/${user.user_userId}/${user.user_userFile}`}
                                                    alt="userImage"
                                                    className="h-full w-full object-cover cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewUser(user);
                                                    }}
                                                />
                                            ) : (
                                                <span className="text-blue-600">{getInitials(user.user_name)}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div
                                                className={`font-semibold text-lg truncate ${can("userView") ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                                                onClick={(e) => can("userView") && gotoUser(e, user)}
                                            >
                                                {user.user_fName ? user.user_fName + " " + user.user_sName : user.user_name}
                                            </div>
                                            <div className="text-sm text-gray-600 break-all mt-1">
                                                {user.user_name}
                                            </div>

                                            <div
                                                className={
                                                    user.user_status === "Active"
                                                        ? "mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                                                        : user.user_status === "Inactive"
                                                            ? "mt-2 inline-block rounded-full bg-red-100 px-3 py-1 text-sm text-red-700"
                                                            : "mt-2 inline-block rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-700"
                                                }
                                            >
                                                {user.user_status}
                                            </div>
                                            {superAdmin && !impersonating && user.user_userId !== displayUser?.userId && (
                                                <div className="user-action-menu relative mt-2 float-right" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenActionMenu((prev) =>
                                                                prev === user.user_userId ? null : user.user_userId
                                                            );
                                                        }}
                                                        className="flex items-center gap-1 rounded-full border border-blue-500 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 cursor-pointer"
                                                    >
                                                        Login As
                                                        <ChevronDown
                                                            className={`h-4 w-4 transition-transform ${openActionMenu === user.user_userId ? "rotate-180" : ""
                                                                }`}
                                                        />
                                                    </button>

                                                    {openActionMenu === user.user_userId && (
                                                        <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                                                            <button
                                                                onClick={(e) => handleLoginAs(e, user)}
                                                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                                            >
                                                                Login As
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleResetPassword(e, user)}
                                                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                                            >
                                                                Reset Password
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-sm text-gray-600 pt-3 pb-3 border-y border-gray-200 py-1">
                                        <span className="text-[#71717b] text-xs uppercase tracking-wide">
                                            Role
                                        </span>
                                        <p className="font-semibold mt-1 break-words">
                                            {formatRoles(user.assignments)}
                                        </p>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        <div className="text-sm text-gray-600 break-all">
                                            <span className="font-medium">Email:</span>{" "}
                                            {user.user_email}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            <span className="font-medium">Phone:</span>{" "}
                                            {"+"}{user.user_dialCode ? user.user_dialCode : 0}{" "}{user.user_phone || "-"}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            <span className="font-medium">Company:</span>{" "}
                                            {formatCompanies(user.assignments, setSelectedCompanyId)}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {users.length === 0 && (
                                <div className="col-span-full text-center text-gray-400 py-20 bg-white rounded-xl border border-gray-200">
                                    No users found.
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && !error && viewMode === "list" && (
                        <div className="w-full bg-white rounded-2xl border border-gray-200 grid grid-cols-1 gap-5 p-4 mb-12">
                            {users?.map((user, index) => {
                                const rowId = user.user_userId || index;
                                const isOpen = !!expandedRows[rowId];
                                return (
                                    <div key={rowId} className="px-6 py-6 border border-gray-200 bg-gray-50/2 rounded-xl">
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                                            <div className="min-w-0">
                                                <div className="text-sm text-gray-500 mb-1">Name</div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 min-w-[40px] items-center justify-center overflow-hidden rounded-full bg-blue-600 text-base font-bold uppercase text-white">
                                                        {user.user_userFile ? (
                                                            <img
                                                                src={`http://localhost:4000/upload/user/${user.user_userId}/${user.user_userFile}`}
                                                                alt="userImage"
                                                                className="h-full w-full object-cover cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setPreviewUser(user);
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white text-base font-bold uppercase">
                                                                {getInitials(user.user_name)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div
                                                            className={`text-base font-semibold truncate ${can("userView") ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                                                            onClick={(e) => can("userView") && gotoUser(e, user)}
                                                        >
                                                            {user.user_fName ? user.user_fName + " " + user.user_sName : user.user_name}
                                                        </div>
                                                        <div className="text-sm text-gray-500">{"+"}{user.user_dialCode ? user.user_dialCode : 0}{" "}{user.user_phone || "-"}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-sm text-gray-500 mb-1">UserName</div>
                                                <div className="text-base text-gray-800 break-all">{user.user_name}</div>
                                            </div>

                                            <div>
                                                <div className="text-sm text-gray-500 mb-1">Status</div>
                                                <span
                                                    className={
                                                        user.user_status === "Active"
                                                            ? "inline-block rounded-full bg-green-100 px-3 py-1 text-base text-green-700"
                                                            : user.user_status === "Inactive"
                                                                ? "inline-block rounded-full bg-red-100 px-3 py-1 text-base text-red-700"
                                                                : "inline-block rounded-full bg-sky-100 px-3 py-1 text-base text-sky-700"
                                                    }
                                                >
                                                    {user.user_status || "Inactive"}
                                                </span>
                                            </div>

                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Company Name</div>
                                                    <div className="text-base text-[#3563e9] font-medium">
                                                        {formatCompanies(user.assignments, setSelectedCompanyId)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {can("userUpdate") && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <span
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="inline-flex p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                                                                    title="Actions"
                                                                >
                                                                    <MoreVertical className="h-5 w-5" />
                                                                </span>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg rounded-xl">
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        router.push(`/user/${user.user_userId}?tab=summary`);
                                                                    }}
                                                                >
                                                                    Profile
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        router.push(`/user/${user.user_userId}?tab=profiles`);
                                                                    }}
                                                                >
                                                                    Other Profiles
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        router.push(`/user/${user.user_userId}?tab=activity`);
                                                                    }}
                                                                >
                                                                    Activities
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
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
                                        </div>

                                        {isOpen && (
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 pt-4 border-gray-100">
                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Email</div>
                                                    <div className="text-base text-gray-800 break-all">{user.user_email}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Phone</div>
                                                    <div className="text-base text-gray-800 break-all">{"+"}{user.user_dialCode ? user.user_dialCode : 0}{" "}{user.user_phone}</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Group Name</div>
                                                    <div className="text-base text-gray-800">{formatRoles(user.assignments)}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {users.length === 0 && (
                                <div className="text-center text-gray-400 py-16">No users found.</div>
                            )}
                        </div>
                    )}

                    {!error && viewMode === "table" && (
                        <DataTable
                            title={superAdmin ? "All Users" : companyAdmin ? "Company Users" : "Users"}
                            columns={getColumns((userId) => setSelectedUserId(userId), superAdmin)}
                            data={users}
                            filterableColumns={[
                                { id: "user_name", label: "Name", filterKey: "name" },
                                { id: "user_email", label: "Email", filterKey: "email" },
                                { id: "user_phone", label: "Phone", filterKey: "phone" },
                                { id: "user_age", label: "Age", filterKey: "age" },
                                { id: "role", label: "Role", filterKey: "groupName" },
                                { id: "company", label: "Company", filterKey: "companyName" },
                                { id: "user_status", label: "Status", filterKey: "status" },
                            ]}
                            onColumnFilterChange={handleSearch}
                            // loading={loading}
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
                        id="pageSize"
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
            {selectedUserId && typeof document !== "undefined" && createPortal(
                <UserSidePanel
                    userId={selectedUserId}
                    onClose={() => setSelectedUserId(null)}
                    onMoreDetails={(userId) => {
                        setSelectedUserId(null);
                        router.push(`/user/${userId}`);
                    }}
                />,
                document.body
            )}
            {selectedCompanyId && typeof document !== "undefined" && createPortal(
                <CompanySidePanel
                    companyId={selectedCompanyId}
                    onClose={() => setSelectedCompanyId(null)}
                    onMoreDetails={(companyId) => {
                        setSelectedCompanyId(null);
                        router.push(`/company/${companyId}`);
                    }}
                />,
                document.body
            )}
            <ImagePreviewModal
                open={!!previewUser}
                onClose={() => setPreviewUser(null)}
                imageUrl={previewUser ? `http://localhost:4000/upload/user/${previewUser.user_userId}/${previewUser.user_userFile}` : ""}
            />
        </div>
    );
}