"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import AppPagination from "../ui/AppPagination";
import TabFilterPanel from "./TabFilterPanel";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import Loader from "../ui/Loader";

const DEFAULT_PAGE_SIZE = Number(process.env.NEXT_PUBLIC_USERS_LIST_LIMIT) || 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export default function EmbeddedRelatedTable({
    endpoint,
    module,
    fixedFilters,
    invoiceId,
    customerId,
    orderId,
    columns = [],
    renderRow,
    emptyMessage = "No records found.",
    fieldsConfig = [],
    toolbarLeft = null,
    toolbarActions = null,
    sidebarHeight,
    isLg,
    containerStyle: customContainerStyle,
    className,
    refreshKey = 0,
}) {
    const [data, setData] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    const initialFilters = useMemo(() => {
        const obj = {};
        (fieldsConfig || []).forEach((f) => {
            obj[f.id] = "";
        });
        return obj;
    }, [fieldsConfig]);

    const [filterValues, setFilterValues] = useState(initialFilters);
    const [debouncedFilters, setDebouncedFilters] = useState(initialFilters);
    const debounceRef = useRef(null);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const handleFilterChange = (key, value) => {
        setPage(1);
        setFilterValues((prev) => {
            const next = { ...prev, [key]: value };
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                setDebouncedFilters(next);
            }, 400);
            return next;
        });
    };

    const handleReset = () => {
        setPage(1);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const obj = {};
        (fieldsConfig || []).forEach((f) => {
            obj[f.id] = "";
        });
        setFilterValues(obj);
        setDebouncedFilters(obj);
    };

    const handleLimitChange = (e) => {
        const newLimit = Number(e.target.value);
        setLimit(newLimit);
        setPage(1);
    };

    const hasActiveFilters = useMemo(() => {
        return (
            Object.values(filterValues).some((v) => typeof v === "string" && v.trim() !== "") ||
            Object.values(debouncedFilters).some((v) => typeof v === "string" && v.trim() !== "")
        );
    }, [filterValues, debouncedFilters]);

    const fixedFiltersKey = useMemo(() => {
        if (Array.isArray(fixedFilters)) return JSON.stringify(fixedFilters);
        if (invoiceId) return `invoiceId:${invoiceId}`;
        if (customerId) return `customerId:${customerId}`;
        if (orderId) return `orderId:${orderId}`;
        return "";
    }, [fixedFilters, invoiceId, customerId, orderId]);

    useEffect(() => {
        const fetchData = async () => {
            setIsFetching(true);
            try {
                const apiFilters = [];

                if (Array.isArray(fixedFilters)) {
                    apiFilters.push(...fixedFilters);
                } else if (invoiceId) {
                    apiFilters.push({ key: "invoiceId", value: invoiceId, operator: "eq" });
                } else if (customerId) {
                    apiFilters.push({ key: "customerId", value: customerId, operator: "eq" });
                } else if (orderId) {
                    apiFilters.push({ key: "orderId", value: orderId, operator: "eq" });
                }

                for (const key in debouncedFilters) {
                    const val = debouncedFilters[key];
                    if (val && typeof val === "string" && val.trim() !== "") {
                        const fieldDef = (fieldsConfig || []).find((f) => f.id === key);
                        apiFilters.push({
                            key,
                            operator: fieldDef?.operator || (key === "status" ? "eq" : "contains"),
                            value: val.trim(),
                        });
                    }
                }

                const res = await fetch("/relayapi", {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        endpoint,
                        module,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        filters: apiFilters,
                        condition: "All",
                        limit,
                        page,
                    }),
                });
                const payload = await res.json();
                const json = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const records = json.data || [];
                const total = Number(json.total ?? records.length ?? 0);

                if (page > 1 && records.length === 0) {
                    setPage((prev) => Math.max(1, prev - 1));
                    return;
                }

                setData(records);
                setTotalRecords(total);
                setTotalPages(Math.ceil(total / limit) || 1);
            } catch (err) {
                console.error(err);
                setData([]);
                setTotalRecords(0);
                setTotalPages(1);
            } finally {
                setInitialLoading(false);
                setIsFetching(false);
            }
        };

        const hasTarget =
            (Array.isArray(fixedFilters) && fixedFilters.length > 0) ||
            invoiceId ||
            customerId ||
            orderId;

        if (hasTarget) {
            fetchData();
        } else {
            setInitialLoading(false);
        }
    }, [endpoint, module, fixedFiltersKey, debouncedFilters, page, limit, refreshKey]);

    const resolvedContainerStyle = useMemo(() => {
        if (customContainerStyle) return customContainerStyle;
        if (isLg && sidebarHeight) {
            return {
                height: `${sidebarHeight}px`,
                maxHeight: `${sidebarHeight}px`,
            };
        }
        return undefined;
    }, [customContainerStyle, isLg, sidebarHeight]);

    const resolvedClassName = useMemo(() => {
        if (className) return className;
        if (isLg && sidebarHeight) {
            return "w-full rounded-2xl bg-white shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[70vh] lg:h-full max-h-[70vh] lg:max-h-none";
        }
        return "w-full rounded-2xl bg-white shadow-sm border border-gray-100 flex flex-col overflow-hidden h-[70vh] max-h-[70vh] lg:h-[calc(100vh-270px)] lg:max-h-[calc(100vh-270px)] min-h-[420px]";
    }, [className, isLg, sidebarHeight]);

    return (
        <div style={resolvedContainerStyle} className={resolvedClassName}>
            {/* Pinned Toolbar at top */}
            <div className="flex-shrink-0 px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 bg-white">
                <div>{toolbarLeft || null}</div>
                <div className="flex items-center gap-2 ml-auto">
                    {toolbarActions || null}
                    <button
                        type="button"
                        onClick={() => setIsFilterOpen((prev) => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition shadow-sm cursor-pointer ${hasActiveFilters
                            ? "border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-500/20"
                            : isFilterOpen
                                ? "border-blue-400 bg-blue-50 text-blue-600"
                                : "border-gray-200 bg-white text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-gray-50"
                            }`}
                        title="Filters"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="15"
                            height="15"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                        >
                            <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2z" />
                        </svg>
                        <span>Filters</span>
                        {hasActiveFilters && (
                            <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
                        )}
                    </button>
                </div>
            </div>

            {/* Middle: Scrollable table rows or Loading / Empty state */}
            {initialLoading ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center">
                    <Loader label="Loading..." />
                </div>
            ) : data.length === 0 ? (
                hasActiveFilters ? (
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center">
                        <p className="text-gray-700 font-semibold text-base">
                            No results match your filters
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                            Try clearing or adjusting your filters to find what you are looking for.
                        </p>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="mt-4 inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 cursor-pointer transition"
                        >
                            Reset Filters
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center text-gray-500">
                        {emptyMessage}
                    </div>
                )
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative max-h-full">
                    {isFetching && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center transition-opacity">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm border border-gray-200 text-xs font-medium text-gray-600">
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                                <span>Loading...</span>
                            </div>
                        </div>
                    )}
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                {columns.map((c, i) => (
                                    <th key={i} className="px-6 py-4 bg-gray-50">
                                        {c}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {data.map(renderRow)}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pinned Pagination at the bottom */}
            {totalRecords > 0 && (
                <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-3 border-t border-gray-100 bg-white">
                    <p className="text-sm text-gray-500">
                        {`Viewing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalRecords)} of ${totalRecords}`}
                    </p>
                    <div className="flex items-center gap-3">
                        <AppPagination
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={(p) => setPage(p)}
                        />
                        <select
                            value={limit}
                            onChange={handleLimitChange}
                            className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 outline-none focus:border-blue-500 cursor-pointer"
                        >
                            {PAGE_SIZE_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <TabFilterPanel
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                fieldsConfig={fieldsConfig}
                filters={filterValues}
                onChange={handleFilterChange}
                onReset={handleReset}
            />
        </div>
    );
}
