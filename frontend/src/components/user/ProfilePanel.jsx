"use client";
import { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { loginContext } from "../hooks/LoginContext";
import ActivityTimeline from '@/components/activity/ActivityTimeline';
import Header from "../Header";
import ImagePreviewModal from "../ui/ImagePreviewModal";

export default function ProfilePage() {
    const router = useRouter();
    const onClose = () => router.push("/");
    const { isLogin, displayUser, activeAssignment, permissions, impersonating, switchProfile } = useContext(loginContext);
    const [activeTab, setActiveTab] = useState("summary");
    const [imgPreview, setImgPreview] = useState(false);

    if (!isLogin) return null;

    const assignments = Array.isArray(displayUser.assignments) ? displayUser.assignments : [];
    const selectedAssignment = activeAssignment || assignments.find(a => a.is_parent === 0) || assignments[0] || null;

    const imageurl = `http://localhost:4000/upload/user/${displayUser.userId}/${displayUser.userFile}`;


    const formattedGroupName = selectedAssignment?.groupName
        ? selectedAssignment.groupName.replace(/([A-Z])/g, " $1").trim()
        : "-";

    const formattedCompanyName = selectedAssignment?.companyName || "-";

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("en-GB").replace(/\//g, "-");
    };

    const statusBadge = (status) => {
        if (status === "Active") return "inline-block rounded-full bg-green-100 px-3 py-1 text-sm text-green-700";
        if (status === "Inactive") return "inline-block rounded-full bg-red-100 px-3 py-1 text-sm text-red-700";
        return "inline-block rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-700";
    };

    const getInitials = (name) => {
        if (!name) return "";
        const parts = name.trim().split(/\s+/);
        const initials = parts.map(p => p[0]).join("");
        return initials.slice(0, 2).toUpperCase();
    };

    const groupedPermissions = permissions.reduce((acc, perm) => {
        const modName = perm.replace(/([A-Z][a-z]+)/g, ' $1').trim().split(' ')[0].toLowerCase();
        if (!acc[modName]) acc[modName] = [];
        acc[modName].push(perm);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-[#f5f6f8]">
            <Header />
            <div className="p-6">
                <nav className="mb-4 flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={onClose}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">My Profile</span>
                </nav>

                <div className="mb-6 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">My Profile</h1>
                    <button
                        className="h-12 rounded-md bg-gray-500 px-8 font-medium text-white cursor-pointer hover:bg-gray-600 transition"
                        onClick={onClose}
                    >
                        Back
                    </button>
                </div>

                <div className="grid grid-cols-12 gap-6">

                    <div className="col-span-12 lg:col-span-3">
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
                            <div className="border-b pb-5">
                                <h2 className="text-xl font-semibold capitalize text-gray-800">{displayUser.name}</h2>
                                <p className="text-sm text-gray-400 mt-1">{displayUser.email}</p>
                            </div>
                            <div className="mt-6 space-y-3">
                                <button
                                    onClick={() => setActiveTab("summary")}
                                    className={`w-full rounded-xl px-4 py-3 text-left font-medium transition cursor-pointer ${activeTab === "summary" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                >
                                    Summary
                                </button>
                                <button
                                    onClick={() => setActiveTab("profiles")}
                                    className={`w-full rounded-xl px-4 py-3 text-left cursor-pointer font-medium transition ${activeTab === "profiles" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                >
                                    Profiles
                                    {assignments.length > 0 && (
                                        <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 cursor-pointer">{assignments.length}</span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab("activity")}
                                    className={`w-full rounded-xl px-4 py-3 text-left font-medium cursor-pointer transition ${activeTab === "activity" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                >
                                    My Activity
                                </button>
                                <button
                                    onClick={() => setActiveTab("permissions")}
                                    className={`w-full rounded-xl px-4 py-3 text-left font-medium cursor-pointer transition ${activeTab === "permissions" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                >
                                    Permissions
                                    {permissions.length > 0 && (
                                        <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{permissions.length}</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-9">

                        {activeTab === "summary" && (
                            <div className="grid gap-6 lg:grid-cols-2">
                                {/* Profile card */}
                                <div className="rounded-2xl bg-white p-6 shadow-sm">
                                    <div className="flex items-center gap-4 border-b pb-5">
                                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold uppercase text-blue-600 shadow-md relative">
                                            {displayUser?.userFile
                                                ? <img
                                                    src={imageurl}
                                                    alt="profile"
                                                    className="h-full w-full object-cover cursor-pointer"
                                                    onClick={() => setImgPreview(true)}
                                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                                />
                                                : null
                                            }
                                            <span
                                                style={{ display: displayUser?.userFile ? 'none' : 'flex' }}
                                                className="h-full w-full items-center justify-center absolute inset-0 cursor-pointer"
                                                onClick={() => displayUser?.userFile && setImgPreview(true)}
                                            >
                                                {getInitials(displayUser?.name)}
                                            </span>
                                            <ImagePreviewModal
                                                open={imgPreview}
                                                onClose={() => setImgPreview(false)}
                                                imageUrl={imageurl}
                                            />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-semibold capitalize text-gray-800">{displayUser.name}</h2>
                                            <span className={statusBadge(displayUser.status)}>{displayUser.status || "Active"}</span>
                                        </div>
                                    </div>
                                    <div className="mt-6 space-y-5">
                                        <div className="grid grid-cols-2"><p className="text-gray-500">User Name</p><p className="font-medium text-gray-800">{displayUser.name}</p></div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Age</p><p className="font-medium text-gray-800">{displayUser.age ?? "-"}</p></div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Role</p><p className="font-medium text-gray-800">{formattedGroupName ?? "-"}</p></div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Company</p><p className="font-medium text-gray-800">{formattedCompanyName ?? "-"}</p></div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Created Date</p><p className="font-medium text-gray-800">{formatDate(displayUser.createdAt) ?? "-"}</p></div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Created By</p><p className="font-medium text-gray-800">{displayUser.createdBy || "-"}</p></div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Updated Date</p><p className="font-medium text-gray-800">{formatDate(displayUser.updatedDate) ?? "-"}</p></div>
                                        <div className="grid grid-cols-2"><p className="text-gray-500">Updated By</p><p className="font-medium text-gray-800">{displayUser.updatedBy || "-"}</p></div>
                                    </div>
                                </div>

                                {/* Contact */}
                                <div className="space-y-6">
                                    <div className="rounded-2xl bg-white p-6 shadow-sm">
                                        <h3 className="mb-5 text-xl font-semibold text-gray-800">Contact Info</h3>
                                        <div className="space-y-5">
                                            <div><p className="text-sm text-gray-500">Email</p><p className="font-medium text-gray-800">{displayUser.email}</p></div>
                                            <div><p className="text-sm text-gray-500">Phone Number</p><p className="font-medium text-gray-800">{displayUser.phone || "-"}</p></div>
                                            <div><p className="text-sm text-gray-500">Alternate Phone</p><p className="font-medium text-gray-800">{displayUser.alternatePhone || "-"}</p></div>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-white p-6 shadow-sm">
                                        <h3 className="mb-6 text-xl font-semibold text-gray-800">Remarks</h3>
                                        <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
                                            <p>No Remarks found.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "profiles" && (
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <h3 className="mb-6 text-xl font-semibold text-gray-800">My Profiles</h3>
                                {assignments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <p className="text-lg">No profiles assigned.</p>
                                        <p className="pansswordtext-sm mt-1">Click &quot;Add Profile&quot; to assign this user to a company and role.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {assignments.map((a, i) => (
                                            <div
                                                key={a.id || i}
                                                className={`rounded-xl border p-5 shadow-sm transition ${selectedAssignment?.id === a.id
                                                    ? "border-blue-400 bg-blue-50"
                                                    : "border-gray-100 bg-gray-50"
                                                    }`}
                                            >
                                                <div className="mb-3 flex items-center justify-between">
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Profile {i + 1}</span>
                                                    {selectedAssignment?.id === a.id && (
                                                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Logged In</span>
                                                    )}
                                                    {a.is_parent === 0 && selectedAssignment?.id !== a.id && (
                                                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Primary</span>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-xs text-gray-400">Company</p>
                                                        <p className="font-semibold text-gray-800">{a.companyName || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-400">Role</p>
                                                        <p className="font-medium text-gray-700">
                                                            {a.groupName ? a.groupName.replace(/([A-Z])/g, " $1").trim() : "-"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "activity" && (
                            <div className="max-h-[70vh] overflow-y-auto pr-2 my-4">
                                <ActivityTimeline userId={displayUser?.userId} />
                            </div>
                        )}

                        {activeTab === "permissions" && (
                            <div className="rounded-2xl bg-white p-6 shadow-sm">
                                <h3 className="mb-6 text-xl font-semibold text-gray-800">
                                    My Permissions
                                    <span className="ml-2 text-sm font-normal text-gray-400">({permissions.length} total)</span>
                                </h3>
                                {permissions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <p className="text-lg">No permissions assigned.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.entries(groupedPermissions).map(([module, perms]) => (
                                            <div key={module}>
                                                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 capitalize">{module}</h4>
                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                    {perms.map((perm) => (
                                                        <div
                                                            key={perm}
                                                            className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3"
                                                        >
                                                            <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                                                            <span className="text-sm font-medium text-green-800">
                                                                {perm.replace(/([A-Z])/g, " $1").trim()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
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