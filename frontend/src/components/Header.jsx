"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { loginContext } from "./hooks/LoginContext";
import { useRouter } from "next/navigation";
import { Menu, Table as TableIcon, List, LayoutGrid } from "lucide-react";
import HeaderMenuPanel from "./HeaderMenuPanel";

import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

export default function Header({ onSearch, page, viewMode, onViewModeChange, onAddClick }) {
    const router = useRouter();
    const { displayUser, activeAssignment, logout, can, switchProfile, impersonating, stopImpersonating } = useContext(loginContext);

    const [showMenuPanel, setShowMenuPanel] = useState(false);

    function getInitials(name) {
        if (!name) return "?";
        return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    }


    // console.log(isLogin, "################################ is login header")
    const primaryAssignment =
        activeAssignment ||
        (displayUser?.primaryProfile) ||
        displayUser?.assignments?.find(a => a.is_parent === 0) ||
        null;

    const formattedGroupName = primaryAssignment?.groupName
        ? primaryAssignment.groupName.replace(/([A-Z])/g, ' $1').trim()
        : 'N/A';

    const formattedCompanyName = primaryAssignment?.companyName || 'N/A';


    const fieldsConfig = page === "companies"
        ? [
            { id: "companyName", label: "Company Name" },
            { id: "email", label: "Email" },
            { id: "phone", label: "Phone" },
            { id: "status", label: "Status" }
        ]
        : page === "currencies"
            ? [
                { id: "name", label: "Currency Name" },
                { id: "code", label: "Code" },
                { id: "symbol", label: "Symbol" },
                { id: "status", label: "Status" }
            ]
            : page === "groups"
                ? [
                    { id: "groupName", label: "Group Name" },
                    { id: "groupCode", label: "Group Code" },
                    { id: "status", label: "Status" }
                ]
                : page === "items"
                    ? [
                        { id: "itemName", label: "Item Name" },
                        { id: "itemCode", label: "Item Code" },
                        { id: "barcode", label: "Barcode" },
                        { id: "categoryName", label: "Category" },
                        { id: "companyName", label: "Company" },
                        { id: "status", label: "Status" }
                    ]
                    : [
                        { id: "name", label: "Name" },
                        { id: "email", label: "Email" },
                        { id: "phone", label: "Phone" },
                        { id: "groupName", label: "Group Name" },
                        { id: "status", label: "Status" }
                    ];

    const defaultField = fieldsConfig[0]?.id || "name";
    const isListPage = page === "users" || page === "companies" || page === "currencies" || page === "groups" || page === "items";

    const [hasMounted, setHasMounted] = useState(false);
    useEffect(() => {
        setHasMounted(true);
    }, []);

    const [openProfile, setOpenProfile] = useState(false);
    const [switchLoading, setSwitchLoading] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [showSearchPopup, setShowSearchPopup] = useState(false);
    const [showSidePanel, setShowSidePanel] = useState(false);
    const [filterCondition, setFilterCondition] = useState("All");
    // const [showProfilePanel, setShowProfilePanel] = useState(false);

    const [filterRows, setFilterRows] = useState([
        {
            field: defaultField,
            operator: "equal",
            value: ""
        }
    ]);

    const [sidePanelFilters, setSidePanelFilters] = useState(() => {
        const obj = {};
        fieldsConfig.forEach(f => {
            obj[f.id] = "";
        });
        return obj;
    });

    const profileRef = useRef(null);
    const searchPopupRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        setFilterRows([
            {
                field: defaultField,
                operator: "equal",
                value: ""
            }
        ]);
        const obj = {};
        fieldsConfig.forEach(f => {
            obj[f.id] = "";
        });
        setSidePanelFilters(obj);
        setSearchValue("");
    }, [page]);



    useEffect(() => {
        function handleClickOutside(event) {
            if (
                profileRef.current &&
                !profileRef.current.contains(event.target)
            ) {
                setOpenProfile(false);
            }

            if (
                searchPopupRef.current &&
                !searchPopupRef.current.contains(event.target)
            ) {
                setShowSearchPopup(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);

    let image = `http://localhost:4000/upload/user/${displayUser?.userId}/${displayUser?.userFile}`;


    const gotoLogout = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await logout();
        router.push("/login");
    };

    const gotoChangePass = (e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push("http://localhost:3000/reset-pass");
    };

    const handleSearch = (e) => {
        setSearchValue(e.target.value);
    };

    const handleEnterSearch = (e) => {
        if (e.key === "Enter") {
            if (onSearch) {
                let filters = [];

                if (searchValue.trim() !== "") {
                    filters.push({
                        key: defaultField,
                        operator: "contains",
                        value: searchValue
                    });
                }

                onSearch({
                    filters: filters,
                    condition: "All"
                });
            }
        }
    };

    const addFilterRow = () => {
        let temp = [...filterRows];

        temp.push({
            field: defaultField,
            operator: "equal",
            value: ""
        });

        setFilterRows(temp);
    };

    const removeFilterRow = (index) => {
        let temp = [];

        for (let i = 0; i < filterRows.length; i++) {
            if (i !== index) {
                temp.push(filterRows[i]);
            }
        }
        setFilterRows(temp);
    };

    const updateFilterRow = (index, key, value) => {
        let temp = [...filterRows];

        temp[index][key] = value;

        setFilterRows(temp);
    };

    const handleFind = () => {
        let filters = [];

        for (let i = 0; i < filterRows.length; i++) {
            if (filterRows[i].value.trim() !== "") {
                filters.push({
                    key: filterRows[i].field,
                    operator: filterRows[i].operator,
                    value: filterRows[i].value
                });
            }
        }

        if (onSearch) {
            onSearch({
                filters: filters,
                condition: filterCondition
            });
        }

        setShowSearchPopup(false);
    };

    const handlePopupReset = () => {
        setFilterRows([
            {
                field: defaultField,
                operator: "equal",
                value: ""
            }
        ]);

        setFilterCondition("All");

        if (onSearch) {
            onSearch({
                filters: [],
                condition: "All"
            });
        }
    };

    const handleSidePanelFilter = (key, value) => {
        let temp = { ...sidePanelFilters };

        temp[key] = value;

        setSidePanelFilters(temp);

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            let filters = [];

            for (let item in temp) {
                if (temp[item] && temp[item].trim() !== "") {
                    filters.push({
                        key: item,
                        operator: "contains",
                        value: temp[item]
                    });
                }
            }

            if (onSearch) {
                onSearch({
                    filters: filters,
                    condition: "All"
                });
            }
        }, 400);
    };

    const handleSidePanelReset = () => {
        const obj = {};
        fieldsConfig.forEach(f => {
            obj[f.id] = "";
        });
        setSidePanelFilters(obj);

        if (onSearch) {
            onSearch({
                filters: [],
                condition: "All"
            });
        }
    };

    const gotoSitemap = () => {
        router.push('/')
    }

    return (
        <>
            <header className="h-[72px] w-full border-b border-gray-200 bg-white px-6 flex items-center justify-between relative z-40">

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg bg-blue-100 flex items-center justify-center cursor-pointer" onClick={(e) => {
                            gotoSitemap(e)
                        }}>
                            <span className="text-blue-600 font-bold text-xl">
                                <img src="/header/production.svg" alt="logo" />
                            </span>
                        </div>

                        <div className="leading-tight">
                            <h1 className="text-2xl font-bold text-gray-800"></h1>
                        </div>
                    </div>

                    {isListPage && (
                        <div className="flex h-12 w-[520px] items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                            <div className="px-4 text-gray-500 text-lg">
                                ⌕
                            </div>

                            <input
                                type="text"
                                placeholder={`Search ${fieldsConfig[0]?.label || "Name"}...`}
                                value={searchValue}
                                onChange={handleSearch}
                                onKeyDown={handleEnterSearch}
                                className="flex-1 bg-transparent px-2 text-sm outline-none text-black"
                            />

                            {/* <select className="h-full border-l border-gray-200 bg-transparent px-4 text-sm text-gray-600 outline-none">
                                <option>Name</option>
                            </select> */}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-5">
                    {(() => {
                        const addBtnConfigs = {
                            companies: { perm: "companyAdd", label: "Add Company" },
                            users: { perm: "userAdd", label: "Add User" },
                            groups: { perm: "groupAdd", label: "Add Group" },
                            currencies: { perm: "currencyAdd", label: "Add Currency" },
                            items: { perm: "itemAdd", label: "Add Item" }
                        };

                        const currentAddConfig = addBtnConfigs[page];
                        return currentAddConfig && hasMounted && can && can(currentAddConfig.perm) && onAddClick && (
                            <button
                                onClick={onAddClick}
                                className="cursor-pointer flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-sm"
                            >
                                <span>+</span> {currentAddConfig.label}
                            </button>
                        );
                    })()}
                    {isListPage && <div className="flex items-center gap-4 text-gray-500">
                        <div
                            className="relative"
                            ref={searchPopupRef}
                        >
                            <button
                                className="text-lg hover:text-blue-600 cursor-pointer"
                                title="Search"
                                onClick={() =>
                                    setShowSearchPopup(!showSearchPopup)
                                }
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
                                </svg>
                            </button>

                            {showSearchPopup && (
                                <div className="absolute right-0 top-10 z-50 w-[520px] bg-white border border-gray-200 rounded-xl shadow-2xl p-4">
                                    <button
                                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                                        onClick={() =>
                                            setShowSearchPopup(false)
                                        }
                                    >
                                        ✕
                                    </button>

                                    <div className="flex items-center gap-2 mb-3">
                                        <select
                                            value={filterCondition}
                                            onChange={(e) =>
                                                setFilterCondition(e.target.value)
                                            }
                                            className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-700 outline-none"
                                        >
                                            <option value="All">
                                                All
                                            </option>

                                            <option value="Any">
                                                Any
                                            </option>
                                        </select>

                                        <button
                                            onClick={addFilterRow}
                                            className="w-7 h-7 bg-blue-600 text-white rounded flex items-center justify-center text-lg font-bold hover:bg-blue-700"
                                        >
                                            +
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-2 mb-4">
                                        {filterRows.map((row, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2"
                                            >
                                                <select
                                                    value={row.field}
                                                    onChange={(e) =>
                                                        updateFilterRow(
                                                            index,
                                                            "field",
                                                            e.target.value
                                                        )
                                                    }
                                                    className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700 outline-none flex-1"
                                                >
                                                    {fieldsConfig.map((field) => (
                                                        <option key={field.id} value={field.id}>
                                                            {field.label}
                                                        </option>
                                                    ))}
                                                </select>

                                                <select
                                                    value={row.operator}
                                                    onChange={(e) =>
                                                        updateFilterRow(
                                                            index,
                                                            "operator",
                                                            e.target.value
                                                        )
                                                    }
                                                    className="border border-gray-200 rounded px-2 py-1.5 text-sm text-black outline-none flex-1"
                                                >
                                                    <option value="equal" className="text-black">
                                                        Equal
                                                    </option>

                                                    <option value="contains">
                                                        Contains
                                                    </option>

                                                    <option value="begin">
                                                        Begins With
                                                    </option>

                                                    <option value="end">
                                                        Ends With
                                                    </option>
                                                </select>

                                                {row.field === "status" ? (
                                                    <select
                                                        value={row.value}
                                                        onChange={(e) =>
                                                            updateFilterRow(
                                                                index,
                                                                "value",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="border border-gray-200 rounded px-2 py-1.5 text-sm outline-none flex-[1.5] text-black"
                                                    >
                                                        <option value="">Select Status</option>
                                                        <option value="Active">Active</option>
                                                        <option value="Inactive">Inactive</option>
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={row.value}
                                                        onChange={(e) =>
                                                            updateFilterRow(
                                                                index,
                                                                "value",
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Value"
                                                        className="border border-gray-200 rounded px-2 py-1.5 text-sm outline-none flex-[1.5] text-black"
                                                    />
                                                )}

                                                <button
                                                    onClick={() =>
                                                        removeFilterRow(index)
                                                    }
                                                    className="w-7 h-7 bg-gray-200 text-gray-600 rounded flex items-center justify-center hover:bg-red-100 hover:text-red-500"
                                                >
                                                    −
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-between">
                                        <button
                                            onClick={handlePopupReset}
                                            className="cursor-pointer border border-gray-300 text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-50"
                                        >
                                            Reset
                                        </button>

                                        <button
                                            onClick={handleFind}
                                            className="cursor-pointer bg-blue-600 text-white px-6 py-1.5 rounded text-sm hover:bg-blue-700"
                                        >
                                            Find
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* <button className="text-lg hover:text-blue-600">
                            ↻
                        </button>

                        <button className="text-lg hover:text-blue-600">
                            ⇪
                        </button> */}

                        <button
                            className={`text-lg hover:text-blue-600 cursor-pointer ${showSidePanel ? "text-blue-600" : ""}`}
                            title="Filters"
                            onClick={() =>
                                setShowSidePanel(!showSidePanel)
                            }
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2z" />
                            </svg>

                        </button>
                    </div>}
                    {onViewModeChange && (
                        <div className="relative group">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <span className="inline-flex text-lg hover:text-blue-600 cursor-pointer">
                                        <Menu size={18} />
                                    </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuRadioGroup value={viewMode} onValueChange={onViewModeChange}>
                                        <DropdownMenuRadioItem
                                            value="table"
                                            className={`gap-2 ${viewMode === "table" ? "text-blue-600 font-semibold" : ""}`}
                                        >
                                            <TableIcon size={16} /> Table View
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem
                                            value="list"
                                            className={`gap-2 ${viewMode === "list" ? "text-blue-600 font-semibold" : ""}`}
                                        >
                                            <List size={16} /> List View
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem
                                            value="grid"
                                            className={`gap-2 ${viewMode === "grid" ? "text-blue-600 font-semibold" : ""}`}
                                        >
                                            <LayoutGrid size={16} /> Grid View
                                        </DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                                Change View
                            </span>
                        </div>
                    )}
                    <div className="relative" ref={profileRef}>
                        <div
                            onClick={() => setOpenProfile(!openProfile)}
                            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1 hover:bg-gray-100"
                        >
                            <div className="relative h-10 w-10 rounded-full overflow-hidden bg-blue-100">
                                {hasMounted && displayUser?.userFile
                                    ? <img
                                        src={image}
                                        alt="profile"
                                        className="h-full w-full object-cover"
                                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                    />
                                    : null
                                }
                                <span
                                    style={{ display: (hasMounted && displayUser?.userFile) ? 'none' : 'flex' }}
                                    className="h-full w-full items-center justify-center text-sm font-bold text-blue-600 absolute inset-0"
                                >
                                    {hasMounted ? getInitials(displayUser?.name) : ""}
                                </span>
                            </div>

                            <div className="leading-tight">
                                <h4 className="text-sm font-semibold text-gray-800">
                                    {hasMounted ? (displayUser?.name || "guest") : "guest"}
                                </h4>
                                <p className="text-xs text-gray-500">
                                    {hasMounted ? (formattedGroupName || "N/A") : "N/A"}{" "}|{" "}
                                    {hasMounted ? (formattedCompanyName || "N/A") : "N/A"}
                                </p>
                            </div>

                            <span className="text-xs text-gray-500">
                                {openProfile ? "▲" : "▼"}
                            </span>
                        </div>

                        {openProfile && (
                            <div className="absolute right-0 top-14 z-50 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">

                                {/* Profile switcher section — shown when user has more than one assignment */}
                                {hasMounted && Array.isArray(displayUser?.assignments) && displayUser.assignments.length > 1 && (
                                    <div className="border-b">
                                        <p className="px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Switch Profile</p>
                                        <div className="max-h-52 overflow-y-auto">
                                            {displayUser.assignments.map((a, i) => {
                                                const isActive = activeAssignment?.id === a.id;
                                                const formattedGroup = a.groupName
                                                    ? a.groupName.replace(/([A-Z])/g, " $1").trim()
                                                    : "—";
                                                return (
                                                    <button
                                                        key={a.id || i}
                                                        id={`header-profile-switch-${a.id || i}`}
                                                        disabled={isActive || switchLoading}
                                                        className={`flex w-full items-center justify-between px-5 py-3 text-left transition ${isActive
                                                            ? "bg-blue-50 cursor-default"
                                                            : "hover:bg-gray-50 cursor-pointer"
                                                            } ${switchLoading && !isActive ? "opacity-50" : ""}`}
                                                        onClick={async () => {
                                                            if (isActive || switchLoading) return;
                                                            setSwitchLoading(true);
                                                            const result = await switchProfile(a);
                                                            setSwitchLoading(false);
                                                            if (result?.success) {
                                                                setOpenProfile(false);
                                                                router.push("/")
                                                                // window.location.href = "/";
                                                            } else {
                                                                console.error("Profile switch failed:", result?.message);
                                                            }
                                                        }}
                                                    >
                                                        <div className="leading-tight">
                                                            <p className="text-sm font-medium text-gray-800">{a.companyName || "—"}</p>
                                                            <p className="text-xs text-gray-500">{formattedGroup}</p>
                                                        </div>
                                                        {isActive && (
                                                            <span className="ml-2 text-xs font-semibold text-blue-600">✓</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <button
                                    className="flex w-full items-center gap-4 px-5 py-4 hover:bg-gray-50 border-b"
                                    onClick={() => { router.push("/profile"); setOpenProfile(false); }}
                                >
                                    <span className="text-sm font-medium text-gray-700 cursor-pointer">Profile</span>
                                </button>

                                {/* <button className="flex w-full items-center gap-4 px-5 py-4 hover:bg-gray-50 border-b">
                                    <span className="text-sm font-medium text-gray-700">
                                        Preferences
                                    </span>
                                </button> */}

                                <button className="flex w-full items-center gap-4 px-5 py-4 hover:bg-gray-50 border-b">
                                    <span
                                        className="text-sm font-medium text-gray-700 cursor-pointer"
                                        onClick={(e) => {
                                            gotoChangePass(e);
                                        }}
                                    >
                                        Change Password
                                    </span>
                                </button>

                                {hasMounted && impersonating ? (
                                    <button
                                        className="flex w-full items-center gap-4 px-5 py-4 hover:bg-blue-50"
                                        onClick={() => {
                                            stopImpersonating();
                                            setOpenProfile(false);
                                            window.location.href = "/users";
                                        }}
                                    >
                                        <span className="text-sm font-medium text-blue-600 cursor-pointer">
                                            ← Back to Session
                                        </span>
                                    </button>
                                ) : (
                                    <button className="flex w-full items-center gap-4 px-5 py-4 hover:bg-red-50">
                                        <span
                                            className="text-sm font-medium text-red-500 cursor-pointer"
                                            onClick={(e) => gotoLogout(e)}
                                        >
                                            Logout
                                        </span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowMenuPanel(!showMenuPanel)}
                        className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer ${showMenuPanel
                                ? "text-blue-600 bg-blue-50 border border-blue-200"
                                : "text-gray-700 hover:text-blue-600 hover:bg-gray-100"
                            }`}
                    >
                        <span>{showMenuPanel ? "✕" : "☰"}</span>
                        <span>Menu</span>
                    </button>
                </div>
            </header>

            {showSidePanel && (
                <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowSidePanel(false)}
                />
            )}

            <div
                className={`fixed top-0 right-0 h-full w-[300px] bg-white border-l border-gray-200 shadow-2xl z-40 transition-transform duration-300 ${showSidePanel ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                <div className="flex items-center justify-between px-5 py-4 bg-blue-600">
                    <h2 className="text-white font-semibold text-base">
                        Filters
                    </h2>

                    <button
                        onClick={() => setShowSidePanel(false)}
                        className="text-white hover:text-blue-200 text-xl cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-5 overflow-y-auto h-[calc(100%-64px)]">
                    {fieldsConfig.map((field) => (
                        <div key={field.id}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {field.label}
                            </label>

                            {field.id === "status" ? (
                                <select
                                    value={sidePanelFilters.status || ""}
                                    onChange={(e) =>
                                        handleSidePanelFilter(
                                            "status",
                                            e.target.value
                                        )
                                    }
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-black bg-white"
                                >
                                    <option value="">All Statuses</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">
                                        Inactive
                                    </option>
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={sidePanelFilters[field.id] || ""}
                                    onChange={(e) =>
                                        handleSidePanelFilter(
                                            field.id,
                                            e.target.value
                                        )
                                    }
                                    placeholder={field.id === "groupName" || field.id === "companyName" ? `Enter ${field.label}` : `Please enter ${field.label}`}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-black"
                                />
                            )}
                        </div>
                    ))}

                    <button
                        onClick={handleSidePanelReset}
                        className="mt-2 w-full border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 cursor-pointer"
                    >
                        Reset Filters
                    </button>
                </div>
            </div>

            <HeaderMenuPanel
                isOpen={showMenuPanel}
                onClose={() => setShowMenuPanel(false)}
                hasMounted={hasMounted}
            />
        </>
    );
}