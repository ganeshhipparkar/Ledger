"use client";
import Link from "next/link";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import Header from "../Header";
import Loader from "../ui/Loader";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import dynamic from "next/dynamic";
import { getImageUrl } from "@/lib/utils";
import "react-phone-input-2/lib/style.css";

const PhoneInput = dynamic(
    () => import("react-phone-input-2").then((mod) => mod.default?.default || mod.default || mod),
    { ssr: false }
);
import { City, Country, State } from "country-state-city";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { loginContext } from "../hooks/LoginContext";
import { customerFormConfig } from "./configs/customerForm.config";

const MySwal = withReactContent(Swal);

export default function CustomerFormPage({ context = "customer-add", id, onBack }) {
    const router = useRouter();
    const config = customerFormConfig.contexts[context];
    if (!config) {
        throw new Error(`CustomerFormPage: Unknown context "${context}"`);
    }

    const isUpdate = config.mode === "update";
    const { displayUser, activeAssignment } = useContext(loginContext) || {};
    const isSuperAdmin = displayUser?.primaryProfile?.groupCode === "admin" || activeAssignment?.groupCode === "admin";

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isUpdate);
    const [errors, setErrors] = useState({});

    const [customerCountryCode, setCustomerCountryCode] = useState(
        () => (process.env.NEXT_PUBLIC_CUSTOMER_DIALCODE || "in").toLowerCase()
    );
    const [ownerCountryCode, setOwnerCountryCode] = useState(
        () => (process.env.NEXT_PUBLIC_OWNER_DIALCODE || "in").toLowerCase()
    );
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const getCountryCodeByDialCode = (dialCode) => {
        if (!dialCode) return "in";
        const cleanDial = String(dialCode).replace("+", "").trim();
        const allCountries = Country.getAllCountries();
        const found = allCountries.find((c) => c.phonecode === cleanDial);
        return found ? found.isoCode.toLowerCase() : "in";
    };

    const buildInitialFormData = () => {
        const initial = {
            dialCode: "",
            ownerDialCode: "",
        };
        config.sections.forEach((section) => {
            section.fields.forEach((field) => {
                initial[field.name] = field.defaultValue !== undefined ? field.defaultValue : "";
            });
        });
        return initial;
    };

    const [formData, setFormData] = useState(buildInitialFormData);
    const [fetchedCompanyName, setFetchedCompanyName] = useState("");

    const [customerLogoFile, setCustomerLogoFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [removeCustomerLogo, setRemoveCustomerLogo] = useState(false);
    const fileInputRef = useRef(null);

    const [companies, setCompanies] = useState([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);
    const [companyCurrencies, setCompanyCurrencies] = useState([]);
    const [currenciesLoading, setCurrenciesLoading] = useState(false);

    const countries = useMemo(() => Country.getAllCountries(), []);
    const states = useMemo(() => (formData.country ? State.getStatesOfCountry(formData.country) : []), [formData.country]);
    const cities = useMemo(
        () => (formData.country && formData.state ? City.getCitiesOfState(formData.country, formData.state) : []),
        [formData.country, formData.state]
    );

    const maxIncorporationDate = new Date().toISOString().split("T")[0];
    const maxOwnerDobString = useMemo(() => {
        const maxOwnerDob = new Date();
        const year = maxOwnerDob.getFullYear() - 15;
        const month = String(maxOwnerDob.getMonth() + 1).padStart(2, "0");
        const day = String(maxOwnerDob.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }, []);

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
                body: JSON.stringify({
                    page: 1,
                    limit: 500,
                    filters: [{ key: "status", value: "Active", operator: "=" }],
                    condition: "All",
                }),
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
                : Array.isArray(data)
                ? data
                : [];
            setCompanyCurrencies(currencyList);
        } catch (err) {
            console.error("Failed to load company currencies:", err);
            setCompanyCurrencies([]);
        } finally {
            setCurrenciesLoading(false);
        }
    };

    const fetchCustomer = async () => {
        setFetching(true);
        try {
            const numericId = Number(Array.isArray(id) ? id[0] : id);
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `customer-details/${numericId}`,
                    module: "customer",
                },
            });
            const resJson = await res.json();
            const data = resJson?.encrypted ? decryptResponse(resJson.encrypted) : resJson;
            if (data?.customerId) {
                let countryIso = "";
                let stateIso = "";
                if (data.country) {
                    const allCountries = Country.getAllCountries();
                    const matchedCountry = allCountries.find(
                        (c) => c.name === data.country || c.isoCode === data.country
                    );
                    if (matchedCountry) {
                        countryIso = matchedCountry.isoCode;
                        if (data.state) {
                            const allStates = State.getStatesOfCountry(matchedCountry.isoCode);
                            const matchedState = allStates.find(
                                (s) => s.name === data.state || s.isoCode === data.state
                            );
                            if (matchedState) {
                                stateIso = matchedState.isoCode;
                            }
                        }
                    }
                }

                setFormData({
                    customerName: data.customerName || "",
                    customerCode: data.customerCode || "",
                    customerEmail: data.customerEmail || "",
                    customerIncorporationDate: data.customerIncorporationDate
                        ? data.customerIncorporationDate.split("T")[0]
                        : "",
                    dialCode: data.dialCode ? String(data.dialCode) : "",
                    phone: data.phone || "",
                    companyId: String(data.companyId || ""),
                    country: countryIso,
                    state: stateIso,
                    city: data.city || "",
                    AddressLineOne: data.AddressLineOne || "",
                    postalCode: data.postalCode ? String(data.postalCode) : "",
                    ownerFirstName: data.ownerFirstName || "",
                    ownerLastName: data.ownerLastName || "",
                    ownerEmail: data.ownerEmail || "",
                    ownerPhone: data.ownerPhone || "",
                    ownerDialCode: data.ownerDialCode ? String(data.ownerDialCode) : "",
                    ownerDob: data.ownerDob ? data.ownerDob.split("T")[0] : "",
                    status: data.status || "Active",
                    curIds: data.curIds || [],
                });

                if (data.companyName) {
                    setFetchedCompanyName(data.companyName);
                }

                if (data.customerLogo) {
                    setPreview(getImageUrl(`/upload/customer/${data.customerId}/${data.customerLogo}`));
                }

                if (data.dialCode) {
                    setCustomerCountryCode(getCountryCodeByDialCode(data.dialCode));
                }
                if (data.ownerDialCode) {
                    setOwnerCountryCode(getCountryCodeByDialCode(data.ownerDialCode));
                }
            } else {
                toast.error(data?.message || "Failed to load customer data.", { position: "top-right" });
            }
        } catch (err) {
            toast.error("Failed to load customer data.", { position: "top-right" });
        } finally {
            setFetching(false);
        }
    };

    // Load initial permissions / company context
    useEffect(() => {
        if (!isUpdate && !isSuperAdmin && activeAssignment?.companyId) {
            setFormData((prev) => ({
                ...prev,
                companyId: String(activeAssignment.companyId),
            }));
        }
        if (isSuperAdmin) {
            fetchCompanies();
        }
    }, [isUpdate, isSuperAdmin, activeAssignment]);

    // Update mode initial fetch
    useEffect(() => {
        if (isUpdate && id) {
            fetchCustomer();
        }
    }, [isUpdate, id]);

    // Currencies load when companyId changes
    useEffect(() => {
        if (!formData.companyId) {
            setCompanyCurrencies([]);
            return;
        }
        fetchCompanyCurrencies(formData.companyId);
    }, [formData.companyId]);

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

    const handleCountryChange = (selected) => {
        setFormData((prev) => ({
            ...prev,
            country: selected ? selected.value : "",
            state: "",
            city: "",
        }));
        setErrors((prev) => ({ ...prev, country: "" }));
    };

    const handleStateChange = (selected) => {
        setFormData((prev) => ({
            ...prev,
            state: selected ? selected.value : "",
            city: "",
        }));
        setErrors((prev) => ({ ...prev, state: "" }));
    };

    const handleCityChange = (selected) => {
        setFormData((prev) => ({
            ...prev,
            city: selected ? selected.value : "",
        }));
        setErrors((prev) => ({ ...prev, city: "" }));
    };

    const handleImage = (e) => {
        const file = e?.target?.files[0];
        if (!file) return;
        setErrors((prev) => ({ ...prev, customerLogo: "" }));
        setCustomerLogoFile(file);
        if (isUpdate) {
            setRemoveCustomerLogo(false);
        }
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
            if (isUpdate) {
                setRemoveCustomerLogo(true);
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleBack = async () => {
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
        if (result.isConfirmed) {
            if (onBack) {
                onBack();
            } else {
                router.push(config.cancelRedirect || "/customer-list");
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const numericId = id ? Number(Array.isArray(id) ? id[0] : id) : undefined;
        const payloadToValidate = {
            ...formData,
            customerLogo: isUpdate
                ? customerLogoFile || (preview && !removeCustomerLogo ? "existing" : null)
                : customerLogoFile,
            ...(isUpdate && {
                customerId: numericId,
                removeCustomerLogo: removeCustomerLogo ? "true" : undefined,
            }),
            companyId: formData.companyId ? Number(formData.companyId) : undefined,
            dialCode: formData.dialCode ? Number(formData.dialCode) : undefined,
            postalCode: formData.postalCode ? Number(formData.postalCode) : undefined,
            ownerDialCode: formData.ownerDialCode ? Number(formData.ownerDialCode) : undefined,
        };

        const parseRes = config.schema.safeParse(payloadToValidate);
        const fieldErrors = {};

        if (!parseRes.success) {
            parseRes.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) {
                    fieldErrors[field] = err.message;
                }
            });
        }

        if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            return;
        }

        const confirmRes = await MySwal.fire({
            title: config.confirm?.title || "Confirm?",
            text: config.confirm?.text || "Are you sure?",
            icon: config.confirm?.icon || "info",
            showCancelButton: true,
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#6b7280",
            confirmButtonText: config.confirm?.confirmButtonText || "Confirm",
            cancelButtonText: "Cancel",
        });
        if (!confirmRes.isConfirmed) return;

        setLoading(true);
        try {
            const payload = new FormData();
            if (isUpdate && numericId) {
                payload.append("customerId", String(numericId));
            }
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
            } else if (isUpdate && removeCustomerLogo) {
                payload.append("removeCustomerLogo", "true");
            }

            const res = await fetch("/relayapi", {
                method: config.api.method,
                headers: {
                    endpoint: config.api.endpoint,
                    module: config.api.module,
                },
                body: payload,
            });
            const resPayload = await res.json();
            const data = resPayload.encrypted ? decryptResponse(resPayload.encrypted) : resPayload;

            if (data?.success === 1) {
                toast.success(config.successMessage, { position: "top-right" });
                if (onBack) {
                    onBack();
                } else if (typeof config.redirectAfterSuccess === "function") {
                    router.push(config.redirectAfterSuccess(numericId));
                } else {
                    router.push(config.redirectAfterSuccess || "/customer-list");
                }
            } else {
                const msg = data?.message || (isUpdate ? "Failed to update customer." : "Failed to create customer.");
                if (msg === "This phone number is already registered for this company.") {
                    setErrors({ phone: msg });
                } else if (msg === "This email is already registered for this company.") {
                    setErrors({ customerEmail: msg });
                } else {
                    setErrors({ global: msg });
                }
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

    const renderField = (field) => {
        if (field.hidden) return null;

        switch (field.type) {
            case "company-select": {
                if (!isSuperAdmin) return null;
                if (field.readOnly) {
                    const companyDisplay =
                        fetchedCompanyName ||
                        companies.find((c) => String(c.companyId) === String(formData.companyId))?.companyName ||
                        activeAssignment?.companyName ||
                        "Your Company";
                    return (
                        <div key={field.name}>
                            <label className={labelClass}>
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <input
                                type="text"
                                readOnly
                                value={companyDisplay}
                                className="w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed"
                            />
                        </div>
                    );
                }
                return (
                    <div key={field.name}>
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
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
                        {errors.companyId && <p className={errorClass}>{errors.companyId}</p>}
                    </div>
                );
            }

            case "file-image": {
                return (
                    <div key={field.name}>
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleImage}
                            className={inputClass}
                        />
                        {errors[field.name] && <p className={errorClass}>{errors[field.name]}</p>}
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
                );
            }

            case "currency-multi-select": {
                return (
                    <div key={field.name}>
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <Select
                            name="curIds"
                            instanceId={`${context}-currency-select`}
                            isMulti
                            isLoading={currenciesLoading}
                            options={companyCurrencies.map((c) => ({
                                value: c.curId,
                                label: `(${c.code}) ${c.symbol} - ${c.name || ""}`,
                            }))}
                            value={companyCurrencies
                                .filter((c) => formData.curIds?.includes(c.curId))
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
                            placeholder={
                                formData.companyId
                                    ? field.placeholder || "Select currencies"
                                    : field.disabledPlaceholder || "Please select a company first"
                            }
                            isDisabled={!formData.companyId}
                            classNamePrefix="react-select"
                        />
                        {errors.curIds && <p className={errorClass}>{errors.curIds}</p>}
                    </div>
                );
            }

            case "phone": {
                const isOwner = field.name === "ownerPhone";
                const phoneCountryCode = isOwner ? ownerCountryCode : customerCountryCode;
                const companionDial = field.companionDialCode || "dialCode";
                const rawDial = formData[companionDial] || "";
                const rawPhone = formData[field.name] || "";
                const phoneVal = rawPhone ? `+${rawDial}${rawPhone}` : "";

                return (
                    <div key={field.name} className="w-full">
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {!isMounted ? (
                            <div
                                className="w-full rounded-xl border border-gray-300 bg-gray-50"
                                style={{ height: "50px" }}
                            />
                        ) : (
                            <PhoneInput
                                country={phoneCountryCode}
                                value={phoneVal}
                                onChange={(value, countryData) => {
                                    const dial = countryData?.dialCode || "";
                                    const phone = value.slice(dial.length);
                                    if (isOwner) {
                                        setOwnerCountryCode(countryData?.countryCode);
                                    } else {
                                        setCustomerCountryCode(countryData?.countryCode);
                                    }
                                    setFormData((prev) => ({
                                        ...prev,
                                        [field.name]: phone,
                                        [companionDial]: dial,
                                    }));
                                    setErrors((prev) => ({ ...prev, [field.name]: "" }));
                                }}
                                inputStyle={{
                                    width: "100%",
                                    height: "50px",
                                    borderRadius: "0.75rem",
                                    border: errors[field.name] ? "1px solid #ef4444" : "1px solid #d1d5db",
                                    fontSize: "14px",
                                }}
                                buttonStyle={{
                                    borderRadius: "0.75rem 0 0 0.75rem",
                                    border: errors[field.name] ? "1px solid #ef4444" : "1px solid #d1d5db",
                                    background: "#f9fafb",
                                }}
                                containerStyle={{ width: "100%" }}
                                enableSearch
                                searchPlaceholder="Search country..."
                            />
                        )}
                        {errors[field.name] && <p className={errorClass}>{errors[field.name]}</p>}
                    </div>
                );
            }

            case "country-select": {
                return (
                    <div key={field.name}>
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <Select
                            name="country"
                            instanceId={`${context}-country-select`}
                            options={countries.map((c) => ({ value: c.isoCode, label: `${c.flag} ${c.name}` }))}
                            value={
                                countries
                                    .filter((c) => c.isoCode === formData.country)
                                    .map((c) => ({ value: c.isoCode, label: `${c.flag} ${c.name}` }))[0] || null
                            }
                            onChange={handleCountryChange}
                            isSearchable
                            isClearable
                            placeholder={field.placeholder || "Select Country"}
                            classNamePrefix="react-select"
                        />
                        {errors.country && <p className={errorClass}>{errors.country}</p>}
                    </div>
                );
            }

            case "state-select": {
                return (
                    <div key={field.name}>
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <Select
                            name="state"
                            instanceId={`${context}-state-select`}
                            options={states.map((s) => ({ value: s.isoCode, label: s.name }))}
                            value={
                                states
                                    .filter((s) => s.isoCode === formData.state)
                                    .map((s) => ({ value: s.isoCode, label: s.name }))[0] || null
                            }
                            onChange={handleStateChange}
                            isDisabled={!formData.country}
                            isSearchable
                            isClearable
                            placeholder={field.placeholder || "Select State"}
                            classNamePrefix="react-select"
                        />
                        {errors.state && <p className={errorClass}>{errors.state}</p>}
                    </div>
                );
            }

            case "city-creatable-select": {
                return (
                    <div key={field.name}>
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <CreatableSelect
                            name="city"
                            instanceId={`${context}-city-select`}
                            options={cities.map((city) => ({ value: city.name, label: city.name }))}
                            value={formData.city ? { value: formData.city, label: formData.city } : null}
                            onChange={handleCityChange}
                            isDisabled={!formData.state}
                            isSearchable
                            isClearable
                            placeholder={field.placeholder || "Select or Type City"}
                            classNamePrefix="react-select"
                            formatCreateLabel={(inputValue) => `Use custom city "${inputValue}"`}
                        />
                        {errors.city && <p className={errorClass}>{errors.city}</p>}
                    </div>
                );
            }

            case "date": {
                const maxDate = field.name === "ownerDob" ? maxOwnerDobString : maxIncorporationDate;
                return (
                    <div key={field.name}>
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            type="date"
                            name={field.name}
                            value={formData[field.name] || ""}
                            max={maxDate}
                            onChange={handleChange}
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                            className={inputClass}
                        />
                        {errors[field.name] && <p className={errorClass}>{errors[field.name]}</p>}
                    </div>
                );
            }

            case "select": {
                return (
                    <div key={field.name} className="w-full">
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <select
                            name={field.name}
                            value={formData[field.name]}
                            onChange={handleChange}
                            className={inputClass}
                        >
                            {(field.options || []).map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        {errors[field.name] && <p className={errorClass}>{errors[field.name]}</p>}
                    </div>
                );
            }

            case "text":
            case "email":
            case "postal-code":
            default: {
                const isDisabled = typeof field.disabledWhen === "function" ? field.disabledWhen(formData) : false;
                return (
                    <div key={field.name}>
                        <label className={labelClass}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            type={field.type === "email" ? "email" : "text"}
                            name={field.name}
                            value={formData[field.name] || ""}
                            readOnly={field.readOnly}
                            disabled={isDisabled}
                            onChange={handleChange}
                            placeholder={field.placeholder}
                            className={
                                field.className ||
                                (field.readOnly
                                    ? "w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed font-mono"
                                    : inputClass)
                            }
                        />
                        {errors[field.name] && <p className={errorClass}>{errors[field.name]}</p>}
                    </div>
                );
            }
        }
    };

    if (isUpdate && fetching) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page={config.headerPage} />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading customer data..." />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-[#f5f6f8] text-black">
            <Header page={config.headerPage} />

            <nav className="p-6 flex items-center space-x-2 text-sm font-medium text-gray-500">
                <Link href="/" className="cursor-pointer hover:text-blue-600 hover:underline">
                    Home
                </Link>
                <span className="text-gray-400">{">>"}</span>
                <Link href="/customer-list" className="cursor-pointer hover:text-blue-600 hover:underline">
                    Customers
                </Link>
                {isUpdate && (
                    <>
                        <span className="text-gray-400">{">>"}</span>
                        <Link
                            href={`/customer/${id}`}
                            onClick={(e) => {
                                if (onBack) {
                                    e.preventDefault();
                                    onBack();
                                }
                            }}
                            className="cursor-pointer hover:text-blue-600 hover:underline"
                        >
                            Customer
                        </Link>
                    </>
                )}
                <span className="text-gray-400">{">>"}</span>
                <span className="text-gray-800 cursor-pointer">{config.breadcrumbLabel || config.title}</span>
            </nav>

            <div className="px-6">
                <div className="mb-8 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">{config.title}</h1>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="space-y-6">
                        {config.sections.map((section) => (
                            <div key={section.title} className="rounded-2xl bg-white p-8 shadow-sm">
                                <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">
                                    {section.title}
                                </h2>
                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                    {section.fields.map((field) => renderField(field))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 mb-10 flex justify-center gap-4">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="px-6 py-2 rounded-md font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer rounded-xl bg-blue-600 px-8 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition"
                        >
                            {loading ? config.loadingButtonText : config.submitButtonText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
