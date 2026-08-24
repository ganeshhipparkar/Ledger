"use client";
import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../Header";
import CompanyUpdate from "./CompanyUpdate";
import { loginContext } from "../hooks/LoginContext";
import Loader from "../ui/Loader";
import ImagePreviewModal from "../ui/ImagePreviewModal";

import { decryptResponse } from "@/app/lib/crypto";

export default function CompanyDetails({ id }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("summary");
    const [showEdit, setShowEdit] = useState(false);
    const [imgPreview, setImgPreview] = useState(false);

    function getInitials(name) {
        if (!name) return "?";
        return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    }

    useEffect(() => {
        fetchCompany();
    }, [showEdit]);

    const fetchCompany = async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    endpoint: `company-details/${id}`,
                    module: "company",
                },
            });
            const resJson = await res.json();
            const data = resJson?.encrypted ? decryptResponse(resJson.encrypted) : resJson;
            if (res.ok && data && !data.statusCode && data.companyId) {
                setCompany(data);
                console.log(data, "details")
            } else {
                console.error("Failed to fetch company details:", data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const gotoPages = (e, url) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(url);
    };

    const formatStatus = (status) => {
        if (!status || typeof status !== "string") return "-";
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    };

    const statusBadge = (status) => {
        if (!status || typeof status !== "string") return "inline-block rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700";
        const s = status.toLowerCase();
        if (s === "active") return "inline-block rounded-full bg-green-100 px-3 py-1 text-xs text-green-700";
        if (s === "inactive") return "inline-block rounded-full bg-red-100 px-3 py-1 text-xs text-red-700";
        return "inline-block rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700";
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="company-details" />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading company details..." />
                </div>
            </div>
        );
    }

    if (!company) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page="company-details" />
                <div className="p-8 text-red-500 text-lg font-semibold">Company not found.</div>
            </div>
        );
    }

    if (showEdit) {
        return <CompanyUpdate id={id} onBack={() => setShowEdit(false)} />;
    }

    const assignments = Array.isArray(company.assignments) ? company.assignments : [];
    const imageUrl = `http://localhost:4000/upload/company/${company.companyId}/${company.companyFile}`;

    return (
        <div className="min-h-screen bg-[#f5f6f8]">
            <Header page="company-details" />

            <div className="w-full px-4 sm:px-6 lg:px-8 py-4 pb-20">
                <nav className="mb-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={(e) => gotoPages(e, "/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={(e) => gotoPages(e, "/company-list")}>Companies</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Details</span>
                </nav>

                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">Company Details</h1>
                    <div className="flex items-center gap-4">
                        {can("companyUpdate") && (
                            <button
                                className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-8 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 active:scale-[0.98] cursor-pointer"
                                onClick={() => setShowEdit(true)}
                            >
                                Edit
                            </button>
                        )}

                        <button
                            className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-8 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 active:scale-[0.98] cursor-pointer"
                            onClick={() => router.back()}
                        >
                            Back
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-3">
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
                            <div className="border-b pb-5">
                                <h2 className="text-xl font-semibold text-gray-800">{company.companyName}</h2>
                                <p className="text-sm text-gray-400 mt-1">{company.companyCode}</p>
                            </div>
                            <div className="mt-6 space-y-3">
                                <button
                                    onClick={() => setActiveTab("summary")}
                                    className={`w-full rounded-xl px-4 py-3 text-left font-medium transition ${activeTab === "summary" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                >
                                    Summary
                                </button>
                                <button
                                    onClick={() => setActiveTab("users")}
                                    className={`w-full rounded-xl px-4 py-3 text-left font-medium transition ${activeTab === "users" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                >
                                    Users
                                    {assignments.length > 0 && (
                                        <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{assignments.length}</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-9">

                        {activeTab === "summary" && (
                            <div className="grid gap-6 lg:grid-cols-2">
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-4 border-b pb-5">
                                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-50 shadow-md relative">
                                            {company.companyFile
                                                ? <img
                                                    src={imageUrl}
                                                    alt="company"
                                                    className="h-full w-full object-cover cursor-pointer"
                                                    onClick={() => setImgPreview(true)}
                                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                                />
                                                : null
                                            }
                                            <span
                                                style={{ display: company.companyFile ? 'none' : 'flex' }}
                                                className="h-full w-full items-center justify-center text-lg font-bold text-blue-600 absolute inset-0 cursor-pointer"
                                                onClick={() => company.companyFile && setImgPreview(true)}
                                            >
                                                {getInitials(company.companyName)}
                                            </span>
                                            <ImagePreviewModal
                                                open={imgPreview}
                                                onClose={() => setImgPreview(false)}
                                                imageUrl={imageUrl}
                                            />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-semibold text-gray-800">{company.companyName}</h2>
                                            <span className={statusBadge(company.status)}>{formatStatus(company.status)}</span>
                                        </div>
                                    </div>
                                    <div className="mt-6 space-y-4">
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Company Code</p><p className="font-medium text-gray-800">{company.companyCode || "-"}</p></div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Parent Company</p>
                                            <div className="font-medium text-gray-800">
                                                {company.parentCompanyId && company.parentCompanyName ? (
                                                    can("companyView") ? (
                                                        <span
                                                            className="text-blue-600 cursor-pointer hover:underline"
                                                            onClick={(e) => gotoPages(e, `/company/${company.parentCompanyId}`)}
                                                        >
                                                            {company.parentCompanyName}
                                                        </span>
                                                    ) : (
                                                        <span>{company.parentCompanyName}</span>
                                                    )
                                                ) : (
                                                    <span className="text-gray-800">-</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Location</p><p className="font-medium text-gray-800">{company.city || "-"}</p></div>
                                        <div className="grid grid-cols-2">
                                            <p className="text-gray-500">Currency</p>
                                            <p className="font-medium text-gray-800">
                                                {company?.currencies?.map((currency) => currency.code).join(", ") || "-"}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Website</p><p className="font-medium text-gray-800">{company.website || "N/A"}</p></div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Added By</p><p className="font-medium text-gray-800">{company.addedByName || "-"}</p></div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Updated By</p><p className="font-medium text-gray-800">{company.updatedByName || "-"}</p></div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="rounded-2xl bg-white p-6 shadow-sm">
                                        <h3 className="mb-5 text-lg font-semibold text-gray-800">Contact Info</h3>
                                        <div className="space-y-4">
                                            <div><p className="text-sm text-gray-500">Email</p><p className="font-medium text-gray-800">{company.email || "N/A"}</p></div>
                                            <div><p className="text-sm text-gray-500">Phone</p><p className="font-medium text-gray-800">{company.dialCode ? `+${company.dialCode} ` : ""}{company.phone || "N/A"}</p></div>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-white p-6 shadow-sm">
                                        <h3 className="mb-5 text-lg font-semibold text-gray-800">Address</h3>
                                        <div className="space-y-4">
                                            <div><p className="text-sm text-gray-500">Address</p><p className="font-medium text-gray-800">{company.AddressLineOne || "-"}</p></div>
                                            <div><p className="text-sm text-gray-500">City / State</p><p className="font-medium text-gray-800">{[company.city, company.state, company.country].filter(Boolean).join(", ") || "N/A"}</p></div>
                                            <div><p className="text-sm text-gray-500">Postal Code</p><p className="font-medium text-gray-800">{company.postalCode || "-"}</p></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
                                    <h3 className="mb-5 text-lg font-semibold text-gray-800">Owner Information</h3>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                        <div><p className="text-sm text-gray-500">Owner Name</p><p className="font-medium text-gray-800">{company.ownerName || "N/A"}</p></div>
                                        <div><p className="text-sm text-gray-500">Owner Email</p><p className="font-medium text-gray-800">{company.ownerEmail || "N/A"}</p></div>
                                        <div><p className="text-sm text-gray-500">Owner Phone</p><p className="font-medium text-gray-800">{company.ownerPhone || "N/A"}</p></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "users" && (
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <h3 className="mb-6 text-xl font-semibold text-gray-800">Users in this Company</h3>
                                {assignments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <p className="text-lg">No users assigned to this company.</p>
                                    </div>
                                ) : (
                                    <div className="w-full overflow-x-auto">
                                        <table className="w-full min-w-[500px]">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr className="text-gray-500 text-sm font-semibold">
                                                    <th className="px-5 py-4 text-left">#</th>
                                                    <th className="px-5 py-4 text-left">Name</th>
                                                    <th className="px-5 py-4 text-left">Email</th>
                                                    <th className="px-5 py-4 text-left">Role</th>
                                                    <th className="px-5 py-4 text-left">Type</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {assignments.map((a, i) => (
                                                    <tr
                                                        key={i}
                                                        className={`border-b border-gray-100 hover:bg-gray-50 transition ${can("userView") ? "cursor-pointer" : ""}`}
                                                        onClick={() => can("userView") && router.push(`/user/${a.userId}`)}
                                                    >
                                                        <td className="px-5 py-4 text-gray-500 text-sm">{i + 1}</td>
                                                        <td className="px-5 py-4 font-medium text-blue-600 hover:underline">{a.userName || "N/A"}</td>
                                                        <td className="px-5 py-4 text-gray-600">{a.userEmail || "N/A"}</td>
                                                        <td className="px-5 py-4 text-gray-600">{a.groupName ? a.groupName.replace(/([A-Z])/g, " $1").trim() : "N/A"}</td>
                                                        <td className="px-5 py-4">
                                                            <span className={a.is_parent === 0
                                                                ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
                                                                : "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600"
                                                            }>
                                                                {a.is_parent === 0 ? "Primary" : "Assigned"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}