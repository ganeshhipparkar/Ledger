"use client";
import Select from "react-select";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import AsyncSelect from "react-select/async";
import dayjs from "dayjs";
import Header from "../Header";
import Loader from "../ui/Loader";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import { QuotationUpdateFormSchema } from "../Zod";
import QuotationItemsTable, { newEmptyItem, generateRowId } from "./QuotationItemsTable";
import { computeItem, getItemLabel } from "@/lib/itemTaxCalc";
import QuotationSummaryPanel from "./QuotationSummaryPanel";
import TermsConditionsWidget from "./TermsConditionsWidget";

const MySwal = withReactContent(Swal);

function formatDateForInput(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
}

function getMinExpiryDate(issueDateStr) {
    if (!issueDateStr || !dayjs(issueDateStr).isValid()) return "";
    return dayjs(issueDateStr).add(15, "day").format("YYYY-MM-DD");
}

export default function QuotationUpdate({ id }) {
    const router = useRouter();
    const { activeAssignment } = useContext(loginContext) || {};
    const companyId = activeAssignment?.companyId;

    const [saving, setSaving] = useState(false);
    const [loadState, setLoadState] = useState("loading");

    const [formData, setFormData] = useState({
        quotationCode: "",
        statusValue: "",
        customerId: "",
        customerLabel: "",
        currencyId: "",
        currencyCode: "",
        currencySymbol: "",
        currencyConversionRate: 1,
        issueDate: "",
        expiryDate: "",
        bankBookId: "",
        vatWithheld: "NO",
        salesPersonId: "",
        salesPersonLabel: "",
        remarks: "",
        termsConditionsId: null,
        termsConditionsText: "",
        existingFileName: "",
    });

    const [errors, setErrors] = useState({});
    const [itemErrors, setItemErrors] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [totals, setTotals] = useState({});

    const setFormField = (key, value) => {
        if (key === "issueDate") {
            const minExp = getMinExpiryDate(value);
            setFormData((prev) => {
                const next = { ...prev, issueDate: value };
                if (value && minExp) {
                    if (!prev.expiryDate || prev.expiryDate < minExp) {
                        next.expiryDate = minExp;
                    }
                }
                return next;
            });
            setErrors((prev) => {
                const newErr = { ...prev };
                delete newErr.issueDate;
                if (value && minExp) {
                    delete newErr.expiryDate;
                }
                return newErr;
            });
            return;
        }

        if (key === "expiryDate") {
            const minExp = getMinExpiryDate(formData.issueDate);
            let finalVal = value;
            if (value && minExp && value < minExp) {
                finalVal = minExp;
            }
            setFormData((prev) => ({ ...prev, expiryDate: finalVal }));
            if (errors.expiryDate) setErrors((prev) => ({ ...prev, expiryDate: null }));
            return;
        }

        setFormData((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
    };

    const [currencies, setCurrencies] = useState([]);
    const [bankBooks, setBankBooks] = useState([]);
    const [items, setItems] = useState([newEmptyItem()]);
    const [quotationDiscounts, setQuotationDiscounts] = useState([]);
    const [quotationExtraCharges, setQuotationExtraCharges] = useState([]);

    const [termsConditionsFile, setTermsConditionsFile] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);


    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: { ...authHeaders(), endpoint: `quotation-details/${id}`, module: "quotation" },
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (!data?.quotationId) {
                    toast.error("Quotation not found.", { position: "top-right" });
                    router.push("/quotation-list");
                    setLoadState("denied");
                    return;
                }

                if (data.parentQuotationId !== null) {
                    toast.error("Only the latest version of a quotation can perform this action.", { position: "top-right" });
                    router.push("/quotation-list");
                    setLoadState("denied");
                    return;
                }

                if (data.status !== "DRAFT") {
                    toast.error("Only DRAFT quotations can be edited.", { position: "top-right" });
                    router.push("/quotation-list");
                    setLoadState("denied");
                    return;
                }

                const rate = parseFloat(data.currencyConversionRate) || 1;

                const issDate = formatDateForInput(data.issueDate);
                const rawExpDate = formatDateForInput(data.expiryDate);
                const minExpDate = getMinExpiryDate(issDate);
                let finalExpDate = rawExpDate;
                if (issDate && minExpDate) {
                    if (!rawExpDate || rawExpDate < minExpDate) {
                        finalExpDate = minExpDate;
                    }
                }

                setFormData({
                    quotationCode: data.quotationCode ?? "",
                    statusValue: data.status ?? "",
                    customerId: String(data.customerId ?? ""),
                    customerLabel: data.customerName ?? "",
                    currencyId: String(data.currencyId ?? ""),
                    currencyCode: data.currencyCode ?? "",
                    currencySymbol: "",
                    currencyConversionRate: rate,
                    issueDate: issDate,
                    expiryDate: finalExpDate,
                    bankBookId: String(data.bankBookId ?? ""),
                    vatWithheld: data.vatWithheld ?? "NO",
                    salesPersonId: String(data.salesPersonId ?? ""),
                    salesPersonLabel: data.salesPersonName ?? "",
                    remarks: data.remarks ?? "",
                    termsConditionsId: data.termsConditionsId ?? null,
                    termsConditionsText: data.termsConditionsText ?? "",
                    existingFileName: data.termsConditionsFileName ?? "",
                });

                setExistingAttachments(data.attachments ?? []);

                const custRes = await fetch("/relayapi", {
                    method: "GET",
                    headers: { ...authHeaders(), endpoint: `customer-details/${data.customerId}`, module: "customer" },
                });
                const custPayload = await custRes.json();
                const custData = custPayload.encrypted ? decryptResponse(custPayload.encrypted) : custPayload;
                setCurrencies(custData?.currencies ?? []);
                const cur = (custData?.currencies ?? []).find(
                    (c) => String(c.curId ?? c.currencyId) === String(data.currencyId)
                );
                if (cur?.symbol) {
                    setFormData((prev) => ({ ...prev, currencySymbol: cur.symbol }));
                }

                const rawHeaderDisc = data.discounts || data.quotationDiscounts || [];
                setQuotationDiscounts(rawHeaderDisc.map((d) => ({
                    id: d.quotationDiscountId || d.id,
                    description: d.discountDescription || d.description || "",
                    amount: parseFloat(d.discountPrice ?? d.amount) || 0,
                    discountDescription: d.discountDescription || d.description || "",
                    discountPrice: parseFloat(d.discountPrice ?? d.amount) || 0,
                })));

                const rawHeaderEC = data.extraCharges || data.quotationExtraCharges || [];
                setQuotationExtraCharges(rawHeaderEC.map((ec) => ({
                    id: ec.quotationExtraChargeId || ec.id,
                    description: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                    amount: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                    extraChargesDescription: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                    extraChargesPrice: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                })));

                if (data.quotationItems?.length) {
                    setItems(data.quotationItems.map((it) => {
                        const unitPriceVal = parseFloat(it.unitPrice) || 0;
                        const basePrice = parseFloat(it.item?.convertedCostPerUnit) || (parseFloat(it.item?.costPerUnit) / (parseFloat(it.item?.conversionRate) || 1)) || (unitPriceVal / rate) || 0;
                        const loadedTaxCalc = it.taxCalculation === "NA" ? "N/A" : (it.taxCalculation ?? "N/A");
                        const isTaxableLoad = loadedTaxCalc === "EXCLUSIVE" || loadedTaxCalc === "INCLUSIVE";
                        const loadedTaxable = parseFloat(it.taxableAmount) || 0;
                        const loadedTaxAmt = parseFloat(it.taxAmount) || 0;
                        const derivedTaxRate = parseFloat(it.taxRate) || (isTaxableLoad && loadedTaxable > 0 ? (loadedTaxAmt / loadedTaxable) * 100 : 0);

                        return computeItem({
                            _id: generateRowId(),
                            itemId: String(it.itemId ?? it.item?.itemId ?? it.id ?? ""),
                            itemLabel: getItemLabel(it),
                            description: it.description ?? "",
                            isDecimalAllowed: true,
                            baseCurrencyPrice: basePrice,
                            quantity: it.quantity,
                            unitPrice: unitPriceVal,
                            taxCalculation: loadedTaxCalc,
                            taxGroup: it.taxGroup ?? "",
                            taxGroupLabel: it.taxGroup ?? "",
                            taxRate: derivedTaxRate,
                            taxAmount: loadedTaxAmt,
                            taxableAmount: loadedTaxable,
                            totalAmount: parseFloat(it.totalAmount) || 0,
                            finalAmount: parseFloat(it.finalAmount) || 0,
                            discounts: (it.discounts || []).map((d) => ({
                                id: d.quotationDiscountId || d.id,
                                description: d.discountDescription || d.description || "",
                                amount: parseFloat(d.discountPrice ?? d.amount) || 0,
                                discountDescription: d.discountDescription || d.description || "",
                                discountPrice: parseFloat(d.discountPrice ?? d.amount) || 0,
                            })),
                            extraCharges: (it.extraCharges || []).map((ec) => ({
                                id: ec.quotationExtraChargeId || ec.id,
                                description: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                                amount: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                                extraChargesDescription: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                                extraChargesPrice: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                            })),
                        });
                    }));
                }
                setLoadState("ok");
            } catch (err) {
                toast.error(`Load error: ${err.message}`, { position: "top-right" });
                setLoadState("denied");
            }
        })();
    }, [id]);

    useEffect(() => {
        if (!companyId) return;
        (async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "POST",
                    headers: { ...authHeaders(), endpoint: "bank-book-list", module: "bank-book", "Content-Type": "application/json" },
                    body: JSON.stringify({ page: 1, limit: 200, filters: [{ key: "companyId", value: String(companyId), operator: "eq" }] }),
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                setBankBooks(data?.data ?? []);
            } catch { setBankBooks([]); }
        })();
    }, [companyId]);

    const loadSalesPersonOptions = (inputValue, callback) => {
        if (!companyId) return callback([]);
        fetch("/relayapi", {
            method: "POST",
            headers: {
                ...authHeaders(),
                endpoint: "user-list",
                module: "user",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                page: 1,
                limit: 20,
                filters: [
                    { key: "companyId", value: String(companyId), operator: "eq" },
                    ...(inputValue ? [{ key: "name", value: inputValue, operator: "like" }] : []),
                ],
            }),
        })
            .then((res) => res.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const options = (data?.data ?? []).map((u) => ({
                    value: u.userId,
                    label: u.name,
                    raw: u,
                }));
                callback(options);
            })
            .catch(() => callback([]));
    };



    const loadCustomerOptions = (inputValue, callback) => {
        if (!companyId || !formData.customerId) return callback([]);
        fetch("/relayapi", {
            method: "POST",
            headers: {
                ...authHeaders(),
                endpoint: "customer-currencies-list",
                module: "customer",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                page: 1,
                limit: 20,
                filters: [
                    { key: "customerId", value: String(formData.customerId), operator: "eq" },
                    ...(inputValue ? [{ key: "customerName", value: inputValue, operator: "like" }] : []),
                ],
            }),
        })
            .then((res) => res.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const options = (data?.data?.data ?? data?.data ?? []).map((c) => ({
                    value: `${c.customerId}_${c.curId}`,
                    label: `${c.customer?.customerName} (${c.currency?.code})`,
                    raw: c,
                }));
                // Check if current combination exists in the options
                if (formData.customerId && formData.currencyId) {
                    const existingValue = `${formData.customerId}_${formData.currencyId}`;
                    if (!options.some((o) => o.value === existingValue)) {
                        options.unshift({
                            value: existingValue,
                            label: formData.currencyCode ? `${formData.customerLabel} (${formData.currencyCode})` : formData.customerLabel,
                            raw: null,
                        });
                    }
                }
                callback(options);
            })
            .catch(() => callback([]));
    };

    const handleCustomerCurrencySelect = async (option) => {
        if (!option) {
            setFormData((prev) => ({
                ...prev,
                customerId: "",
                customerLabel: "",
                currencyId: "",
                currencyCode: "",
                currencySymbol: "",
                currencyConversionRate: 0,
                bankBookId: "",
            }));
            setCurrencies([]);
            setItems((prevItems) => prevItems.map((it) => computeItem({ ...it, unitPrice: 0 })));
            return;
        }

        const raw = option.raw;
        if (!raw) return;

        const custId = raw.customerId;
        const custName = raw.customer?.customerName || "";
        const curId = raw.curId;

        setFormData((prev) => ({
            ...prev,
            customerId: custId ? String(custId) : "",
            customerLabel: custName,
        }));
        if (errors.customerId) setErrors((prev) => ({ ...prev, customerId: null }));

        if (!custId) return;

        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: { ...authHeaders(), endpoint: `customer-details/${custId}`, module: "customer" },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            const fetchedCurrencies = data?.currencies ?? [];
            setCurrencies(fetchedCurrencies);

            const cur = fetchedCurrencies.find((c) => String(c.curId ?? c.id ?? c.currencyId) === String(curId));
            const newRate = parseFloat(cur?.conversionRate) || 0;

            setFormData((prev) => {
                const currentBb = bankBooks.find((b) => String(b.bankBookId) === String(prev.bankBookId));
                const isBbValid = currentBb && String(currentBb.currencyId) === String(curId);
                return {
                    ...prev,
                    currencyId: String(curId),
                    currencyCode: cur?.code ?? raw.currency?.code ?? "",
                    currencySymbol: cur?.symbol ?? raw.currency?.symbol ?? "",
                    currencyConversionRate: newRate,
                    bankBookId: isBbValid ? prev.bankBookId : "",
                };
            });
            if (errors.currencyId) setErrors((prev) => ({ ...prev, currencyId: null }));
            if (errors.bankBookId) setErrors((prev) => ({ ...prev, bankBookId: null }));

            setItems((prevItems) =>
                prevItems.map((it) => {
                    if (!it.itemId) return it;
                    const basePrice = parseFloat(it.baseCurrencyPrice) || 0;
                    const newUnitPrice = newRate > 0 ? basePrice * newRate : 0;
                    return computeItem({
                        ...it,
                        unitPrice: parseFloat(newUnitPrice.toFixed(4)),
                    });
                })
            );
        } catch {
            setCurrencies([]);
        }
    };


    const handleDiscard = async () => {
        const result = await MySwal.fire({
            title: "Discard changes?",
            text: "All unsaved changes will be lost.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Discard",
            confirmButtonColor: "#ef4444",
            cancelButtonText: "Keep editing",
        });
        if (result.isConfirmed) router.push(`/quotation/${id}`);
    };
    const handleSubmit = async (status) => {
        setSubmitAttempted(true);
        const payloadToValidate = { ...formData, items, quotationId: parseInt(id) };

        const parseRes = QuotationUpdateFormSchema.safeParse(payloadToValidate);
        if (!parseRes.success) {
            const fieldErrors = {};
            const itemErrors = {};
            parseRes.error.issues.forEach((err) => {
                if (err.path[0] === "items" && typeof err.path[1] === "number") {
                    const idx = err.path[1];
                    const field = err.path[2];
                    itemErrors[idx] = { ...(itemErrors[idx] || {}), [field]: err.message };
                } else {
                    const field = err.path[0];
                    if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
                }
            });
            setErrors(fieldErrors);
            setItemErrors(itemErrors);
            // toast.error("Please resolve the validation errors before proceeding.", { position: "top-right" });
            return;
        }

        setErrors({});
        setItemErrors({});

        if ((totals.finalAmount ?? 0) <= 0) {
            toast.error("Discount cannot be more than the total amount.", { position: "top-right" });
            return;
        }
        if (status === "DRAFT") {
            const confirm = await MySwal.fire({
                title: "Save as Draft?",
                text: "You can continue editing this later from the list.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Save as Draft",
                confirmButtonColor: "#2563eb",
            });
            if (!confirm.isConfirmed) return;
        }

        if (status === "SUBMITTED") {
            const confirm = await MySwal.fire({
                title: "Submit Quotation?",
                text: "This will mark the quotation as Submitted.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Submit",
                confirmButtonColor: "#2563eb",
            });
            if (!confirm.isConfirmed) return;
        }

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("quotationId", String(id));
            fd.append("customerId", formData.customerId);
            fd.append("currencyId", formData.currencyId);
            fd.append("currencyCode", formData.currencyCode);
            fd.append("companyId", String(companyId));
            fd.append("issueDate", formData.issueDate);
            fd.append("expiryDate", formData.expiryDate);
            fd.append("status", status);
            fd.append("vatWithheld", formData.vatWithheld);
            fd.append("currencyConversionRate", String(formData.currencyConversionRate));
            if (formData.bankBookId) fd.append("bankBookId", formData.bankBookId);
            if (formData.salesPersonId) fd.append("salesPersonId", formData.salesPersonId);
            if (formData.remarks) fd.append("remarks", formData.remarks);
            if (formData.termsConditionsId) fd.append("termsConditionsId", String(formData.termsConditionsId));
            if (formData.termsConditionsText) fd.append("termsConditionsText", formData.termsConditionsText);


            const itemsPayload = items.map((it) => {
                const rawId = it.itemId;
                const validItemId = (rawId !== "" && rawId !== null && rawId !== undefined && !isNaN(Number(rawId)) && Number(rawId) > 0)
                    ? Number(rawId)
                    : undefined;
                return {
                    itemId: validItemId,
                    description: it.description || undefined,
                    quantity: parseFloat(it.quantity) || 0,
                    unitPrice: parseFloat(it.unitPrice) || 0,
                    taxCalculation: it.taxCalculation === "N/A" ? "NA" : (it.taxCalculation || "NA"),
                    taxGroup: it.taxGroup || undefined,
                    discounts: (it.discounts || []).map((d) => ({
                        discountDescription: d.discountDescription || d.description,
                        discountPrice: parseFloat(d.discountPrice ?? d.amount) || 0,
                    })),
                    extraCharges: (it.extraCharges || []).map((ec) => ({
                        extraChargesDescription: ec.extraChargesDescription || ec.extraChargeDescription || ec.description,
                        extraChargesPrice: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                    })),
                };
            });
            fd.append("quotationItems", JSON.stringify(itemsPayload));

            const quotDiscounts = quotationDiscounts.map((d) => ({
                discountDescription: d.discountDescription || d.description || "",
                discountPrice: parseFloat(d.discountPrice ?? d.amount) || 0,
            }));
            fd.append("quotationDiscounts", JSON.stringify(quotDiscounts));

            const quotExtraCharges = quotationExtraCharges.map((ec) => ({
                extraChargesDescription: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                extraChargesPrice: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
            }));
            fd.append("quotationExtraCharges", JSON.stringify(quotExtraCharges));

            if (termsConditionsFile) fd.append("termsConditionsFile", termsConditionsFile);
            selectedFiles.forEach((f) => fd.append("attachments", f));

            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: { endpoint: "quotation-update", module: "quotation" },
                body: fd,
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success("Quotation updated successfully.", { position: "top-right" });
                router.push(`/quotation/${id}`);
            } else {
                toast.error(data?.message || "Failed to update.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`, { position: "top-right" });
        } finally {
            setSaving(false);
        }
    };

    if (loadState === "loading") {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
                <Loader label="Loading quotation..." />
            </div>
        );
    }
    if (loadState === "denied") return null;

    return (
        <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
            <Header page="quotation-update" />

            <div className="px-6 pt-4">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/quotation-list")}>Quotations</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push(`/quotation/${id}`)}>Quotation</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Edit</span>
                </nav>
            </div>

            <div className="flex-1 px-6 py-4 pb-24 space-y-5">
                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Customer <span className="text-red-500">*</span></label>
                            <AsyncSelect
                                instanceId="customer-select"
                                cacheOptions
                                defaultOptions
                                loadOptions={loadCustomerOptions}
                                value={formData.customerId && formData.currencyId ? {
                                    value: `${formData.customerId}_${formData.currencyId}`,
                                    label: formData.currencyCode ? `${formData.customerLabel} (${formData.currencyCode})` : formData.customerLabel
                                } : null}
                                onChange={handleCustomerCurrencySelect}
                                placeholder="Search customer..."
                                isClearable
                                classNamePrefix="react-select"
                                styles={{
                                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                    control: (base) => ({
                                        ...base,
                                        borderRadius: "0.75rem",
                                        borderColor: errors.customerId ? "#ef4444" : "#d1d5db",
                                        padding: "1px",
                                        fontSize: "0.875rem",
                                        boxShadow: "none",
                                        "&:hover": { borderColor: errors.customerId ? "#ef4444" : "#3b82f6" },
                                    }),
                                }}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {errors.customerId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.customerId}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Issue Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={formData.issueDate}
                                onChange={(e) => setFormField("issueDate", e.target.value)}
                                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 cursor-pointer ${errors.issueDate ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                                    }`}
                            />
                            {errors.issueDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.issueDate}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Expiry Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={formData.expiryDate}
                                min={getMinExpiryDate(formData.issueDate)}
                                onChange={(e) => setFormField("expiryDate", e.target.value)}
                                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 cursor-pointer ${errors.expiryDate ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                                    }`}
                            />
                            {errors.expiryDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.expiryDate}</p>}
                        </div>
                    </div>
                </div>

                <div>
                    <QuotationItemsTable
                        items={items}
                        onChange={(newItems) => {
                            setItems(newItems);
                            if (errors.items) setErrors((prev) => ({ ...prev, items: null }));
                        }}
                        companyId={companyId}
                        submitAttempted={submitAttempted}
                        itemErrors={itemErrors}
                        currencyConversionRate={formData.currencyConversionRate}
                        currencySymbol={formData.currencySymbol}
                    />
                    {errors.items && <p className="text-red-500 text-xs mt-1 font-medium px-2">{errors.items}</p>}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-7 space-y-5">
                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                        Bank Account <span className="text-red-500">*</span>
                                    </label>
                                    {(() => {
                                        const filteredBankBooks = formData.currencyId
                                            ? bankBooks.filter((b) => String(b.currencyId) === String(formData.currencyId))
                                            : [];
                                        return (
                                            <>
                                                <Select
                                                    instanceId="bank-book-select"
                                                    value={formData.bankBookId ? {
                                                        value: formData.bankBookId, label: filteredBankBooks.find(b => String(b.bankBookId ?? b.value) === String(formData.bankBookId)) ? (() => {
                                                            const bb = filteredBankBooks.find(b => String(b.bankBookId ?? b.value) === String(formData.bankBookId));
                                                            const baseName = bb.bankBookName || (bb.accountNumber ? `${bb.accountNumber}${bb.bankName ? ` — ${bb.bankName}` : ""}` : `Bank Account #${bb.bankBookId ?? bb.value}`);
                                                            const currencyStr = bb.currencyCode || bb.currency?.code || currencies.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.curCode || currencies.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.currencyCode || currencies.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.code || "";
                                                            return currencyStr ? `${baseName} (${currencyStr})` : baseName;
                                                        })() : formData.bankBookLabel
                                                    } : null}
                                                    onChange={(selected) => {
                                                        const val = selected ? selected.value : "";
                                                        const bb = bankBooks.find((b) => String(b.bankBookId ?? b.value) === val);
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            bankBookId: val,
                                                            bankBookLabel: bb?.accountNumber ?? bb?.bankBookName ?? "",
                                                        }));
                                                        if (errors.bankBookId) setErrors((prev) => ({ ...prev, bankBookId: null }));
                                                    }}
                                                    options={filteredBankBooks.map(bb => {
                                                        const baseName = bb.bankBookName || (bb.accountNumber ? `${bb.accountNumber}${bb.bankName ? ` — ${bb.bankName}` : ""}` : `Bank Account #${bb.bankBookId ?? bb.value}`);
                                                        const currencyStr = bb.currencyCode || bb.currency?.code || currencies.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.curCode || currencies.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.currencyCode || currencies.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.code || "";
                                                        return {
                                                            value: String(bb.bankBookId ?? bb.value),
                                                            label: currencyStr ? `${baseName} (${currencyStr})` : baseName
                                                        };
                                                    })}
                                                    isDisabled={!formData.currencyId || filteredBankBooks.length === 0}
                                                    isClearable
                                                    placeholder={formData.currencyId ? "-- Select bank account --" : "Select currency first"}
                                                    classNamePrefix="react-select"
                                                    styles={{
                                                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                        control: (base) => ({
                                                            ...base,
                                                            borderRadius: "0.75rem",
                                                            borderColor: errors.bankBookId ? "#ef4444" : "#d1d5db",
                                                            padding: "1px",
                                                            fontSize: "0.875rem",
                                                            boxShadow: "none",
                                                            "&:hover": { borderColor: errors.bankBookId ? "#ef4444" : "#3b82f6" },
                                                        }),
                                                    }}
                                                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                                />
                                            </>
                                        );
                                    })()}
                                    {errors.bankBookId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.bankBookId}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">VAT Withheld <span className="text-red-500">*</span></label>
                                    <Select
                                        instanceId="vat-withheld-select"
                                        value={formData.vatWithheld ? {
                                            value: formData.vatWithheld, label: [
                                                { value: "NO", label: "No" },
                                                { value: "YES", label: "Yes" }
                                            ].find(o => String(o.value) === String(formData.vatWithheld))?.label || formData.vatWithheld
                                        } : null}
                                        onChange={(selected) => setFormField("vatWithheld", selected ? selected.value : "")}
                                        options={[
                                            { value: "NO", label: "No" },
                                            { value: "YES", label: "Yes" }
                                        ]}
                                        isClearable

                                        placeholder="No"
                                        classNamePrefix="react-select"
                                        styles={{
                                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                            control: (base) => ({
                                                ...base,
                                                borderRadius: "0.75rem",
                                                borderColor: errors.vatWithheld ? "#ef4444" : "#d1d5db",
                                                padding: "1px",
                                                fontSize: "0.875rem",
                                                boxShadow: "none",
                                                "&:hover": { borderColor: errors.vatWithheld ? "#ef4444" : "#3b82f6" },
                                            }),
                                        }}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                        Sales Person <span className="text-red-500">*</span>
                                    </label>
                                    <AsyncSelect
                                        instanceId="sales-person-select"
                                        cacheOptions
                                        defaultOptions
                                        loadOptions={loadSalesPersonOptions}
                                        value={formData.salesPersonId ? { value: formData.salesPersonId, label: formData.salesPersonLabel } : null}
                                        onChange={(selected) => {
                                            setFormData((prev) => ({
                                                ...prev,
                                                salesPersonId: selected ? String(selected.value) : "",
                                                salesPersonLabel: selected ? selected.label : "",
                                            }));
                                            if (errors.salesPersonId) setErrors((prev) => ({ ...prev, salesPersonId: null }));
                                        }}
                                        placeholder="Search user..."
                                        isClearable
                                        classNamePrefix="react-select"
                                        styles={{
                                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                            control: (base) => ({
                                                ...base,
                                                borderRadius: "0.75rem",
                                                borderColor: errors.salesPersonId ? "#ef4444" : "#d1d5db",
                                                padding: "1px",
                                                fontSize: "0.875rem",
                                                boxShadow: "none",
                                                "&:hover": { borderColor: errors.salesPersonId ? "#ef4444" : "#3b82f6" },
                                            }),
                                        }}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                    {errors.salesPersonId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.salesPersonId}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                            <textarea
                                value={formData.remarks}
                                onChange={(e) => setFormField("remarks", e.target.value)}
                                rows={4}
                                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                            />
                            <p className="text-right text-xs text-gray-400 mt-1">{formData.remarks.length} characters</p>
                        </div>

                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                            <TermsConditionsWidget
                                companyId={companyId}
                                termsConditionsId={formData.termsConditionsId}
                                termsConditionsText={formData.termsConditionsText}
                                termsConditionsFile={termsConditionsFile}
                                onFileChange={setTermsConditionsFile}
                                onTemplateChange={(val) => setFormField("termsConditionsId", val)}
                                onTextChange={(val) => setFormField("termsConditionsText", val)}
                                existingFileName={formData.existingFileName}
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-5 space-y-5">
                        <QuotationSummaryPanel
                            items={items}
                            quotationDiscounts={quotationDiscounts}
                            quotationExtraCharges={quotationExtraCharges}
                            vatWithheld={formData.vatWithheld}
                            currencyCode={formData.currencyCode}
                            currencySymbol={formData.currencySymbol}
                            onDiscountsChange={setQuotationDiscounts}
                            onExtraChargesChange={setQuotationExtraCharges}
                            selectedFiles={selectedFiles}
                            onFilesChange={setSelectedFiles}
                            existingAttachments={existingAttachments}

                            readOnly={false}
                            onTotalsChange={setTotals}
                        />
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-center gap-4 shadow-lg">
                <button type="button" onClick={handleDiscard}
                    className="rounded-xl border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                    Discard
                </button>
                <button type="button" onClick={() => handleSubmit("DRAFT")} disabled={saving}
                    className="rounded-xl border border-blue-600 bg-white px-8 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer disabled:opacity-50">
                    {saving ? "Saving..." : "Save As Draft"}
                </button>
                <button type="button" onClick={() => handleSubmit("SUBMITTED")} disabled={saving}
                    className="rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer disabled:opacity-50">
                    {saving ? "Submitting..." : "Submit"}
                </button>
            </div>
        </div>
    );
}
