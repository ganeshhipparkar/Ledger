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
import ImagePreviewModal from "../ui/ImagePreviewModal";
import { ChevronDown } from "lucide-react";
import { DataTable } from "../data-table";
import { getCompanyColumns } from "./CompanyColumn";
import CompanySidePanel from "./CompanySidePanel";
import { createPortal } from "react-dom";

function getInitials(name) {
    if (!name) return "?";
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function statusBadgeClass(status) {
    return status === "active"
        ? "inline-block rounded-full bg-green-100 px-3 py-1 text-xs text-green-700"
        : status === "inactive"
            ? "inline-block rounded-full bg-red-100 px-3 py-1 text-xs text-red-700"
            : "inline-block rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700";
}

function formatStatus(status) {
    if (!status) return "Unknown";
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function CompanyAvatar({ company, sizeClass = "h-10 w-10" }) {
    const [imgPreview, setImgPreview] = useState(false);
    const imageUrl = company.companyFile
        ? `http://localhost:4000/upload/company/${company.companyId}/${company.companyFile}`
        : "";

    return (
        <>
            {company.companyFile ? (
                <img
                    src={imageUrl}
                    alt="logo"
                    className={`${sizeClass} rounded-full object-cover cursor-pointer`}
                    onClick={() => setImgPreview(true)}
                    onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                    }}
                />
            ) : (
                <span className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-sm`}>
                    {getInitials(company.companyName)}
                </span>
            )}
            <ImagePreviewModal
                open={imgPreview}
                onClose={() => setImgPreview(false)}
                imageUrl={imageUrl}
            />
        </>
    );
}

export default function CompanyList() {
    const router = useRouter();
    const { isLogin, can } = useContext(loginContext);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [limit, setLimit] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentFilters, setCurrentFilters] = useState({});
    const { viewModes, setViewModeForPage } = useContext(loginContext);
    const viewMode = viewModes?.companies || "grid";
    const setViewMode = (mode) => setViewModeForPage("companies", mode);
    const [expandedRows, setExpandedRows] = useState({});
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);

    const toggleRow = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

    useEffect(() => { fetchData(1, {}); }, []);

    async function fetchData(page = currentPage, searchParams = currentFilters, limitOverride = limit) {
        setLoading(true);
        setError("");
        try {
            let body = { page, limit: limitOverride };
            if (searchParams?.filters?.length > 0) {
                body.condition = searchParams.condition || "All";
                body.filters = searchParams.filters;
            }
            const response = await fetch("/relayapi", {
                method: "POST",
                headers: { ...authHeaders(), endpoint: "company-list", module: "company", service: "company" },
                body: JSON.stringify(body),
            });
            if (response.status === 401 || response.status === 403) {
                toast.error("You don't have permission to view this list", { position: "top-right" });
                setError("Access denied.");
                return;
            }
            const payload = await response.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setCompanies(data?.data ?? []);
            setTotalPages(Math.ceil((data?.total || 1) / limitOverride));
            setTotalRecords(data?.total || 0);
        } catch (err) {
            toast.error(`${err}`, { position: "top-right" });
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleSearch = (searchParams) => { setCurrentPage(1); setCurrentFilters(searchParams); fetchData(1, searchParams); };
    const handleLimitChange = (newLimit) => { setLimit(newLimit); setCurrentPage(1); fetchData(1, currentFilters, newLimit); };
    const goToPage = (page) => { if (page < 1 || page > totalPages) return; setCurrentPage(page); fetchData(page, currentFilters); };
    const gotoPages = (e, url) => { e.preventDefault(); e.stopPropagation(); router.push(`http://localhost:3000${url}`); };
    const gotoCompany = (e, company) => { e.preventDefault(); e.stopPropagation(); if (can("companyView")) setSelectedCompanyId(company.companyId); };

    return (
        <div className="fixed inset-0 flex flex-col bg-[#f5f6fa] overflow-hidden">
            <Header page="companies" onSearch={handleSearch} viewMode={viewMode} onViewModeChange={setViewMode} onAddClick={() => router.push("/add-company")} />

            <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col min-h-0 overflow-hidden">
                <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={(e) => gotoPages(e, "/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Companies</span>
                </nav>

                {viewMode !== "table" && (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                        <h1 className="text-2xl font-semibold text-gray-800">Companies</h1>
                    </div>
                )}

                <div className={viewMode === "table" ? "flex-1 min-h-0 flex flex-col overflow-hidden" : "flex-1 min-h-0 overflow-y-auto pb-6"}>
                    {loading && (
                        <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center">
                            <Loader label="Loading companies..." />
                        </div>
                    )}
                    {error && <div className="bg-white rounded-xl border border-gray-200 p-8 text-red-600 font-semibold">{error}</div>}

                    {/* GRID VIEW */}
                    {!loading && !error && viewMode === "grid" && (
                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                            {companies.map((company, index) => (
                                <div key={company.companyId || index} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="flex h-16 w-16 min-w-[64px] items-center justify-center overflow-hidden rounded-full bg-blue-50 shadow-sm">
                                            <CompanyAvatar company={company} sizeClass="h-16 w-16" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div
                                                className={`font-semibold text-lg truncate ${can("companyView") ? "cursor-pointer hover:underline text-[#3563e9]" : "text-gray-800"}`}
                                                onClick={(e) => gotoCompany(e, company)}
                                            >
                                                {company.companyName}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-0.5">{company.companyCode || "-"}</p>
                                            <span className={`mt-2 ${statusBadgeClass(company.status)}`}>{formatStatus(company.status)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                                        <div className="flex gap-1"><span className="font-medium min-w-[60px]">Email:</span><span className="break-all">{company.email || "-"}</span></div>
                                        <div className="flex gap-1"><span className="font-medium min-w-[60px]">Phone:</span><span>{company.dialCode ? `+${company.dialCode} ` : ""}{company.phone || "-"}</span></div>
                                        <div className="flex gap-1"><span className="font-medium min-w-[60px]">Website:</span>
                                            {company.website
                                                ? <a href={company.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">{company.website}</a>
                                                : <span>-</span>}
                                        </div>
                                        <div className="flex gap-1"><span className="font-medium min-w-[60px]">Location:</span><span>{company.city || "-"}</span></div>
                                        <div className="border-t border-gray-100 pt-2 mt-2">
                                            <p className="text-xs text-gray-400 mb-1">Owner</p>
                                            <div className="flex gap-1"><span className="font-medium min-w-[60px]">Name:</span><span>{company.ownerName || "-"}</span></div>
                                            <div className="flex gap-1"><span className="font-medium min-w-[60px]">Phone:</span><span>{company.ownerPhone || "-"}</span></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {companies.length === 0 && (
                                <div className="col-span-full text-center text-gray-400 py-20 bg-white rounded-xl border border-gray-200">No companies found.</div>
                            )}
                        </div>
                    )}

                    {/* LIST VIEW */}
                    {!loading && !error && viewMode === "list" && (
                        <div className="w-full bg-white rounded-2xl border border-gray-200 grid grid-cols-1 gap-5 p-4">
                            {companies.map((company, index) => {
                                const rowId = company.companyId || index;
                                const isOpen = !!expandedRows[rowId];

                                return (
                                    <div
                                        key={rowId}
                                        className="px-6 py-6 border border-gray-200 bg-gray-50/2 rounded-xl"
                                    >
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                                            {/* Company (similar to Name block) */}
                                            <div className="min-w-0">
                                                <div className="text-sm text-gray-500 mb-1">Company</div>
                                                <div className="flex items-center gap-3">
                                                    <CompanyAvatar company={company} sizeClass="h-10 w-10" />
                                                    <div className="min-w-0">
                                                        <div
                                                            className={`text-base font-semibold truncate ${can("companyView")
                                                                ? "cursor-pointer hover:underline text-[#3563e9]"
                                                                : "text-gray-800"
                                                                }`}
                                                            onClick={(e) => can("companyView") && gotoCompany(e, company)}
                                                        >
                                                            {company.companyName}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {company.companyCode || "-"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Email */}
                                            <div>
                                                <div className="text-sm text-gray-500 mb-1">Email</div>
                                                <div className="text-base text-gray-800 break-all">
                                                    {company.email || "-"}
                                                </div>
                                            </div>

                                            {/* Phone */}
                                            <div>
                                                <div className="text-sm text-gray-500 mb-1">Phone</div>
                                                <div className="text-base text-gray-800 break-all">
                                                    {company.dialCode ? `+${company.dialCode} ` : "+0 "}
                                                    {company.phone || "-"}
                                                </div>
                                            </div>

                                            {/* Status + Chevron (aligned like user list) */}
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Status</div>
                                                    <span className={statusBadgeClass(company.status)}>
                                                        {formatStatus(company.status)}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRow(rowId)}
                                                    aria-label={isOpen ? "Collapse" : "Expand"}
                                                    className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                                >
                                                    <ChevronDown
                                                        className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""
                                                            }`}
                                                    />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded row */}
                                        {isOpen && (
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 pt-4 border-gray-100">
                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Website</div>
                                                    {company.website ? (
                                                        <a
                                                            href={company.website}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-base text-[#3563e9] hover:underline break-all"
                                                        >
                                                            {company.website}
                                                        </a>
                                                    ) : (
                                                        <div className="text-base text-gray-800">-</div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Location</div>
                                                    <div className="text-base text-gray-800">
                                                        {company.city || "-"}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Owner Name</div>
                                                    <div className="text-base text-gray-800">
                                                        {company.ownerName || "-"}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-sm text-gray-500 mb-1">Owner Phone</div>
                                                    <div className="text-base text-gray-800">
                                                        {company.ownerDialCode
                                                            ? `+${company.ownerDialCode} `
                                                            : company.ownerPhone
                                                                ? "+0 "
                                                                : ""}
                                                        {company.ownerPhone || "-"}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {companies.length === 0 && (
                                <div className="text-center text-gray-400 py-16">
                                    No companies found.
                                </div>
                            )}
                        </div>
                    )}

                    {/* TABLE VIEW */}
                    {!error && viewMode === "table" && (
                        <DataTable
                            title="Companies"
                            columns={getCompanyColumns((companyId) => setSelectedCompanyId(companyId))}
                            data={companies}
                            filterableColumns={[
                                { id: "companyName", label: "Company", filterKey: "companyName" },
                                { id: "companyCode", label: "Code", filterKey: "companyCode" },
                                { id: "email", label: "Email", filterKey: "email" },
                                { id: "phone", label: "Phone", filterKey: "phone" },
                                { id: "companyLocation", label: "Location", filterKey: "city" },
                                { id: "status", label: "Status", filterKey: "status" },
                            ]}
                            onColumnFilterChange={handleSearch}
                            loading={loading}
                            emptyMessage="No companies found."
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
                    <select value={limit} onChange={(e) => handleLimitChange(Number(e.target.value))}
                        className="h-9 rounded-lg border border-blue-500 bg-white px-3 text-sm text-gray-700 outline-none cursor-pointer">
                        <option value={5}>5</option>
                        <option value={8}>8</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                    </select>
                </div>
            </div>
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
        </div>
    );
}