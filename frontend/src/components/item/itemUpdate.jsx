"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import Header from "../Header";
import { itemFormConfig } from "./configs/itemForm.config";
import { Star } from "lucide-react";
import { getImageUrl } from "@/lib/utils";

const getMySwal = () => withReactContent(Swal);

const SHELF_LIFE_UNITS = [
    { label: "Minute", value: "minute" },
    { label: "Hour", value: "hour" },
    { label: "Day", value: "day" },
    { label: "Month", value: "month" },
    { label: "Year", value: "year" },
];

export default function EditItemPage({ item, onBack }) {
    const router = useRouter();
    const { displayUser, activeAssignment } = useContext(loginContext) || {};
    const config = itemFormConfig.contexts["item-update"];

    const [formData, setFormData] = useState({
        itemName: item?.itemName || "",
        shortName: item?.shortName || "",
        categoryId: item?.categoryId ? String(item.categoryId) : "",
        manufacturerId: item?.manufacturerId ? String(item.manufacturerId) : "",
        brandId: item?.brandId ? String(item.brandId) : "",
        packageUom: item?.packageUom ? String(item.packageUom) : "",
        itemUom: item?.itemUom ? String(item.itemUom) : "",
        primitiveQuantity: item?.primitiveQuantity ?? "",
        sourceCurrencyId: item?.sourceCurrencyId ? String(item.sourceCurrencyId) : "",
        purchasePrice: item?.purchasePrice ?? "",
        costPerUnit: item?.costPerUnit ?? "",
        checkShelfLife: item?.checkShelfLife || "false",
        shelfLifeSpan: item?.shelfLifeSpan ?? "",
        shelfLifeUnit: item?.shelfLifeUnit || "month",
        isDecimalAllowed: item?.isDecimalAllowed || "false",
        remarks: item?.remarks || "",
        archive: item?.archive || "false",
        status: item?.status || "Active",
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const [categories, setCategories] = useState([]);
    const [manufacturers, setManufacturers] = useState([]);
    const [brands, setBrands] = useState([]);
    const [uoms, setUoms] = useState([]);
    const [packages, setPackages] = useState([]);
    const [currencies, setCurrencies] = useState([]);

    const [currencyRate, setCurrencyRate] = useState(null);
    const [convertedPurchasePrice, setConvertedPurchasePrice] = useState(
        item?.convertedPurchasePrice != null ? String(item.convertedPurchasePrice) : ""
    );
    const [convertedCostPerUnit, setConvertedCostPerUnit] = useState(
        item?.convertedCostPerUnit != null ? String(item.convertedCostPerUnit) : ""
    );

    const [existingImages, setExistingImages] = useState(item?.images || []);
    const [deletedImageIds, setDeletedImageIds] = useState([]);

    const [selectedFiles, setSelectedFiles] = useState([]);
    const [filePreviews, setFilePreviews] = useState([]);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchCategories();
        fetchManufacturers();
        fetchBrands();
        fetchUoms();
        fetchPackages();
        if (item?.companyId) {
            fetchCompanyCurrencies(item.companyId);
        }
        if (item?.sourceCurrencyId) {
            fetch("/relayapi", {
                method: "GET",
                headers: { ...authHeaders(), endpoint: `currency-rate/${item.sourceCurrencyId}`, module: "currency" },
            })
                .then((r) => r.json())
                .then((p) => { const d = p.encrypted ? decryptResponse(p.encrypted) : p; setCurrencyRate(d); })
                .catch(() => { });
        }
    }, []);

    const fetchCompanyCurrencies = async (companyId) => {
        if (!companyId) {
            setCurrencies([]);
            return;
        }
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
            setCurrencies(currencyList);
        } catch {
            setCurrencies([]);
        }
    };

    useEffect(() => {
        if (!formData.sourceCurrencyId) { setCurrencyRate(null); return; }
        fetch("/relayapi", {
            method: "GET",
            headers: { ...authHeaders(), endpoint: `currency-rate/${formData.sourceCurrencyId}`, module: "currency" },
        })
            .then((r) => r.json())
            .then((p) => { const d = p.encrypted ? decryptResponse(p.encrypted) : p; setCurrencyRate(d); })
            .catch(() => { });
    }, [formData.sourceCurrencyId]);

    // Base price = source price / conversion rate
    useEffect(() => {
        const rate = currencyRate?.conversionRate;
        if (!rate) return;
        setConvertedPurchasePrice(formData.purchasePrice !== "" ? (Number(formData.purchasePrice) / rate).toFixed(2) : "");
        setConvertedCostPerUnit(formData.costPerUnit !== "" ? (Number(formData.costPerUnit) / rate).toFixed(2) : "");
    }, [formData.purchasePrice, formData.costPerUnit, currencyRate]);

    const fetchList = async (endpoint, module, setter) => {
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { ...authHeaders(), endpoint, module, "Content-Type": "application/json" },
                body: JSON.stringify({ page: 1, limit: 500, filters: [{ key: "status", value: "Active", operator: "=" }], condition: "All" }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setter(data?.data ?? []);
        } catch { }
    };

    const fetchCategories = () => fetchList("item-category-list", "item-category", setCategories);
    const fetchManufacturers = () => fetchList("manufacturer-list", "manufacturer", setManufacturers);
    const fetchBrands = () => fetchList("brand-list", "brand", setBrands);
    const fetchUoms = () => fetchList("uom-list", "uom", setUoms);
    const fetchPackages = () => fetchList("package-list", "package", setPackages);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setSelectedFiles((prev) => [...prev, ...files]);
        setFilePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    };

    const removeSelectedFile = (idx) => {
        URL.revokeObjectURL(filePreviews[idx]);
        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
        setFilePreviews((prev) => prev.filter((_, i) => i !== idx));
    };

    const removeExistingImage = (imgId) => {
        setDeletedImageIds((prev) => [...prev, imgId]);
        setExistingImages((prev) => prev.filter((img) => img.id !== imgId));
    };

    const handleCancel = async () => {
        const result = await getMySwal().fire({
            title: "Discard changes?", text: "Any unsaved data will be lost.", icon: "warning",
            showCancelButton: true, confirmButtonColor: "#EF4444", cancelButtonColor: "#1F2937",
            confirmButtonText: "Yes, discard", cancelButtonText: "Keep editing",
            reverseButtons: true, focusCancel: true,
            customClass: { popup: "rounded-xl", confirmButton: "px-6 py-2 font-medium", cancelButton: "px-6 py-2 font-medium" },
        });
        if (result.isConfirmed) onBack();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        const payloadToValidate = { ...formData, itemId: Number(item.itemId) };
        Object.keys(payloadToValidate).forEach((k) => {
            if (payloadToValidate[k] === "" || payloadToValidate[k] === undefined) {
                payloadToValidate[k] = undefined;
            }
        });

        const parseRes = config.schema.safeParse(payloadToValidate);
        if (!parseRes.success) {
            const fieldErrors = {};
            parseRes.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
            });
            setErrors(fieldErrors);
            return;
        }

        const confirmRes = await getMySwal().fire({
            title: "Update Item?", text: "Are you sure you want to save these changes?", icon: "question",
            showCancelButton: true, confirmButtonColor: "#2563eb", cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, update it!", cancelButtonText: "Cancel",
        });
        if (!confirmRes.isConfirmed) return;

        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("itemId", String(item.itemId));

            Object.entries(formData).forEach(([key, val]) => {
                if (key === "conversionRate") return;
                if (val !== undefined && val !== null && val !== "") {
                    fd.append(key, String(val));
                }
            });

            if (deletedImageIds.length > 0) {
                fd.append("deletedImageIds", JSON.stringify(deletedImageIds));
            }
            selectedFiles.forEach((file) => fd.append("itemImages", file));
            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: { endpoint: "item-update", module: "item" },
                body: fd,
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1) {
                toast.success("Item updated successfully", { position: "top-right" });
                onBack();
            } else {
                const msg = data?.message || "Update failed.";
                setErrors({ global: msg });
                toast.error(msg, { position: "top-right" });
            }
        } catch {
            toast.error("An error occurred during update.", { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    const inputClass = (name) =>
        `w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${errors[name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"} bg-white text-gray-800`;
    const selectClass = (name) =>
        `w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${errors[name] ? "border-red-500" : "border-gray-300 focus:border-blue-500"} bg-white text-gray-800`;
    const readonlyClass = "w-full rounded-xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-500 outline-none cursor-not-allowed";

    // Filters dependent options by item's fixed companyId
    const byCompany = (list) =>
        !item?.companyId ? list : list.filter((x) => String(x.companyId) === String(item.companyId));

    const srcCode = currencyRate?.code || "Source";
    const baseCurrency = currencies.find((c) => Number(c.conversionRate) === 1);
    const baseCode = baseCurrency?.code || "Base";

    return (
        <div className="min-h-screen w-full bg-[#f5f6f8] text-black">
            <Header page="item-details" />

            <nav className="p-6 flex items-center space-x-2 text-sm font-medium text-gray-500" aria-label="Breadcrumb">
                <span className="cursor-pointer transition-colors hover:text-blue-600 hover:underline" onClick={() => router.push("/")}>Home</span>
                <span className="text-gray-400">{">>"}</span>
                <span className="cursor-pointer transition-colors hover:text-blue-600 hover:underline" onClick={() => router.push("/item-list")}>Items</span>
                <span className="text-gray-400">{">>"}</span>
                <span className="cursor-pointer transition-colors hover:text-blue-600 hover:underline" onClick={onBack}>Item Details</span>
                <span className="text-gray-400">{">>"}</span>
                <span className="text-gray-800">Edit Item</span>
            </nav>

            <div className="px-6">
                <div className="mb-8 flex items-center justify-between">
                    <h1 className="mt-1 text-3xl font-semibold text-gray-800">Edit Item</h1>
                </div>

                <form onSubmit={handleSubmit}>
                    {errors.global && (
                        <div className="mb-6 p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">{errors.global}</div>
                    )}

                    <div className="w-full rounded-2xl bg-white p-8 shadow-sm mb-6">
                        <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Item Details</h2>

                        {/* Sole full-width row at top */}
                        <div className="mb-6">
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                Company <span className="text-red-500 text-base">*</span>
                            </label>
                            <input type="text" readOnly
                                value={item?.companyName || activeAssignment?.companyName || "Company"}
                                className={readonlyClass} />
                        </div>

                        {/* Two-column grid */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Item Code <span className="ml-1 text-xs text-gray-400">(read-only)</span></label>
                                <input type="text" readOnly value={item?.itemCode || ""} className={readonlyClass} />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Barcode <span className="ml-1 text-xs text-gray-400">(read-only)</span></label>
                                <input type="text" readOnly value={item?.barcode || ""} className={readonlyClass} />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Item Name <span className="text-red-500 text-base">*</span>
                                </label>
                                <input type="text" name="itemName" value={formData.itemName} onChange={handleChange}
                                    placeholder="Enter Item Name" className={inputClass("itemName")} />
                                {errors.itemName && <p className="mt-1 text-sm text-red-500">{errors.itemName}</p>}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Short Name</label>
                                <input type="text" name="shortName" value={formData.shortName} onChange={handleChange}
                                    placeholder="Enter Short Name" className={inputClass("shortName")} />
                                {errors.shortName && <p className="mt-1 text-sm text-red-500">{errors.shortName}</p>}
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Item Category <span className="text-red-500 text-base">*</span>
                                </label>
                                <select name="categoryId" value={formData.categoryId} onChange={handleChange} className={selectClass("categoryId")}>
                                    <option value="">Select Item Category</option>
                                    {byCompany(categories).map((c) => (
                                        <option key={c.itemCategoryId} value={String(c.itemCategoryId)}>{c.itemCategoryName}</option>
                                    ))}
                                </select>
                                {errors.categoryId && <p className="mt-1 text-sm text-red-500">{errors.categoryId}</p>}
                            </div>
                            <div />

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Manufacturer Name <span className="text-red-500 text-base">*</span>
                                </label>
                                <select name="manufacturerId" value={formData.manufacturerId} onChange={handleChange} className={selectClass("manufacturerId")}>
                                    <option value="">Select Manufacturer</option>
                                    {byCompany(manufacturers).map((m) => (
                                        <option key={m.manufacturerId} value={String(m.manufacturerId)}>{m.manufacturerName}</option>
                                    ))}
                                </select>
                                {errors.manufacturerId && <p className="mt-1 text-sm text-red-500">{errors.manufacturerId}</p>}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Brand Name <span className="text-red-500 text-base">*</span>
                                </label>
                                <select name="brandId" value={formData.brandId} onChange={handleChange} className={selectClass("brandId")}>
                                    <option value="">Select Brand Name</option>
                                    {byCompany(brands).map((b) => (
                                        <option key={b.brandId} value={String(b.brandId)}>{b.brandName}</option>
                                    ))}
                                </select>
                                {errors.brandId && <p className="mt-1 text-sm text-red-500">{errors.brandId}</p>}
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Package Type</label>
                                <select name="packageUom" value={formData.packageUom} onChange={handleChange} className={selectClass("packageUom")}>
                                    <option value="">Select Package UOM</option>
                                    {byCompany(packages).map((p) => (
                                        <option key={p.packageId} value={String(p.packageId)}>{p.packageName}</option>
                                    ))}
                                </select>
                                {errors.packageUom && <p className="mt-1 text-sm text-red-500">{errors.packageUom}</p>}
                            </div>
                            <div />

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Item UOM <span className="text-red-500 text-base">*</span>
                                </label>
                                <select name="itemUom" value={formData.itemUom} onChange={handleChange} className={selectClass("itemUom")}>
                                    <option value="">Select Item UOM</option>
                                    {byCompany(uoms).map((u) => (
                                        <option key={u.uomId} value={String(u.uomId)}>{u.uomName}</option>
                                    ))}
                                </select>
                                {errors.itemUom && <p className="mt-1 text-sm text-red-500">{errors.itemUom}</p>}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Primitive Quantity</label>
                                <input type="number" name="primitiveQuantity" value={formData.primitiveQuantity} onChange={handleChange}
                                    placeholder="Enter Primitive Quantity" step="any" className={inputClass("primitiveQuantity")} />
                                {errors.primitiveQuantity && <p className="mt-1 text-sm text-red-500">{errors.primitiveQuantity}</p>}
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Source Currency</label>
                                <select name="sourceCurrencyId" value={formData.sourceCurrencyId} onChange={handleChange} className={selectClass("sourceCurrencyId")}>
                                    <option value="">Select Currency</option>
                                    {currencies.map((c) => (
                                        <option key={c.curId} value={String(c.curId)}>{c.name} ({c.code})</option>
                                    ))}
                                </select>
                                {errors.sourceCurrencyId && <p className="mt-1 text-sm text-red-500">{errors.sourceCurrencyId}</p>}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Conversion Rate{currencyRate?.code ? ` (${currencyRate.code})` : ""}
                                </label>
                                <input type="text" readOnly value={currencyRate?.conversionRate ?? item?.conversionRate ?? ""} className={readonlyClass} />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Purchase Price ({srcCode})
                                </label>
                                <input type="number" name="purchasePrice" value={formData.purchasePrice} onChange={handleChange}
                                    placeholder="Enter Purchase Price" step="any" className={inputClass("purchasePrice")} />
                                {errors.purchasePrice && <p className="mt-1 text-sm text-red-500">{errors.purchasePrice}</p>}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Purchase Price ({baseCode})
                                </label>
                                <input type="text" readOnly value={convertedPurchasePrice} className={readonlyClass} placeholder="Auto-computed" />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Cost Per Unit ({srcCode})
                                </label>
                                <input type="number" name="costPerUnit" value={formData.costPerUnit} onChange={handleChange}
                                    placeholder="Enter Cost Per Unit" step="any" className={inputClass("costPerUnit")} />
                                {errors.costPerUnit && <p className="mt-1 text-sm text-red-500">{errors.costPerUnit}</p>}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Cost Per Unit ({baseCode})
                                </label>
                                <input type="text" readOnly value={convertedCostPerUnit} className={readonlyClass} placeholder="Auto-computed" />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Check Shelf Life</label>
                                <select name="checkShelfLife" value={formData.checkShelfLife} onChange={handleChange} className={selectClass("checkShelfLife")}>
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                </select>
                            </div>
                            {formData.checkShelfLife === "true" ? (
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700">Shelf Life</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number" name="shelfLifeSpan" value={formData.shelfLifeSpan}
                                            onChange={handleChange} placeholder="e.g. 1" step="1" min="0"
                                            className={`w-24 rounded-xl border px-3 py-3 text-sm outline-none transition ${errors.shelfLifeSpan ? "border-red-500" : "border-gray-300 focus:border-blue-500"} bg-white text-gray-800`}
                                        />
                                        <span className="text-gray-400 text-sm">/</span>
                                        <select name="shelfLifeUnit" value={formData.shelfLifeUnit} onChange={handleChange}
                                            className="flex-1 rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none transition focus:border-blue-500 bg-white text-gray-800">
                                            {SHELF_LIFE_UNITS.map((u) => (
                                                <option key={u.value} value={u.value}>{u.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {errors.shelfLifeSpan && <p className="mt-1 text-sm text-red-500">{errors.shelfLifeSpan}</p>}
                                </div>
                            ) : (
                                <div />
                            )}

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Is Decimal Allowed</label>
                                <select name="isDecimalAllowed" value={formData.isDecimalAllowed} onChange={handleChange} className={selectClass("isDecimalAllowed")}>
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Remarks</label>
                                <input type="text" name="remarks" value={formData.remarks} onChange={handleChange}
                                    placeholder="Optional notes..." className={inputClass("remarks")} />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Archive</label>
                                <select name="archive" value={formData.archive} onChange={handleChange} className={selectClass("archive")}>
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                                <select name="status" value={formData.status} onChange={handleChange} className={selectClass("status")}>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Item Images Card — standard file input styling matching AddCompany.jsx */}
                    <div className="w-full rounded-2xl bg-white p-8 shadow-sm mb-6">
                        <h2 className="mb-6 text-lg font-semibold text-gray-700 border-b pb-3">Item Images</h2>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Item Images</label>
                            {existingImages.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-xs text-gray-500 mb-2">Current images:</p>
                                    <div className="flex flex-wrap gap-4">
                                        {existingImages.map((img) => (
                                            <div key={img.id} className="relative h-24 w-24 rounded-xl border bg-gray-100">
                                                <img src={getImageUrl(img.itemImageUrl)} alt="item" className="h-full w-full object-cover rounded-xl" />
                                                {img.isParent === 0 && (
                                                    <span className="absolute top-1 left-1 bg-blue-600 rounded-full p-0.5" title="Primary image">
                                                        <Star className="h-3 w-3 text-white" />
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeExistingImage(img.id)}
                                                    aria-label="Remove existing image"
                                                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow hover:bg-red-600 z-10 cursor-pointer"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                multiple
                                onChange={handleFileChange}
                                className={inputClass("itemImages")}
                            />
                            {filePreviews.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-xs text-gray-500 mb-2">New images to upload:</p>
                                    <div className="flex flex-wrap gap-4">
                                        {filePreviews.map((url, idx) => (
                                            <div key={idx} className="relative h-24 w-24 rounded-xl border bg-gray-100">
                                                <img src={url} alt={`new-${idx}`} className="h-full w-full object-cover rounded-xl" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeSelectedFile(idx)}
                                                    aria-label="Remove new image"
                                                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold shadow hover:bg-red-600 z-10 cursor-pointer"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-10 flex justify-center gap-4 pb-12">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="inline-flex min-w-[150px] items-center justify-center rounded-xl border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 active:scale-[0.98] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex min-w-[150px] items-center justify-center rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 active:scale-[0.98] cursor-pointer disabled:opacity-60"
                        >
                            {loading ? "Updating..." : "Update"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
