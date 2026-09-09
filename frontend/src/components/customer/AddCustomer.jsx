"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import Header from "../Header";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { CustomerFormSchema } from "../Zod";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { City, Country, State } from "country-state-city";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { loginContext } from "../hooks/LoginContext";

const MySwal = withReactContent(Swal);

export default function AddCustomer() {
    const router = useRouter();
    const { displayUser, activeAssignment } = useContext(loginContext) || {};

    const isSuperAdmin = displayUser?.primaryProfile?.groupName === "superAdmin" || activeAssignment?.groupName === "superAdmin";

    const [customerCountryCode, setCustomerCountryCode] = useState("in");
    const [ownerCountryCode, setOwnerCountryCode] = useState("in");

    const [formData, setFormData] = useState({
        customerName: "",
        customerEmail: "",
        customerIncorporationDate: "",
        dialCode: "",
        phone: "",
        companyId: "",
        country: "",
        state: "",
        city: "",
        AddressLineOne: "",
        postalCode: "",
        ownerFirstName: "",
        ownerLastName: "",
        ownerEmail: "",
        ownerPhone: "",
        ownerDialCode: "",
        ownerDob: "",
        status: "Active",
        curIds: [],
    });

    const [customerLogoFile, setCustomerLogoFile] = useState(null);
    const [preview, setPreview] = useState("");
    const fileInputRef = useRef(null);

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const [countries] = useState(Country.getAllCountries());
    const [states, setStates] = useState([]);
    const [cities, setCities] = useState([]);

    const [companies, setCompanies] = useState([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);
    const [companyCurrencies, setCompanyCurrencies] = useState([]);
    const [currenciesLoading, setCurrenciesLoading] = useState(false);

    useEffect(() => {
        if (!isSuperAdmin && activeAssignment?.companyId) {
            setFormData((prev) => ({
                ...prev,
                companyId: String(activeAssignment.companyId),
            }));
        }
        if (isSuperAdmin) {
            fetchCompanies();
        }
    }, [displayUser, activeAssignment]);

    useEffect(() => {
        if (formData.country) {
            setStates(State.getStatesOfCountry(formData.country));
            setFormData((prev) => ({ ...prev, state: "", city: "" }));
            setCities([]);
        } else {
            setStates([]);
            setCities([]);
        }
    }, [formData.country]);

    useEffect(() => {
        if (formData.country && formData.state) {
            setCities(City.getCitiesOfState(formData.country, formData.state));
            setFormData((prev) => ({ ...prev, city: "" }));
        } else {
            setCities([]);
        }
    }, [formData.state, formData.country]);

    useEffect(() => {
        if (!formData.companyId) {
            setCompanyCurrencies([]);
            return;
        }
        fetchCompanyCurrencies(formData.companyId);
    }, [formData.companyId]);

    const fetchCompanyCurrencies = async (companyId) => {
        setCurrenciesLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `company-currencies/${companyId}`,
                    module: "customer",
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            const currencyList = Array.isArray(data?.data)
                ? data.data
                : (Array.isArray(data) ? data : []);
            setCompanyCurrencies(currencyList);
        } catch (err) {
            console.error("Failed to load company currencies:", err);
            setCompanyCurrencies([]);
        } finally {
            setCurrenciesLoading(false);
        }
    };

    const fetchCompanies = async () => {
        setCompaniesLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    ...authHeaders(),
                    endpoint: "company-list",
                    module: "company",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ page: 1, limit: 500, filters: [{ key: "status", value: "Active", operator: "=" }], condition: "All" }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setCompanies(data?.data ?? []);
        } catch {
            toast.error("Failed to load companies.", { position: "top-right" });
        } finally {
            setCompaniesLoading(false);
        }
    };

    const gotoPages = async (e, url) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        router.push(url);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === "postalCode" && value !== "" && !/^\d+$/.test(value)) {
            return;
        }
        if (name === "companyId") {
            setFormData((prev) => ({ ...prev, [name]: value, curIds: [] }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
        setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleImage = (e) => {
        const file = e?.target?.files[0];
        if (!file) return;
        setErrors((prev) => ({ ...prev, customerLogo: "" }));
        setCustomerLogoFile(file);
        setPreview(URL.createObjectURL(file));
    };

    const handleRemoveImage = async () => {
        const result = await MySwal.fire({
            title: "Remove Customer Logo?",
            text: "This will discard the selected logo.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, remove it!",
        });

        if (result.isConfirmed) {
            setCustomerLogoFile(null);
            setPreview("");
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const onBack = async () => {
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
        if (result.isConfirmed) router.push("/customer-list");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payloadToValidate = {
            ...formData,
            companyId: formData.companyId ? Number(formData.companyId) : undefined,
            dialCode: formData.dialCode ? Number(formData.dialCode) : undefined,
            postalCode: formData.postalCode ? Number(formData.postalCode) : undefined,
            ownerDialCode: formData.ownerDialCode ? Number(formData.ownerDialCode) : undefined,
        };

        const parseRes = CustomerFormSchema.safeParse(payloadToValidate);
        if (!parseRes.success) {
            const fieldErrors = {};
            parseRes.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) {
                    fieldErrors[field] = err.message;
                }
            });
            setErrors(fieldErrors);
            return;
        }

        const confirmRes = await MySwal.fire({
            title: "Register New Customer?",
            text: "Are you sure you want to add this customer to the system?",
            icon: "info",
            showCancelButton: true,
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, add it!",
            cancelButtonText: "Cancel",
        });
        if (!confirmRes.isConfirmed) return;

        setLoading(true);
        try {
            const payload = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                if (value !== "" && value !== null && value !== undefined) {
                    if (key === "curIds") {
                        payload.append(key, JSON.stringify(value));
                    } else {
                        payload.append(key, String(value));
                    }
                }
            });

            if (customerLogoFile) {
                payload.append("customerLogo", customerLogoFile);
            }

            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    endpoint: "customer-add",
                    module: "customer",
                },
                body: payload,
            });
            const resPayload = await res.json();
            const data = resPayload.encrypted ? decryptResponse(resPayload.encrypted) : resPayload;

            if (data?.success === 1) {
                toast.success("Customer created successfully", { position: "top-right" });
                router.push("/customer-list");
            } else {
                const msg = data?.message || "Failed to create customer.";
                setErrors({ global: msg });
                toast.error(msg, { position: "top-right" });
            }
        } catch (err) {
            console.error(err);
            toast.error(`${err}`, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 text-sm";
    const labelClass = "mb-2 block text-sm font-medium text-gray-700";
    const errorClass = "mt-1 text-sm text-red-500";

    return (
        <div className="min-h-screen w-full bg-[#f5f6f8] text-black">
            <Header page="customer-add" />

            <nav className="p-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={(e) => gotoPages(e, "/")}>Home</span>
                <span className="text-gray-400">{">>"}</span>
                <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={(e) => gotoPages(e, "/customer-list")}>Customers</span>
                <span className="text-gray-400">{">>"}</span>
                <span className="text-gray-800 cursor-pointer">Add Customer</span>
            </nav>

            <div className="px-6">
                <div className="mb-8 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">Add Customer</h1>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-6">

                        {/* Basic Information */}
                        <div className="rounded-2xl bg-white p-8 shadow-sm">
                            <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Basic Information</h2>
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                                <div>
                                    <label className={labelClass}>Customer Name <span className="text-red-500">*</span></label>
                                    <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} placeholder="Enter customer name" className={inputClass} />
                                    {errors.customerName && <p className={errorClass}>{errors.customerName}</p>}
                                </div>

                                <div>
                                    <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                                    <input type="email" name="customerEmail" value={formData.customerEmail} onChange={handleChange} placeholder="customer@email.com" className={inputClass} />
                                    {errors.customerEmail && <p className={errorClass}>{errors.customerEmail}</p>}
                                </div>

                                <div>
                                    <label className={labelClass}>Incorporation Date <span className="text-red-500">*</span></label>
                                    <input type="date" name="customerIncorporationDate" value={formData.customerIncorporationDate} max={new Date().toISOString().split("T")[0]} onChange={handleChange} className={inputClass} />
                                    {errors.customerIncorporationDate && <p className={errorClass}>{errors.customerIncorporationDate}</p>}
                                </div>

                                <div>
                                    <label className={labelClass}>Company <span className="text-red-500">*</span></label>
                                    {isSuperAdmin ? (
                                        <select
                                            name="companyId"
                                            value={formData.companyId}
                                            onChange={handleChange}
                                            disabled={companiesLoading}
                                            className={inputClass}
                                        >
                                            <option value="">Please select Company</option>
                                            {companies.map((c) => (
                                                <option key={c.companyId} value={c.companyId}>
                                                    {c.companyName}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            readOnly
                                            value={activeAssignment?.companyName || "Your Company"}
                                            className="w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed"
                                        />
                                    )}
                                    {errors.companyId && <p className={errorClass}>{errors.companyId}</p>}
                                </div>

                                {/* Logo */}
                                <div>
                                    <label className={labelClass}>Customer Logo</label>
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImage} className={inputClass} />
                                    {errors.customerLogo && <p className={errorClass}>{errors.customerLogo}</p>}
                                    {preview && (
                                        <div className="relative mt-4 h-24 w-24 rounded-xl border bg-gray-100">
                                            <img
                                                src={preview}
                                                alt="preview"
                                                className="h-full w-full object-cover rounded-xl"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                aria-label="Remove selected logo"
                                                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow hover:bg-red-600 z-10 cursor-pointer"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Currency */}
                                <div>
                                    <label className={labelClass}>Currency <span className="text-red-500">*</span></label>
                                    <Select
                                        name="curIds"
                                        instanceId="add-customer-currency-select"
                                        isMulti
                                        isLoading={currenciesLoading}
                                        options={companyCurrencies.map((c) => ({
                                            value: c.curId,
                                            label: `(${c.code}) ${c.symbol} - ${c.name || ""}`,
                                        }))}
                                        value={companyCurrencies
                                            .filter((c) => formData.curIds.includes(c.curId))
                                            .map((c) => ({
                                                value: c.curId,
                                                label: `(${c.code}) ${c.symbol} - ${c.name || ""}`,
                                            }))}
                                        onChange={(selected) => {
                                            const selectedIds = selected ? selected.map((s) => s.value) : [];
                                            setFormData((prev) => ({
                                                ...prev,
                                                curIds: selectedIds,
                                            }));
                                            setErrors((prev) => ({ ...prev, curIds: "" }));
                                        }}
                                        isSearchable
                                        isClearable
                                        placeholder={formData.companyId ? "Select currencies" : "Please select a company first"}
                                        isDisabled={!formData.companyId}
                                        classNamePrefix="react-select"
                                    />
                                    {errors.curIds && <p className={errorClass}>{errors.curIds}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div className="rounded-2xl bg-white p-8 shadow-sm">
                            <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Contact Information</h2>
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="w-full">
                                    <label className={labelClass}>Phone <span className="text-red-500">*</span></label>
                                    <PhoneInput
                                        country={customerCountryCode}
                                        value={formData.phone ? `+${formData.dialCode}${formData.phone}` : ""}
                                        onChange={(value, countryData) => {
                                            const dial = countryData?.dialCode || "";
                                            const phone = value.slice(dial.length);
                                            setCustomerCountryCode(countryData?.countryCode);
                                            setFormData((prev) => ({ ...prev, phone, dialCode: dial }));
                                            setErrors((prev) => ({ ...prev, phone: "" }));
                                        }}
                                        inputStyle={{
                                            width: "100%",
                                            height: "50px",
                                            borderRadius: "0.75rem",
                                            border: errors.phone ? "1px solid #ef4444" : "1px solid #d1d5db",
                                            fontSize: "14px",
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
                                    {errors.phone && (<p className={errorClass}>{errors.phone}</p>)}
                                </div>
                            </div>
                        </div>

                        {/* Address */}
                        <div className="rounded-2xl bg-white p-8 shadow-sm">
                            <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Address</h2>
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                                <div>
                                    <label className={labelClass}>Country <span className="text-red-500">*</span></label>
                                    <Select
                                        name="country"
                                        instanceId="add-customer-country-select"
                                        options={countries.map((c) => ({ value: c.isoCode, label: `${c.flag} ${c.name}` }))}
                                        value={countries
                                            .filter((c) => c.isoCode === formData.country)
                                            .map((c) => ({ value: c.isoCode, label: `${c.flag} ${c.name}` }))[0] || null}
                                        onChange={(selected) => {
                                            setFormData((prev) => ({ ...prev, country: selected ? selected.value : "", state: "", city: "" }));
                                            setErrors((prev) => ({ ...prev, country: "" }));
                                        }}
                                        isSearchable
                                        isClearable
                                        placeholder="Select Country"
                                        classNamePrefix="react-select"
                                    />
                                    {errors.country && <p className={errorClass}>{errors.country}</p>}
                                </div>

                                <div>
                                    <label className={labelClass}>State <span className="text-red-500">*</span></label>
                                    <Select
                                        name="state"
                                        instanceId="add-customer-state-select"
                                        options={states.map((s) => ({ value: s.isoCode, label: s.name }))}
                                        value={states
                                            .filter((s) => s.isoCode === formData.state)
                                            .map((s) => ({ value: s.isoCode, label: s.name }))[0] || null}
                                        onChange={(selected) => {
                                            setFormData((prev) => ({ ...prev, state: selected ? selected.value : "", city: "" }));
                                            setErrors((prev) => ({ ...prev, state: "" }));
                                        }}
                                        isDisabled={!formData.country}
                                        isSearchable
                                        isClearable
                                        placeholder="Select State"
                                        classNamePrefix="react-select"
                                    />
                                    {errors.state && <p className={errorClass}>{errors.state}</p>}
                                </div>

                                <div>
                                    <label className={labelClass}>City</label>
                                    <CreatableSelect
                                        name="city"
                                        instanceId="add-customer-city-select"
                                        options={cities.map((city) => ({ value: city.name, label: city.name }))}
                                        value={formData.city ? { value: formData.city, label: formData.city } : null}
                                        onChange={(selected) => {
                                            setFormData((prev) => ({ ...prev, city: selected ? selected.value : "" }));
                                            setErrors((prev) => ({ ...prev, city: "" }));
                                        }}
                                        isDisabled={!formData.state}
                                        isSearchable
                                        isClearable
                                        placeholder="Select or Type City"
                                        classNamePrefix="react-select"
                                        formatCreateLabel={(inputValue) => `Use custom city "${inputValue}"`}
                                    />
                                    {errors.city && (<p className={errorClass}>{errors.city}</p>)}

                                </div>

                                <div>
                                    <label className={labelClass}>Address Line 1</label>
                                    <input type="text" name="AddressLineOne" value={formData.AddressLineOne} disabled={!formData.country || !formData.state} onChange={handleChange} placeholder="Enter Address Line 1" className={inputClass} />
                                    {errors.AddressLineOne && (<p className={errorClass}>{errors.AddressLineOne}</p>)}

                                </div>

                                <div>
                                    <label className={labelClass}>Postal Code</label>
                                    <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="Enter Postal Code" className={inputClass} />
                                    {errors.postalCode && (<p className={errorClass}>{errors.postalCode}</p>)}

                                </div>

                            </div>
                        </div>

                        {/* Owner Information */}
                        <div className="rounded-2xl bg-white p-8 shadow-sm">
                            <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Owner Information</h2>
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                                <div>
                                    <label className={labelClass}>Owner First Name <span className="text-red-500">*</span></label>
                                    <input type="text" name="ownerFirstName" value={formData.ownerFirstName} onChange={handleChange} placeholder="Owner first name" className={inputClass} />
                                    {errors.ownerFirstName && <p className={errorClass}>{errors.ownerFirstName}</p>}
                                </div>

                                <div>
                                    <label className={labelClass}>Owner Last Name <span className="text-red-500">*</span></label>
                                    <input type="text" name="ownerLastName" value={formData.ownerLastName} onChange={handleChange} placeholder="Owner last name" className={inputClass} />
                                    {errors.ownerLastName && <p className={errorClass}>{errors.ownerLastName}</p>}
                                </div>

                                <div>
                                    <label className={labelClass}>Owner Email <span className="text-red-500">*</span></label>
                                    <input type="email" name="ownerEmail" value={formData.ownerEmail} onChange={handleChange} placeholder="owner@email.com" className={inputClass} />
                                    {errors.ownerEmail && <p className={errorClass}>{errors.ownerEmail}</p>}
                                </div>

                                <div className="w-full">
                                    <label className={labelClass}>Owner Phone <span className="text-red-500">*</span></label>
                                    <PhoneInput
                                        country={ownerCountryCode}
                                        value={formData.ownerPhone ? `+${formData.ownerDialCode}${formData.ownerPhone}` : ""}
                                        onChange={(value, countryData) => {
                                            const dial = countryData?.dialCode || "";
                                            const phone = value.slice(dial.length);
                                            setOwnerCountryCode(countryData?.countryCode);
                                            setFormData((prev) => ({ ...prev, ownerPhone: phone, ownerDialCode: dial }));
                                            setErrors((prev) => ({ ...prev, ownerPhone: "" }));
                                        }}
                                        inputStyle={{
                                            width: "100%",
                                            height: "50px",
                                            borderRadius: "0.75rem",
                                            border: errors.ownerPhone ? "1px solid #ef4444" : "1px solid #d1d5db",
                                            fontSize: "14px",
                                        }}
                                        buttonStyle={{
                                            borderRadius: "0.75rem 0 0 0.75rem",
                                            border: errors.ownerPhone ? "1px solid #ef4444" : "1px solid #d1d5db",
                                            background: "#f9fafb",
                                        }}
                                        containerStyle={{ width: "100%" }}
                                        enableSearch
                                        searchPlaceholder="Search country..."
                                    />
                                    {errors.ownerPhone && (<p className={errorClass}>{errors.ownerPhone}</p>)}
                                </div>

                                <div>
                                    <label className={labelClass}>Owner Date of Birth <span className="text-red-500">*</span></label>
                                    <input type="date" name="ownerDob" value={formData.ownerDob} max={new Date().toISOString().split("T")[0]} onChange={handleChange} className={inputClass} />
                                    {errors.ownerDob && <p className={errorClass}>{errors.ownerDob}</p>}
                                </div>

                            </div>
                        </div>

                        {/* Status */}
                        <div className="rounded-2xl bg-white p-8 shadow-sm mb-6">
                            <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Status</h2>
                            <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="w-full">
                                    <label className={labelClass}>
                                        Status <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className={inputClass}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                    {errors.status && <p className={errorClass}>{errors.status}</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 mb-10 flex justify-center gap-4">
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-6 py-2 rounded-md font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer rounded-xl bg-blue-600 px-8 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition"
                        >
                            {loading ? "Creating..." : "Add Customer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
