"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { isValidPhoneNumber } from "libphonenumber-js";
import { City, Country, State } from "country-state-city";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { companyFormConfig } from "./configs/companyForm.config";

const MySwal = withReactContent(Swal);

export default function CompanyFormPage({ context = "company-add", id, onBack }) {
    const router = useRouter();
    const config = companyFormConfig.contexts[context];
    if (!config) {
        throw new Error(`CompanyFormPage: Unknown context "${context}"`);
    }

    const isUpdate = config.mode === "update";
    const normalizedId = id ? Number(Array.isArray(id) ? id[0] : id) : null;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isUpdate);
    const [errors, setErrors] = useState({});

    const [companyCountryCode, setCompanyCountryCode] = useState("in");
    const [ownerCountryCode, setOwnerCountryCode] = useState("in");
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

    const [companyFile, setCompanyFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [imageRemoved, setImageRemoved] = useState(false);
    const fileInputRef = useRef(null);

    const [currencies, setCurrencies] = useState([]);
    const [parentCompanies, setParentCompanies] = useState([]);

    const countries = useMemo(() => Country.getAllCountries(), []);
    const states = useMemo(() => (formData.country ? State.getStatesOfCountry(formData.country) : []), [formData.country]);
    const cities = useMemo(
        () => (formData.country && formData.state ? City.getCitiesOfState(formData.country, formData.state) : []),
        [formData.country, formData.state]
    );

    const hasParentCompanyField = useMemo(() => {
        return config.sections.some((s) => s.fields.some((f) => f.name === "parentCompanyId" && !f.hidden));
    }, [config.sections]);

    useEffect(() => {
        if (config.currencySource === "currency-list") {
            fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: "currency-list",
                    module: "company",
                },
            })
                .then((r) => r.json())
                .then((resJson) => {
                    const data = resJson?.encrypted ? decryptResponse(resJson.encrypted) : resJson;
                    setCurrencies(
                        Array.isArray(data)
                            ? data.filter((currency) => currency.status == "Active")
                            : []
                    );
                })
                .catch(() => {});
        }
    }, [config.currencySource]);

    useEffect(() => {
        if (hasParentCompanyField) {
            fetch("/relayapi", {
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
                }),
            })
                .then((r) => r.json())
                .then((resJson) => {
                    const data = resJson?.encrypted ? decryptResponse(resJson.encrypted) : resJson;
                    const companyArray = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                    setParentCompanies(companyArray);
                })
                .catch((err) => {
                    console.error("Failed to load parent companies", err);
                });
        }
    }, [hasParentCompanyField]);

    const fetchCompany = async () => {
        setFetching(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `${config.api.fetchEndpoint}/${normalizedId}`,
                    module: config.api.module,
                },
            });
            const resJson = await res.json();
            const data = resJson?.encrypted ? decryptResponse(resJson.encrypted) : resJson;
            if (data?.companyId) {
                setFormData({
                    companyName: data.companyName || "",
                    companyCode: data.companyCode || "",
                    status: (data.status || "Active").toLowerCase() === "inactive" ? "Inactive" : "Active",
                    allowManualInvoicing: data.allowManualInvoicing || "YES",
                    email: data.email || "",
                    website: data.website || "",
                    dialCode: data.dialCode || "",
                    phone: data.phone || "",
                    country: "",
                    state: "",
                    city: data.city || "",
                    AddressLineOne: data.AddressLineOne || "",
                    postalCode: data.postalCode || "",
                    ownerName: data.ownerName || "",
                    ownerEmail: data.ownerEmail || "",
                    ownerPhone: data.ownerPhone || "",
                    ownerDialCode: data.ownerDialCode || "",
                    curIds: Array.isArray(data.curIds) ? data.curIds : [],
                    parentCompanyId: data.parentCompanyId || null,
                });

                if (config.currencySource === "details") {
                    setCurrencies(Array.isArray(data.allCurrencies) ? data.allCurrencies : []);
                }

                if (data.companyFile) {
                    setPreview(getImageUrl(`/upload/company/${data.companyId}/${data.companyFile}`));
                }

                if (data.dialCode) {
                    setCompanyCountryCode(getCountryCodeByDialCode(data.dialCode));
                }
                if (data.ownerDialCode) {
                    setOwnerCountryCode(getCountryCodeByDialCode(data.ownerDialCode));
                }

                if (data.country) {
                    const allCountries = Country.getAllCountries();
                    const matchedCountry = allCountries.find(
                        (c) => c.name === data.country || c.isoCode === data.country
                    );
                    if (matchedCountry) {
                        setFormData((prev) => ({ ...prev, country: matchedCountry.isoCode }));
                        if (data.state) {
                            const allStates = State.getStatesOfCountry(matchedCountry.isoCode);
                            const matchedState = allStates.find(
                                (s) => s.name === data.state || s.isoCode === data.state
                            );
                            if (matchedState) {
                                setFormData((prev) => ({ ...prev, state: matchedState.isoCode }));
                            }
                        }
                    }
                }
            } else {
                toast.error(data?.message || "Failed to load company data.", { position: "top-right" });
            }
        } catch (err) {
            toast.error("Failed to load company data.", { position: "top-right" });
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (isUpdate && normalizedId) {
            fetchCompany();
        }
    }, [isUpdate, normalizedId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === "postalCode" && value !== "" && !/^\d+$/.test(value)) {
            return;
        }
        setErrors((prev) => ({ ...prev, [name]: "" }));
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleImage = (e) => {
        const file = e?.target?.files[0];
        if (!file) return;
        setErrors((prev) => ({ ...prev, companyFile: "" }));
        setCompanyFile(file);
        setPreview(URL.createObjectURL(file));
        setImageRemoved(false);
    };

    const handleRemoveImage = async () => {
        const result = await MySwal.fire({
            title: config.removeLogoConfirm?.title || "Remove Company Logo?",
            text: config.removeLogoConfirm?.text || "This will discard the selected logo.",
            icon: config.removeLogoConfirm?.icon || "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: config.removeLogoConfirm?.confirmButtonText || "Yes, remove it!",
        });

        if (result.isConfirmed) {
            setCompanyFile(null);
            setPreview("");
            setImageRemoved(true);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleCancel = async () => {
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

        if (result.isConfirmed) {
            if (onBack) {
                onBack();
            } else {
                router.push(config.cancelRedirect || "/company-list");
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Validate phone numbers in both modes
        const isCompanyPhoneValid = !!formData.phone && isValidPhoneNumber(formData.phone, (companyCountryCode || "in").toUpperCase());
        const isOwnerPhoneValid = !!formData.ownerPhone && isValidPhoneNumber(formData.ownerPhone, (ownerCountryCode || "in").toUpperCase());
        if (!isCompanyPhoneValid || !isOwnerPhoneValid) {
            const phoneErr = {};
            if (!isCompanyPhoneValid) phoneErr.phone = "Enter a valid phone number for the selected country";
            if (!isOwnerPhoneValid) phoneErr.ownerPhone = "Enter a valid owner phone number for the selected country";
            setErrors((prev) => ({ ...prev, ...phoneErr }));
            return;
        }

        // 2. Validate schema
        const result = config.schema.safeParse({
            ...formData,
            companyFile: companyFile || undefined,
        });

        if (!result.success) {
            const fieldErrors = {};
            result.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) {
                    fieldErrors[field] = err.message;
                }
            });
            setErrors(fieldErrors);
            return;
        }

        // 3. Confirm with SweetAlert
        const confirmRes = await MySwal.fire({
            title: config.confirm.title,
            text: config.confirm.text,
            icon: config.confirm.icon,
            showCancelButton: true,
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#6b7280",
            confirmButtonText: config.confirm.confirmButtonText,
            cancelButtonText: "Cancel",
        });

        if (!confirmRes.isConfirmed) return;

        setLoading(true);
        try {
            const payload = new FormData();
            if (isUpdate) {
                payload.append("companyId", String(normalizedId));
            }

            Object.entries(formData).forEach(([key, value]) => {
                if (["country", "state", "dialCode", "ownerDialCode", "parentCompanyId"].includes(key)) return;
                if (value !== "" && value !== null && value !== undefined) {
                    if (key === "curIds") {
                        payload.append(key, JSON.stringify(value));
                    } else {
                        payload.append(key, String(value));
                    }
                }
            });

            if (formData.dialCode) payload.append("dialCode", formData.dialCode);
            if (formData.ownerDialCode) payload.append("ownerDialCode", formData.ownerDialCode);

            if (!isUpdate) {
                if (formData.parentCompanyId) payload.append("parentCompanyId", String(formData.parentCompanyId));
            } else {
                if (formData.parentCompanyId !== undefined && formData.parentCompanyId !== null && formData.parentCompanyId !== "") {
                    payload.append("parentCompanyId", String(formData.parentCompanyId));
                } else {
                    payload.append("parentCompanyId", "null");
                }
            }

            const countryName = countries.find((c) => c.isoCode === formData.country)?.name || formData.country;
            const stateName = states.find((s) => s.isoCode === formData.state)?.name || formData.state;
            if (countryName) payload.append("country", countryName);
            if (stateName) payload.append("state", stateName);
            if (companyFile) payload.append("companyFile", companyFile);
            if (isUpdate && imageRemoved && !companyFile) {
                payload.append("removeCompanyFile", "true");
            }

            const response = await fetch("/relayapi", {
                method: config.api.method,
                headers: {
                    endpoint: config.api.endpoint,
                    module: config.api.module,
                },
                body: payload,
            });

            if (response.status === 401 || response.status === 403) {
                router.push("/forbidden");
                return;
            }

            const resJson = await response.json();
            const data = resJson?.encrypted ? decryptResponse(resJson.encrypted) : resJson;

            if (response.ok && (data?.success === 1 || data?.status === 1 || data?.settings?.success === 1 || data?.status?.success === 1)) {
                toast.success(config.successMessage, { position: "top-right" });
                setTimeout(() => {
                    if (isUpdate && onBack) {
                        onBack();
                    } else {
                        router.push(config.redirectAfterSuccess || "/company-list");
                    }
                }, 1000);
            } else {
                const msg = Array.isArray(data?.message)
                    ? data.message.join(", ")
                    : (data?.message || data?.settings?.message || data?.status?.message || (isUpdate ? "Failed to update company." : "Failed to create company."));
                toast.error(msg, { position: "top-right" });
            }
        } catch (err) {
            toast.error(`${err}`, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 text-sm";
    const labelClass = "mb-2 block text-sm font-medium text-gray-700";
    const errorClass = "mt-1 text-sm text-red-500";

    const renderParentCompanyField = (field) => {
        let options = [];
        if (isUpdate) {
            const invalidIds = new Set();
            if (normalizedId) {
                invalidIds.add(Number(normalizedId));
                const queue = [Number(normalizedId)];
                while (queue.length > 0) {
                    const curr = queue.shift();
                    for (const comp of parentCompanies) {
                        if (comp.parentCompanyId && Number(comp.parentCompanyId) === curr) {
                            if (!invalidIds.has(comp.companyId)) {
                                invalidIds.add(comp.companyId);
                                queue.push(comp.companyId);
                            }
                        }
                    }
                }
            }
            options = [
                { value: "", label: "None (Root Company)" },
                ...parentCompanies
                    .filter((c) => !invalidIds.has(c.companyId))
                    .map((c) => ({
                        value: c.companyId,
                        label: c.companyName,
                    })),
            ];
        } else {
            options = [
                { value: "", label: "Please select Parent Company" },
                ...parentCompanies.map((c) => ({
                    value: c.companyId,
                    label: c.companyName,
                })),
            ];
        }

        const selectedOption = formData.parentCompanyId
            ? {
                value: formData.parentCompanyId,
                label: parentCompanies.find((c) => c.companyId === formData.parentCompanyId)?.companyName || "Selected",
            }
            : { value: "", label: isUpdate ? "None (Root Company)" : "Please select Parent Company" };

        return (
            <Select
                name={field.name}
                instanceId={`${context}-parent-company-select`}
                options={options}
                value={selectedOption}
                onChange={(selected) => {
                    setFormData((prev) => ({
                        ...prev,
                        parentCompanyId: selected && selected.value !== "" ? selected.value : null,
                    }));
                }}
                isSearchable
                classNamePrefix="react-select"
            />
        );
    };

    const renderField = (field) => {
        if (field.hidden) return null;

        const isDisabled = typeof field.disabledWhen === "function" ? field.disabledWhen(formData) : false;
        const fieldInputClass = field.readOnly
            ? `${inputClass} bg-gray-100 text-gray-500 cursor-not-allowed`
            : inputClass;

        return (
            <div key={field.name} className="w-full">
                <label className={labelClass}>
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>

                {field.type === "text" || field.type === "email" ? (
                    <input
                        type={field.type}
                        name={field.name}
                        value={formData[field.name]}
                        onChange={handleChange}
                        readOnly={field.readOnly}
                        disabled={isDisabled}
                        placeholder={field.placeholder}
                        className={`${fieldInputClass} ${isDisabled ? "disabled:bg-gray-100 disabled:cursor-not-allowed" : ""}`}
                    />
                ) : null}

                {field.type === "postal-code" && (
                    <input
                        type="text"
                        name={field.name}
                        value={formData[field.name]}
                        onChange={handleChange}
                        readOnly={field.readOnly}
                        placeholder={field.placeholder}
                        className={fieldInputClass}
                    />
                )}

                {field.type === "select" && (
                    <select
                        name={field.name}
                        value={formData[field.name]}
                        onChange={handleChange}
                        disabled={field.readOnly || isDisabled}
                        className={fieldInputClass}
                    >
                        {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                )}

                {field.type === "parent-company-select" && renderParentCompanyField(field)}

                {field.type === "currency-multi-select" && (
                    <Select
                        name={field.name}
                        instanceId={`${context}-currency-select`}
                        isMulti
                        options={currencies.map((c) => ({
                            value: c.curId,
                            label: `(${c.code}) ${c.symbol}`,
                        }))}
                        value={currencies
                            .filter((c) => (formData.curIds || []).includes(c.curId))
                            .map((c) => ({
                                value: c.curId,
                                label: `(${c.code}) ${c.symbol}`,
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
                        placeholder={field.placeholder || "Select currencies"}
                        classNamePrefix="react-select"
                    />
                )}

                {field.type === "country-select" && (
                    <Select
                        name={field.name}
                        instanceId={`${context}-country-select`}
                        options={countries.map((c) => ({ value: c.isoCode, label: `${c.flag} ${c.name}` }))}
                        value={
                            countries
                                .filter((c) => c.isoCode === formData.country)
                                .map((c) => ({ value: c.isoCode, label: `${c.flag} ${c.name}` }))[0] || null
                        }
                        onChange={(selected) => {
                            setFormData((prev) => ({
                                ...prev,
                                country: selected ? selected.value : "",
                                state: "",
                                city: "",
                            }));
                            setErrors((prev) => ({ ...prev, country: "" }));
                        }}
                        isSearchable
                        isClearable
                        placeholder={field.placeholder || "Select Country"}
                        classNamePrefix="react-select"
                    />
                )}

                {field.type === "state-select" && (
                    <Select
                        name={field.name}
                        instanceId={`${context}-state-select`}
                        options={states.map((s) => ({ value: s.isoCode, label: s.name }))}
                        value={
                            states
                                .filter((s) => s.isoCode === formData.state)
                                .map((s) => ({ value: s.isoCode, label: s.name }))[0] || null
                        }
                        onChange={(selected) => {
                            setFormData((prev) => ({
                                ...prev,
                                state: selected ? selected.value : "",
                                city: "",
                            }));
                            setErrors((prev) => ({ ...prev, state: "" }));
                        }}
                        isDisabled={!formData.country}
                        isSearchable
                        isClearable
                        placeholder={field.placeholder || "Select State"}
                        classNamePrefix="react-select"
                    />
                )}

                {field.type === "city-creatable-select" && (
                    <CreatableSelect
                        name={field.name}
                        instanceId={`${context}-city-select`}
                        options={cities.map((city) => ({ value: city.name, label: city.name }))}
                        value={formData.city ? { value: formData.city, label: formData.city } : null}
                        onChange={(selected) => {
                            setFormData((prev) => ({ ...prev, city: selected ? selected.value : "" }));
                            setErrors((prev) => ({ ...prev, city: "" }));
                        }}
                        isDisabled={!formData.state}
                        isSearchable
                        isClearable
                        placeholder={field.placeholder || "Select or Type City"}
                        classNamePrefix="react-select"
                        formatCreateLabel={(inputValue) => `Use custom city "${inputValue}"`}
                    />
                )}

                {field.type === "phone" && (
                    !isMounted ? (
                        <div
                            className="w-full rounded-xl border border-gray-300 bg-gray-50"
                            style={{ height: "50px" }}
                        />
                    ) : (
                        <PhoneInput
                            country={field.companionDialCode === "ownerDialCode" ? ownerCountryCode : companyCountryCode}
                            value={
                                field.companionDialCode === "ownerDialCode"
                                    ? (formData.ownerPhone ? `+${formData.ownerDialCode}${formData.ownerPhone}` : "")
                                    : (formData.phone ? `+${formData.dialCode}${formData.phone}` : "")
                            }
                            onChange={(value, countryData) => {
                                const dial = countryData?.dialCode || "";
                                const phone = value.slice(dial.length);
                                if (field.companionDialCode === "ownerDialCode") {
                                    setOwnerCountryCode(countryData?.countryCode);
                                    setFormData((prev) => ({ ...prev, ownerPhone: phone, ownerDialCode: dial }));
                                    setErrors((prev) => ({ ...prev, ownerPhone: "" }));
                                } else {
                                    setCompanyCountryCode(countryData?.countryCode);
                                    setFormData((prev) => ({ ...prev, phone, dialCode: dial }));
                                    setErrors((prev) => ({ ...prev, phone: "" }));
                                }
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
                    )
                )}

                {field.type === "file-image" && (
                    <div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleImage}
                            className={inputClass}
                        />
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
                )}

                {errors[field.name] && <p className={errorClass}>{errors[field.name]}</p>}
            </div>
        );
    };

    if (fetching) {
        return (
            <div className="min-h-screen bg-[#f5f6f8]">
                <Header page={config.headerPage} />
                <div className="flex items-center justify-center py-20">
                    <Loader label="Loading company data..." />
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
                <Link href="/company-list" className="cursor-pointer hover:text-blue-600 hover:underline">
                    Companies
                </Link>
                {isUpdate && (
                    <>
                        <span className="text-gray-400">{">>"}</span>
                        <Link
                            href={`/company/${normalizedId}`}
                            onClick={(e) => {
                                if (onBack) {
                                    e.preventDefault();
                                    onBack();
                                }
                            }}
                            className="cursor-pointer hover:text-blue-600 hover:underline"
                        >
                            Company
                        </Link>
                    </>
                )}
                <span className="text-gray-400">{">>"}</span>
                <span className="text-gray-800">{config.title}</span>
            </nav>

            <div className="px-6">
                <div className="mb-8 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">{config.title}</h1>
                </div>

                <form onSubmit={handleSubmit}>
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
                            onClick={handleCancel}
                            className="rounded-xl bg-gray-200 px-8 py-3 font-medium text-gray-700 hover:bg-gray-300 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-xl bg-blue-600 px-8 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition cursor-pointer"
                        >
                            {loading ? config.loadingButtonText : config.submitButtonText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
