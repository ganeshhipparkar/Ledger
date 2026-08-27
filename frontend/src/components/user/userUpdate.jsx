"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { UpdateFormSchema } from "../Zod";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import Header from "../Header";
import dayjs from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DesktopDatePicker } from "@mui/x-date-pickers/DesktopDatePicker";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Select from "react-select";
import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";

const MySwal = withReactContent(Swal);

const MAX_DOB = dayjs().subtract(18, "year");

function getInitials(name) {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function EditUserPage({ user, onBack }) {
    const router = useRouter();

    const gotoPages = async (e, url) => {
        e.stopPropagation();
        e.preventDefault();
        if (url === "/user") {
            onBack();
        } else {
            router.push(url);
        }
    };


    const [formData, setFormData] = useState({
        name: "",
        firstName: "",
        middleName: "",
        surname: "",
        email: "",
        remarks: "",
        phone: "",
        dialCode: "",
        status: user?.user_status || "",
        tel: "",
        userId: "",
        dob: MAX_DOB,
        isActive: "true",
        userFile: null,
        alternatePhone: "",
    });

    // Flat single company + group selection
    const [companyId, setCompanyId] = useState("");
    const [groupId, setGroupId] = useState("");

    const [preview, setPreview] = useState("");
    const [imageRemoved, setImageRemoved] = useState(false);
    const fileInputRef = useRef(null);
    const [groups, setGroups] = useState([]);
    const [companies, setCompanies] = useState([]);
    const { isLogin } = useContext(loginContext);
    const [countryCode, setCountryCode] = useState("in");

    const [errors, setErrors] = useState({
        email: "",
        name: "",
        firstName: "",
        middleName: "",
        surname: "",
        dob: "",
        phone: "",
        userFile: "",
        alternatePhone: "",
        companyId: "",
        groupId: "",
    });

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "POST",
                    headers: { ...authHeaders(), endpoint: "group-dropdown-list", module: "group" },
                    body: JSON.stringify({ page: 1, limit: 200 }),
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                setGroups(data?.data || []);
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
                    headers: { ...authHeaders(), endpoint: "company-list", module: "company" },
                    body: JSON.stringify({ page: 1, limit: 200 }),
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                setCompanies(data?.data || []);
            } catch (err) {
                toast.error(`${err}`, { position: "top-right" });
            }
        };
        fetchCompanies();
    }, []);
    // Populate form from user prop
    useEffect(() => {
        if (!user) return;

        const savedDialCode = user.user_dialCode || "91";
        const savedPhone = user.user_phone || "";
        if (savedPhone) {
            const parsed = parsePhoneNumberFromString(`+${savedDialCode}${savedPhone}`);
            if (parsed?.country) {
                setCountryCode(parsed.country.toLowerCase());
            }
        }

        const parsedDob = user.user_dob
            ? dayjs(user.user_dob)
            : (user.dob ? dayjs(user.dob) : MAX_DOB);

        setFormData({
            name: user.user_name || "",
            firstName: user.firstName || "",
            middleName: user.middleName || "",
            surname: user.surname || "",
            email: user.user_email || "",
            remarks: user.user_remarks || "",
            phone: String(user.user_phone || ""),
            dialCode: String(user.user_dialCode || "91"),
            status: user.user_status || "Active",
            tel: user.user_tel || "",
            userId: user.user_userId || "",
            dob: parsedDob,
            isActive:
                user.user_isActive !== undefined ? String(user.user_isActive) : "true",
            userFile: null,
            alternatePhone: user.user_alternatePhone || "",
        });

        setPreview(
            user.user_userFile
                ? `http://localhost:4000/upload/user/${user.user_userId}/${user.user_userFile}`

                : ""
        );

        // Prefer activeAssignment from the backend (scope-aware, set by getUser fix 2)
        // over the client-side is_parent===0 fallback, which always picks the global
        // primary regardless of the viewing admin's company scope.
        const primary =
            user.activeAssignment ??
            user.assignments?.find((a) => a.is_parent === 0) ??
            user.assignments?.[0] ??
            null;

        if (primary) {
            if (primary.groupId) setGroupId(String(primary.groupId));
            if (primary.companyId) setCompanyId(String(primary.companyId));
        }

    }, [user]);

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
            setImageRemoved(false);
        }
    };

    const handleRemoveImage = async () => {
        const result = await Swal.fire({
            title: 'Remove Profile Photo?',
            text: "This will delete the current image. You can upload a new one later.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, remove it!'
        });

        if (result.isConfirmed) {
            setFormData((prev) => ({ ...prev, userFile: null }));
            setPreview("");
            setImageRemoved(true);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "Do you want to save the changes to this user?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, update it!'
        });

        if (result.isConfirmed) {
            const isPhoneValid =
                !!formData.phone &&
                isValidPhoneNumber(formData.phone, (countryCode || "in").toUpperCase());

            const result = UpdateFormSchema.safeParse(formData);

            let hasSelectionError = false;
            const selectionErrors = { companyId: "", groupId: "" };
            if (!companyId) {
                selectionErrors.companyId = "Please select a company.";
                hasSelectionError = true;
            }
            if (!groupId) {
                selectionErrors.groupId = "Please select a role.";
                hasSelectionError = true;
            }


            if (hasSelectionError || !isPhoneValid) {
                setErrors((prev) => ({ ...prev, ...selectionErrors }));
                if (!isPhoneValid) {
                    setErrors((prev) => ({ ...prev, phone: "Enter a valid phone number for the selected country" }));
                }
                return;
            }

            try {
                if (!result.success) {
                    const fieldErrors = {
                        email: "",
                        name: "",
                        firstName: "",
                        middleName: "",
                        surname: "",
                        dob: "",
                        status: "",
                        phone: "",
                        userFile: "",
                        alternatePhone: "",
                        companyId: "",
                        groupId: "",
                    };
                    result.error.issues.forEach((err) => {
                        if (err.path[0]) fieldErrors[err.path[0]] = err.message;
                    });
                    setErrors(fieldErrors);
                    return;
                }

                const payload = new FormData();
                // payload.append("name", formData.name);
                payload.append("firstName", formData.firstName);
                payload.append("middleName", formData.middleName);
                payload.append("surname", formData.surname);
                // payload.append("email", formData.email);
                payload.append("phone", formData.phone);
                payload.append("dialCode", formData.dialCode);
                payload.append("status", formData.status);
                payload.append("dob", formData.dob ? formData.dob.format("YYYY-MM-DD") : "");
                payload.append("userId", formData.userId);
                payload.append("remarks", formData.remarks || "");
                payload.append("isActive", formData.isActive);
                payload.append("companyId", companyId);
                payload.append("updatedBy", isLogin?.userId || null)
                payload.append("groupId", groupId);
                if (formData.userFile) {
                    payload.append("userFile", formData.userFile);
                }
                if (imageRemoved && !formData.userFile) {
                    payload.append("removeUserFile", "true");
                }


                const response = await fetch("/relayapi", {
                    method: "PUT",
                    headers: {
                        endpoint: "user-update",
                        module: 'user',
                    },
                    body: payload,
                });

                const resJson = await response.json();
                const data = resJson.encrypted ? decryptResponse(resJson.encrypted) : resJson;

                if (data?.success != undefined && data?.success == 0) {
                    toast.error(`Update failed: ${data?.message}`, { position: "top-right" });
                } else if (data?.statusCode != undefined && data?.statusCode != 200) {
                    toast.error(`Update failed: ${data?.message}`, { position: "top-right" });
                } else {
                    if (response.ok) {
                        toast.success("User profile updated successfully", { position: "top-right" });
                        setTimeout(() => onBack(), 1000);
                    } else {
                        toast.error(`Update failed: ${data?.message}`, { position: "top-right" });
                    }
                }
            } catch (error) {
                toast.error(`${error}`, { position: "top-right" });
            }
        }
    };

    if (!user) {
        return (
            <div className="flex min-h-screen items-center justify-center">Loading...</div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-[#f5f6f8] text-black">
            <Header page="user-edit" />

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
                <span
                    className="cursor-pointer transition-colors hover:text-blue-600 hover:underline"
                    onClick={(e) => gotoPages(e, "/user")}
                >
                    User
                </span>
                <span className="text-gray-400">{">>"}</span>
                <span className="text-gray-800 cursor-pointer">Update</span>
            </nav>

            <div className="px-6">
                <div className="mb-8 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">Edit User</h1>
                    {/* {onBack && (
                        <button
                            onClick={async () => {
                                const result = await MySwal.fire({
                                    title: "Discard changes?",
                                    text: "Any unsaved data will be lost.",
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonColor: "#d33",
                                    cancelButtonColor: "#6b7280",
                                    confirmButtonText: "Yes, go back",
                                    cancelButtonText: "Stay",
                                });
                                if (result.isConfirmed) onBack();
                            }}
                            className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 active:scale-[0.98] cursor-pointer"
                        >
                            ← Back
                        </button>
                    )} */}
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
                                        User Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        readOnly
                                        value={formData.name}
                                        // onChange={handleChange}
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

                                {/* Password (moved here from Contact Info) */}
                                <div className="w-full">
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        name="email"
                                        readOnly
                                        value="abcdef@12"
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                                    />
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
                                <div className="w-full">
                                    <label className="mb-2 block text-sm font-medium text-gray-700">
                                        Profile Image
                                    </label>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImage}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3"
                                    />
                                    {errors.userFile && (
                                        <p className="mt-1 text-sm text-red-500">{errors.userFile}</p>
                                    )}
                                    {preview && (
                                        <div className="relative mt-4 h-24 w-24 rounded-full border bg-gray-100">
                                            <img
                                                src={preview}
                                                alt="preview"
                                                className="h-full w-full object-cover rounded-full"
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
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        readOnly
                                        value={formData.email}
                                        onChange={handleChange}
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
                                        key={`${formData.dialCode}-${formData.phone}`}
                                        country={countryCode}
                                        value={`+${formData.dialCode}${formData.phone}`}
                                        onChange={(value, countryData) => {
                                            const dialCode = countryData.dialCode;
                                            const phone = value.slice(dialCode.length);
                                            setCountryCode(countryData.countryCode);
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
                                {/* Remarks */}
                                <div className="w-full">
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
                        type="tel"
                        name="alternatePhone"
                        maxLength="10"
                        value={formData.alternatePhone}
                        onChange={handleChange}
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
                                        instanceId="user-update-role-select"
                                        options={groups.map((g) => ({ value: String(g.groupId), label: g.groupName }))}
                                        value={groupId && groups.length > 0
                                            ? { value: groupId, label: groups.find(g => String(g.groupId) === String(groupId))?.groupName || "" }
                                            : null
                                        }
                                        onChange={(selected) => {
                                            setGroupId(selected ? selected.value : "");
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
                                        instanceId="user-update-company-select"
                                        options={companies.map((c) => ({ value: String(c.companyId), label: c.companyName }))}
                                        value={companyId && companies.length > 0
                                            ? { value: companyId, label: companies.find(c => String(c.companyId) === String(companyId))?.companyName || "" }
                                            : null
                                        }
                                        onChange={(selected) => {
                                            setCompanyId(selected ? selected.value : "");
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
                                    {errors.status && <p className="mt-1 text-sm text-red-500">{errors.status}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 flex justify-center gap-4">
                            <button
                                type="button"
                                onClick={async () => {
                                    const result = await MySwal.fire({
                                        title: "Discard changes?",
                                        text: "Any unsaved data will be lost.",
                                        icon: "warning",
                                        showCancelButton: true,
                                        confirmButtonColor: "#d33",
                                        cancelButtonColor: "#6b7280",
                                        confirmButtonText: "Yes, discard",
                                        cancelButtonText: "Stay",
                                    });
                                    if (result.isConfirmed) onBack();
                                }}
                                className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-8 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 active:scale-[0.98] cursor-pointer"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="inline-flex h-12 w-[150px] items-center justify-center rounded-xl bg-blue-600 px-8 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 active:scale-[0.98] cursor-pointer"
                            >
                                Submit
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}