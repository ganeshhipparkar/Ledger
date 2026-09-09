"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import dayjs from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DesktopDatePicker } from "@mui/x-date-pickers/DesktopDatePicker";
import Header from "@/components/Header";
import { AddFormSchema } from "@/components/Zod";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "@/components/hooks/LoginContext";
import RouteGuard from "@/components/RouteGuard";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Select from "react-select";

const MySwal = withReactContent(Swal);

const MAX_DOB = dayjs().subtract(18, "year");

export default function AddUserPage() {
    const router = useRouter();

    const gotoPages = async (e, url) => {
        e.stopPropagation();
        e.preventDefault();
        router.push(url);
    };

    const [formData, setFormData] = useState({
        name: "",
        firstName: "",
        middleName: "",
        surname: "",
        email: "",
        phone: "",
        dialCode: "91",
        remarks: "",
        password: "",
        status: "Active",
        tel: "",
        dob: null,
        isActive: "true",
        userFile: null,
        companyId: "",
        groupId: "",
        alternatePhone: "",
    });

    const [preview, setPreview] = useState("");
    const fileInputRef = useRef(null);
    const [groups, setGroups] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [showPassword, setShowPassword] = useState(false);
    const { isLogin, displayUser } = useContext(loginContext);
    const [errors, setErrors] = useState({
        email: "",
        name: "",
        firstName: "",
        middleName: "",
        surname: "",
        dob: "",
        phone: "",
        userFile: "",
        password: "",
        alternatePhone: "",
        companyId: "",
        groupId: "",
    });
    const onBack = async () => {
        const result = await MySwal.fire({
            title: "Discard changes?",
            text: "Any unsaved data will be lost.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, discard",
            cancelButtonText: "Keep editing",
            confirmButtonColor: "#EF4444",
            cancelButtonColor: "#1F2937",
            reverseButtons: true,
            focusCancel: true,
            customClass: {
                popup: 'rounded-xl',
                confirmButton: 'px-6 py-2 font-medium',
                cancelButton: 'px-6 py-2 font-medium'
            }
        });

        if (result.isConfirmed) router.push("/users");
    };
    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        "Content-Type": "application/json",
                        endpoint: "group-dropdown-list",
                        module: "group",
                    },
                    body: JSON.stringify({ page: 1, limit: 200 }),
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                setGroups(Array.isArray(data?.data) ?
                    data.data.filter((group) => group.status == "active") : []);

            } catch (err) {
                toast.error(`${err}`, { position: "top-right" });
            }
        };
        fetchGroups();
    }, []);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        "Content-Type": "application/json",
                        endpoint: "company-list",
                        module: "company",
                    },
                    body: JSON.stringify({ page: 1, limit: 200 }),
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                setCompanies(Array.isArray(data?.data) ?
                    data.data.filter((company) => company.status == "active") : []);
            } catch (err) {
                toast.error(`${err}`, { position: "top-right" });
            }
        };
        fetchCompanies();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setErrors((prev) => ({ ...prev, [name]: "" }));
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFormKeyDown = (e) => {
        if (
            e.key === "Enter" &&
            e.target.tagName === "INPUT" &&
            e.target.type !== "submit"
        ) {
            e.preventDefault();
        }
    };

    const handleDateChange = (date) => {
        setFormData((prev) => ({ ...prev, dob: date }));
    };

    const handleImage = (e) => {
        const file = e?.target?.files[0];
        if (file) {
            setFormData((prev) => ({ ...prev, userFile: file }));
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveImage = () => {
        setFormData((prev) => ({ ...prev, userFile: null }));
        setPreview("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = AddFormSchema.safeParse(formData);


        try {
            if (!result.success) {
                const fieldErrors = {
                    email: "",
                    name: "",
                    firstName: "",
                    middleName: "",
                    surname: "",
                    dob: "",
                    password: "",
                    phone: "",
                    userFile: "",
                    alternatePhone: "",
                    companyId: "",
                    groupId: "",
                };

                result.error.issues.forEach((err) => {
                    const field = err.path[0];
                    if (field && !fieldErrors[field]) {
                        fieldErrors[field] = err.message;
                    }
                });

                setErrors(fieldErrors);

                return;
            } else {
                const result = await Swal.fire({
                    title: 'Are you sure?',
                    text: "Do you want to add this user?",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, add user'
                });

                if (result.isConfirmed) {
                    const payload = new FormData();
                    payload.append("name", formData.name);
                    payload.append("firstName", formData.firstName);
                    payload.append("middleName", formData.middleName);
                    payload.append("surname", formData.surname);
                    payload.append("email", formData.email);
                    payload.append("phone", formData.phone);
                    payload.append("dialCode", formData.dialCode);
                    payload.append("remarks", formData.remarks || "");
                    payload.append("status", formData.status);
                    payload.append("dob", formData.dob ? formData.dob.format("YYYY-MM-DD") : "");
                    payload.append("password", formData.password);
                    payload.append("companyId", formData.companyId);
                    payload.append("groupId", formData.groupId);
                    payload.append("createdBy", displayUser?.userId || null)
                    payload.append("is_parent", "0");



                    if (formData.userFile) {
                        payload.append("userFile", formData.userFile);
                    }

                    const response = await fetch("/relayapi", {
                        method: "POST",
                        headers: {
                            endpoint: "user-add", module: "user"
                        },
                        body: payload,
                    });

                    const rawPayload = await response.json();
                    const result = rawPayload?.encrypted
                        ? decryptResponse(rawPayload.encrypted)
                        : rawPayload;
                    const isSuccess =
                        response.ok &&
                        (result?.success === 1 || result?.settings?.success === 1);

                    if (isSuccess) {
                        toast.success("User created successfully", { position: "top-right" });
                        setTimeout(() => router.push("/users"), 1000);
                    } else {
                        const msg = result?.message || result?.settings?.message || "Failed to create user.";
                        toast.error(msg, { position: "top-right" });
                    }
                }
            }
        } catch (error) {
            toast.error(`${error}`, { position: "top-right" });
        }

    };

    return (
        <RouteGuard permission="userAdd">
            <div className="min-h-screen w-full bg-[#f5f6f8] text-black">
                <Header page="user-add" />

                <nav
                    className="p-6 flex items-center space-x-2 text-sm font-medium text-gray-500"
                    aria-label="Breadcrumb"
                >
                    <span
                        className="cursor-pointer transition-colors hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/")}
                    >
                        Home
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span
                        className="cursor-pointer transition-colors hover:text-blue-600 hover:underline"
                        onClick={(e) => gotoPages(e, "/users")}
                    >
                        Users
                    </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Add User</span>
                </nav>

                <div className="px-6">
                    <div className="mb-8 flex items-center justify-between">
                        <h1 className="mt-1 text-3xl font-semibold text-gray-800">Add User</h1>
                        {/* <button
                            onClick={() => onBack()}
                            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 active:scale-[0.98] cursor-pointer"
                        >
                            ← Back
                        </button> */}
                    </div>

                    <div className="w-full rounded-2xl bg-white p-8 shadow-sm">
                        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>

                            {/* Basic Information */}
                            <div className="rounded-2xl bg-white p-8 shadow-sm mb-6">
                                <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Basic Information</h2>
                                <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">

                                    {/* Name */}
                                    <div className="w-full">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            User Name <span className="text-red-500 text-[16px]">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="Enter User Name"
                                            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                                        />
                                        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                                    </div>

                                    {/* full name */}
                                    <div className="w-full">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Name <span className="text-red-500 text-[16px]">*</span>
                                        </label>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    name="firstName"
                                                    value={formData.firstName}
                                                    onChange={handleChange}
                                                    placeholder="First Name"
                                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                                                />
                                                {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>}
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    name="middleName"
                                                    value={formData.middleName}
                                                    onChange={handleChange}
                                                    placeholder="Middle Name"
                                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                                                />
                                                {errors.middleName && <p className="mt-1 text-sm text-red-500">{errors.middleName}</p>}
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    name="surname"
                                                    value={formData.surname}
                                                    onChange={handleChange}
                                                    placeholder="Last Name"
                                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                                                />
                                                {errors.surname && <p className="mt-1 text-sm text-red-500">{errors.surname}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="w-full">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Password <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-20 outline-none focus:border-blue-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2"
                                            >
                                                <img
                                                    src={showPassword ? "/password/hidden.png" : "/password/eye.png"}
                                                    alt=""
                                                    className="w-5 h-5 object-contain opacity-60 hover:opacity-100 transition "
                                                />
                                            </button>
                                        </div>
                                        {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
                                    </div>

                                    {/* DOB */}
                                    <div className="w-full">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            DOB <span className="text-red-500 text-[16px]">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            name="dob"
                                            value={formData.dob ? formData.dob.format("YYYY-MM-DD") : ""}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const date = val ? dayjs(val) : null;
                                                handleDateChange(date);
                                            }}
                                            max={MAX_DOB.format("YYYY-MM-DD")}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                                        />
                                        {errors.dob && <p className="mt-1 text-sm text-red-500">{errors.dob}</p>}
                                    </div>

                                    {/* Profile Image */}
                                    <div className="w-full lg:col-span-2">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Profile Image
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            ref={fileInputRef}
                                            onChange={handleImage}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                                        />
                                        {errors.userFile && (
                                            <p className="mt-1 text-sm text-red-500">{errors.userFile}</p>
                                        )}
                                        {preview && (
                                            <div className="relative mt-4 h-24 w-24">
                                                <img
                                                    src={preview}
                                                    alt="preview"
                                                    className="h-24 w-24 rounded-full object-cover border"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveImage}
                                                    aria-label="Remove selected image"
                                                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow hover:bg-red-600 z-10"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div className="rounded-2xl bg-white p-8 shadow-sm mb-6">
                                <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Contact Information</h2>
                                <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">

                                    {/* Email */}
                                    <div className="w-full">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Email <span className="text-red-500 text-[16px]">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="Enter email address"
                                            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                                        />
                                        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                                    </div>

                                    {/* Phone */}
                                    <div className="w-full">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Phone Number <span className="text-red-500 text-[16px]">*</span>
                                        </label>
                                        <PhoneInput
                                            country="in"
                                            value={formData.dialCode + formData.phone}
                                            onChange={(value, countryData) => {
                                                const dialCode = countryData.dialCode;
                                                const phone = value.slice(dialCode.length);
                                                setFormData((prev) => ({ ...prev, phone, dialCode }));
                                                setErrors((prev) => ({ ...prev, phone: "" }));
                                            }}
                                            inputStyle={{
                                                width: "100%",
                                                height: "50px",
                                                borderRadius: "0.75rem",
                                                border: errors.phone ? "1px solid #ef4444" : "1px solid #d1d5db",
                                                fontSize: "14px",
                                                paddingLeft: "58px",
                                            }}
                                            buttonStyle={{
                                                borderRadius: "0.75rem 0 0 0.75rem",
                                                border: errors.phone ? "1px solid #ef4444" : "1px solid #d1d5db",
                                                background: "#f9fafb",
                                            }}
                                            containerStyle={{ width: "100%" }}
                                            enableSearch
                                            searchPlaceholder="Search country..."
                                        />
                                        {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
                                    </div>

                                    {/* Remarks */}
                                    <div className="w-full lg:col-span-2">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Remarks
                                        </label>
                                        <textarea
                                            name="remarks"
                                            rows={2}
                                            value={formData.remarks}
                                            onChange={handleChange}
                                            placeholder="Enter any remarks..."
                                            className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none focus:border-blue-500 resize-none"
                                        />
                                        {errors.remarks && <p className="mt-1 text-sm text-red-500">{errors.remarks}</p>}
                                    </div>

                                    {/* Alternate Phone */}
                                    {/* <div className="w-full">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                        Alternate Phone Number
                    </label>
                    <input
                        type="text"
                        name="alternatePhone"
                        maxLength="10"
                        value={formData.alternatePhone}
                        onChange={handleChange}
                        placeholder="Enter alternate number"
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                    />
                    {errors.alternatePhone && (
                        <p className="mt-1 text-sm text-red-500">{errors.alternatePhone}</p>
                    )}
                </div> */}
                                </div>
                            </div>

                            {/* Role & Company */}
                            <div className="rounded-2xl bg-white p-8 shadow-sm mb-6">
                                <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Role &amp; Company</h2>
                                <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">

                                    {/* Role dropdown */}
                                    <div className="w-full">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Role <span className="text-red-500 text-[16px]">*</span>
                                        </label>
                                        <Select
                                            instanceId="add-user-role-select"
                                            options={groups.map((g) => ({ value: String(g.groupId), label: g.groupName }))}
                                            value={formData.groupId ? { value: formData.groupId, label: groups.find(g => String(g.groupId) === formData.groupId)?.groupName } : null}
                                            onChange={(selected) => {
                                                setFormData((prev) => ({ ...prev, groupId: selected ? selected.value : "" }));
                                                setErrors((prev) => ({ ...prev, groupId: "" }));
                                            }}
                                            isClearable
                                            isSearchable
                                            placeholder="Search and select role..."
                                            classNamePrefix="react-select"
                                            styles={{
                                                control: (base) => ({
                                                    ...base,
                                                    borderRadius: "0.75rem",
                                                    borderColor: errors.groupId ? "#ef4444" : "#d1d5db",
                                                    padding: "4px",
                                                    boxShadow: "none",
                                                    "&:hover": { borderColor: "#3b82f6" },
                                                }),
                                            }}
                                        />
                                        {errors.groupId && <p className="mt-1 text-sm text-red-500">{errors.groupId}</p>}
                                    </div>

                                    {/* Company dropdown */}
                                    <div className="w-full">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Company <span className="text-red-500 text-[16px]">*</span>
                                        </label>
                                        <Select
                                            instanceId="add-user-company-select"
                                            options={companies.map((c) => ({ value: String(c.companyId), label: c.companyName }))}
                                            value={formData.companyId ? { value: formData.companyId, label: companies.find(c => String(c.companyId) === formData.companyId)?.companyName } : null}
                                            onChange={(selected) => {
                                                setFormData((prev) => ({ ...prev, companyId: selected ? selected.value : "" }));
                                                setErrors((prev) => ({ ...prev, companyId: "" }));
                                            }}
                                            isClearable
                                            isSearchable
                                            placeholder="Search and select company..."
                                            classNamePrefix="react-select"
                                            styles={{
                                                control: (base) => ({
                                                    ...base,
                                                    borderRadius: "0.75rem",
                                                    borderColor: errors.companyId ? "#ef4444" : "#d1d5db",
                                                    padding: "4px",
                                                    boxShadow: "none",
                                                    "&:hover": { borderColor: "#3b82f6" },
                                                }),
                                            }}
                                        />
                                        {errors.companyId && <p className="mt-1 text-sm text-red-500">{errors.companyId}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Status (moved to last) */}
                            <div className="rounded-2xl bg-white p-8 shadow-sm mb-6">
                                <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Status</h2>
                                <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
                                    <div className="w-full">
                                        <label className="mb-2 block text-sm font-medium text-gray-700">
                                            Status <span className="text-red-500 text-[16px]">*</span>
                                        </label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 flex justify-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => onBack()}
                                    className="inline-flex min-w-[150px] items-center justify-center rounded-xl border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 active:scale-[0.98] cursor-pointer"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="inline-flex min-w-[150px] items-center justify-center rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 active:scale-[0.98] cursor-pointer"
                                >
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div >
            </div >
        </RouteGuard>
    );
}