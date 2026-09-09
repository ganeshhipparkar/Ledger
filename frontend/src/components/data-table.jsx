"use client";

import * as React from "react";
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    useReactTable,
} from "@tanstack/react-table";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Loader from "./ui/Loader";

export function DataTable({
    columns,
    data,
    filterableColumns = [
        { id: "user_name", label: "Name", filterKey: "name" },
        { id: "user_email", label: "Email", filterKey: "email" },
        { id: "user_phone", label: "Phone", filterKey: "phone" },
        { id: "user_age", label: "Age", filterKey: "age" },
        { id: "role", label: "Role", filterKey: "groupName" },
        { id: "company", label: "Company", filterKey: "companyName" },
        { id: "user_status", label: "Status", filterKey: "status" },
    ],
    emptyMessage = "No results found.",
    onRowClick,
    title,
    actions,
    containerClassName = "max-h-[650px] overflow-y-auto",
    onColumnFilterChange,
    loading = false,
}) {
    const [sorting, setSorting] = React.useState([]);
    const [showFilters, setShowFilters] = React.useState(false);
    const [filterValues, setFilterValues] = React.useState({});
    const isFirstRender = React.useRef(true);

    const table = useReactTable({
        data: data || [],
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const setFilter = (colId, value) => {
        setFilterValues((prev) => {
            const next = { ...prev, [colId]: value };
            if (!value) delete next[colId];
            return next;
        });
    };

    React.useEffect(() => {
        if (!onColumnFilterChange) return;

        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = setTimeout(() => {
            const filters = [];
            Object.entries(filterValues).forEach(([cId, val]) => {
                if (val && typeof val === "string" && val.trim() !== "") {
                    const config = filterableColumns.find((fc) => fc.id === cId);
                    const key = config?.filterKey || cId;
                    filters.push({
                        key,
                        operator: "contains",
                        value: val.trim()
                    });
                }
            });

            onColumnFilterChange({
                filters,
                condition: "All"
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [filterValues]);

    const getFilter = (colId) => filterValues[colId] ?? "";

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-3 pb-12">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                {title ? (
                    <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
                ) : (
                    <div></div>
                )}
                <div className="flex items-center gap-3 self-end sm:self-auto">
                    {actions}
                    <button
                        onClick={() => setShowFilters((prev) => !prev)}
                        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                        </svg>
                        {showFilters ? "Hide Filters" : "Show Filters"}
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                <Table containerClassName={containerClassName}>
                    <TableHeader className="sticky top-0 z-10 bg-gray-50">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-gray-50 border-b-2 border-gray-200">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className="px-5 py-4 text-left text-sm font-semibold text-gray-600 whitespace-nowrap"
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                            {showFilters && (
                                <TableRow className="bg-gray-50 border-b border-gray-200">
                                    {table.getHeaderGroups()[0].headers.map((header) => {
                                        const colId = header.id;
                                        const filterConfig = filterableColumns.find((fc) => fc.id === colId);
                                        return (
                                            <TableHead key={header.id} className="px-5 py-2">
                                                {filterConfig ? (
                                                    <input
                                                        type="text"
                                                        placeholder={`Search ${filterConfig.label}...`}
                                                        value={getFilter(colId)}
                                                        onChange={(e) => setFilter(colId, e.target.value)}
                                                        className="w-full min-w-[100px] rounded-lg border border-gray-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                                                    />
                                                ) : null}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            )}
                        </TableHeader>

                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="text-center h-48 py-8"
                                    >
                                        <Loader label="Loading data..." />
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                                        onClick={() => onRowClick && onRowClick(row.original)}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                className="px-5 py-4 text-base align-middle"
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="text-center h-32 text-gray-400 text-base"
                                    >
                                        {emptyMessage}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
            </div>

        </div>
    );
}