"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { QuotationFormSchema } from "../Zod";
import QuotationItemsTable, { newEmptyItem, computeItem, generateRowId, getItemLabel } from "./QuotationItemsTable";
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

export default function AddQuotation() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { activeAssignment } = useContext(loginContext) || {};

    const cloneFromId = searchParams.get("cloneFrom");
    const changeFromId = searchParams.get("changeFrom");
    const isChangeMode = !!changeFromId;
    const isCloneMode = !!cloneFromId;

    const companyId = activeAssignment?.companyId;

    const [formData, setFormData] = useState({
        customerId: "",
        customerLabel: "",
        currencyId: "",
        currencyCode: "",
        currencySymbol: "",
        currencyConversionRate: 0,
        issueDate: "",
        expiryDate: "",
        bankBookId: "",
        bankBookLabel: "",
        vatWithheld: "NO",
        salesPersonId: "",
        salesPersonLabel: "",
        remarks: "",
        termsConditionsId: null,
        termsConditionsText: "",
        parentQuotationId: null,
    });

    const [errors, setErrors] = useState({});

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
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]);

    const [loading, setLoading] = useState(false);
    const [prefillState, setPrefillState] = useState(cloneFromId || changeFromId ? "loading" : "ok");

    const [lockedCustomer, setLockedCustomer] = useState(false);
    const [versionCodeDisplay, setVersionCodeDisplay] = useState("");

    useEffect(() => {
        const sourceId = cloneFromId || changeFromId;
        if (!sourceId) return;
        (async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: { ...authHeaders(), endpoint: `quotation-details/${sourceId}`, module: "quotation" },
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (!data?.quotationId) {
                    setPrefillState("denied");
                    return;
                }
                if (data.parentQuotationId !== null) {
                    toast.error("Only the latest version of a quotation can perform this action.", { position: "top-right" });
                    router.replace(`/quotation/${sourceId}`);
                    setPrefillState("denied");
                    return;
                }

                if (isChangeMode && data.status !== "SUBMITTED") {
                    toast.error("Only submitted quotations can be changed.", { position: "top-right" });
                    router.replace(`/quotation/${sourceId}`);
                    setPrefillState("denied");
                    return;
                }

                const rate = parseFloat(data.currencyConversionRate) || 1;

                if (data.customerId) {
                    const custRes = await fetch("/relayapi", {
                        method: "GET",
                        headers: { ...authHeaders(), endpoint: `customer-details/${data.customerId}`, module: "customer" },
                    });
                    const custPayload = await custRes.json();
                    const custData = custPayload.encrypted ? decryptResponse(custPayload.encrypted) : custPayload;
                    setCurrencies(custData?.currencies ?? []);
                }

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
                    customerId: String(data.customerId ?? ""),
                    customerLabel: data.customerName ?? "",
                    currencyId: String(data.currencyId ?? ""),
                    currencyCode: data.currencyCode ?? "",
                    currencySymbol: data.currencySymbol ?? "",
                    currencyConversionRate: rate,
                    issueDate: issDate,
                    expiryDate: finalExpDate,
                    bankBookId: String(data.bankBookId ?? ""),
                    bankBookLabel: data.bankBookName ?? "",
                    vatWithheld: data.vatWithheld ?? "NO",
                    salesPersonId: String(data.salesPersonId ?? ""),
                    salesPersonLabel: data.salesPersonName ?? "",
                    remarks: data.remarks ?? "",
                    termsConditionsId: data.termsConditionsId ?? null,
                    termsConditionsText: data.termsConditionsText ?? "",
                    parentQuotationId: isChangeMode ? data.quotationId : null,
                });

                const rawHeaderDisc = data.discounts || data.quotationDiscounts || [];
                if (rawHeaderDisc.length) {
                    setQuotationDiscounts(rawHeaderDisc.map((d) => ({
                        id: d.quotationDiscountId || d.id,
                        description: d.discountDescription || d.description || "",
                        amount: parseFloat(d.discountPrice ?? d.amount) || 0,
                        discountDescription: d.discountDescription || d.description || "",
                        discountPrice: parseFloat(d.discountPrice ?? d.amount) || 0,
                    })));
                }

                const rawHeaderEC = data.extraCharges || data.quotationExtraCharges || [];
                if (rawHeaderEC.length) {
                    setQuotationExtraCharges(rawHeaderEC.map((ec) => ({
                        id: ec.quotationExtraChargeId || ec.id,
                        description: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                        amount: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                        extraChargesDescription: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                        extraChargesPrice: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                    })));
                }

                if (data.quotationItems?.length) {
                    setItems(
                        data.quotationItems.map((it) => {
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
                        })
                    );
                }

                if (isChangeMode) {
                    setLockedCustomer(true);
                    setVersionCodeDisplay("(auto-generated)");
                }
                setPrefillState("ok");
            } catch {
                toast.error("Failed to load source quotation for prefill.", { position: "top-right" });
                setPrefillState("denied");
            }
        })();
    }, [cloneFromId, changeFromId]);

    const loadCustomerOptions = (inputValue, callback) => {
        if (!companyId) return callback([]);
        fetch("/relayapi", {
            method: "POST",
            headers: {
                ...authHeaders(),
                endpoint: "customer-list",
                module: "customer",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                page: 1,
                limit: 20,
                filters: [
                    { key: "companyId", value: String(companyId), operator: "eq" },
                    ...(inputValue ? [{ key: "customerName", value: inputValue, operator: "like" }] : []),
                ],
            }),
        })
            .then((res) => res.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const options = (data?.data ?? []).map((c) => ({
                    value: c.customerId,
                    label: c.customerName,
                    raw: c,
                }));
                callback(options);
            })
            .catch(() => callback([]));
    };

    const handleCustomerSelect = async (cust) => {
        if (!cust) {
            setFormData((prev) => ({
                ...prev,
                customerId: "",
                customerLabel: "",
                currencyId: "",
                currencyCode: "",
                currencySymbol: "",
                currencyConversionRate: 0,
                bankBookId: "",
                bankBookLabel: "",
            }));
            setCurrencies([]);
            setItems((prevItems) => prevItems.map((it) => computeItem({ ...it, unitPrice: 0 })));
            return;
        }

        const custId = cust.customerId ?? cust.value ?? cust.id;
        const custName = cust.customerName ?? cust.label ?? "";

        setFormData((prev) => ({
            ...prev,
            customerId: custId ? String(custId) : "",
            customerLabel: custName,
            currencyId: "",
            currencyCode: "",
            currencySymbol: "",
            currencyConversionRate: 0,
            bankBookId: "",
            bankBookLabel: "",
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
            setCurrencies(data?.currencies ?? []);
        } catch {
            setCurrencies([]);
        }
    };

    const handleCurrencySelect = (curId) => {
        const cur = currencies.find((c) => String(c.curId ?? c.id ?? c.currencyId) === String(curId));
        const newRate = parseFloat(cur?.conversionRate) || 0;

        setFormData((prev) => {
            const currentBb = bankBooks.find((b) => String(b.bankBookId) === String(prev.bankBookId));
            const isBbValid = currentBb && String(currentBb.currencyId) === String(curId);
            return {
                ...prev,
                currencyId: String(curId),
                currencyCode: cur?.code ?? "",
                currencySymbol: cur?.symbol ?? "",
                currencyConversionRate: newRate,
                bankBookId: isBbValid ? prev.bankBookId : "",
                bankBookLabel: isBbValid ? prev.bankBookLabel : "",
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
    };

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
            } catch {
                setBankBooks([]);
            }
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
                self: "true",
            },
            body: JSON.stringify({
                page: 1,
                limit: 20,
                filters: [
                    ...(inputValue ? [{ key: "name", value: inputValue, operator: "contains" }] : []),
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

    const handleDiscard = async () => {
        const result = await MySwal.fire({
            title: "Discard changes?",
            text: "All unsaved data will be lost.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Discard",
            confirmButtonColor: "#ef4444",
            cancelButtonText: "Keep editing",
        });
        if (result.isConfirmed) router.push("/quotation-list");
    };

    const handleSubmit = async (status) => {
        const payloadToValidate = {
            ...formData,
            items,
        };

        const parseRes = QuotationFormSchema.safeParse(payloadToValidate);
        if (!parseRes.success) {
            const fieldErrors = {};
            parseRes.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) {
                    fieldErrors[field] = err.message;
                }
            });
            setErrors(fieldErrors);
            // toast.error("Please resolve the validation errors before proceeding.", { position: "top-right" });
            return;
        }

        setErrors({});

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

        setLoading(true);
        try {
            const fd = new FormData();
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
            if (formData.parentQuotationId) fd.append("parentQuotationId", String(formData.parentQuotationId));
            if (cloneFromId) fd.append("cloneFromId", String(cloneFromId));

            const itemsPayload = items.map((it) => {
                const rawId = it.itemId;
                const validItemId = (rawId !== "" && rawId !== null && rawId !== undefined && !isNaN(Number(rawId)) && Number(rawId) > 0)
                    ? Number(rawId)
                    : undefined;
                return {
                    itemId: validItemId,
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
            console.log(...fd)
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { endpoint: "quotation-add", module: "quotation" },
                body: fd,
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.success === 1) {
                toast.success("Quotation saved successfully.", { position: "top-right" });
                router.push("/quotation-list");
            } else {
                toast.error(data?.message || "Failed to save quotation.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    if (prefillState === "loading") {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center">
                <Loader label="Loading quotation data..." />
            </div>
        );
    }
    if (prefillState === "denied") return null;

    const modeTitle = isChangeMode ? "Change Quotation" : isCloneMode ? "Clone Quotation" : "Add Quotation";

    return (
        <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
            <Header page="add-quotation" />

            <div className="px-6 pt-4">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/quotation-list")}>Quotations </span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Quotation</span>
                </nav>
            </div>

            <div className="flex-1 px-6 py-4 pb-24 space-y-5">

                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Customer <span className="text-red-500">*</span>
                            </label>
                            {lockedCustomer ? (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium">
                                    {formData.customerLabel}
                                </div>
                            ) : (
                                <AsyncSelect
                                    instanceId="customer-select"
                                    cacheOptions
                                    // defaultOptions
                                    loadOptions={loadCustomerOptions}
                                    value={formData.customerId ? { value: formData.customerId, label: formData.customerLabel } : null}
                                    onChange={(selected) => handleCustomerSelect(selected?.raw || null)}
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
                            )}
                            {errors.customerId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.customerId}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Currency <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.currencyId}
                                onChange={(e) => handleCurrencySelect(e.target.value)}
                                disabled={!formData.customerId || currencies.length === 0}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${errors.currencyId ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"
                                    }`}
                            >
                                <option value="">{formData.customerId ? "Select currency" : "Select customer first"}</option>
                                {currencies.map((c, curIdx) => (
                                    <option key={c.curId ?? c.currencyId ?? `cur-${curIdx}`} value={c.curId ?? c.currencyId}>
                                        {c.code} {c.symbol ? `(${c.symbol})` : ""}
                                    </option>
                                ))}
                            </select>
                            {errors.currencyId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.currencyId}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Issue Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.issueDate}
                                onChange={(e) => setFormField("issueDate", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 cursor-pointer ${errors.issueDate ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"
                                    }`}
                            />
                            {errors.issueDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.issueDate}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Expiry Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.expiryDate}
                                min={getMinExpiryDate(formData.issueDate)}
                                onChange={(e) => setFormField("expiryDate", e.target.value)}
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
                                                <select
                                                    value={formData.bankBookId}
                                                    onChange={(e) => {
                                                        const bb = bankBooks.find((b) => String(b.bankBookId) === e.target.value);
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            bankBookId: e.target.value,
                                                            bankBookLabel: bb?.accountNumber ?? "",
                                                        }));
                                                        if (errors.bankBookId) setErrors((prev) => ({ ...prev, bankBookId: null }));
                                                    }}
                                                    disabled={!formData.currencyId || filteredBankBooks.length === 0}
                                                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${errors.bankBookId ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"
                                                        }`}
                                                >
                                                    <option value="">
                                                        {formData.currencyId ? "-- Select bank account --" : "Select currency first"}
                                                    </option>
                                                    {filteredBankBooks.map((bb, bbIdx) => {
                                                        const baseName = bb.bankBookName || (bb.accountNumber ? `${bb.accountNumber}${bb.bankName ? ` — ${bb.bankName}` : ""}` : `Bank Account #${bb.bankBookId}`);
                                                        const currencyStr = bb.currencyCode || bb.currency?.code || currencies.find((c) => String(c.currencyId ?? c.id) === String(bb.currencyId))?.currencyCode || currencies.find((c) => String(c.currencyId ?? c.id) === String(bb.currencyId))?.code || "";
                                                        const labelText = currencyStr ? `${baseName} (${currencyStr})` : baseName;
                                                        return (
                                                            <option key={bb.bankBookId ?? `bb-${bbIdx}`} value={bb.bankBookId}>
                                                                {labelText}
                                                            </option>
                                                        );
                                                    })}
                                                </select>

                                            </>
                                        );
                                    })()}
                                    {errors.bankBookId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.bankBookId}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                        VAT Withheld <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.vatWithheld}
                                        onChange={(e) => setFormField("vatWithheld", e.target.value)}
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 cursor-pointer"
                                    >
                                        <option value="NO">No</option>
                                        <option value="YES">Yes</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                        Sales Person <span className="text-red-500">*</span>
                                    </label>
                                    <AsyncSelect
                                        instanceId="sales-person-select"
                                        cacheOptions
                                        // defaultOptions
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
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <span className="text-gray-400">☰</span> Remarks
                            </label>
                            <textarea
                                value={formData.remarks}
                                onChange={(e) => setFormField("remarks", e.target.value)}
                                rows={4}
                                placeholder="Optional remarks..."
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
                            onDeleteExisting={(id) => setDeletedAttachmentIds((prev) => [...prev, id])}
                        />
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-4 shadow-lg">
                <button
                    type="button"
                    onClick={handleDiscard}
                    className="rounded-xl border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                    Discard
                </button>
                <button
                    type="button"
                    onClick={() => handleSubmit("DRAFT")}
                    disabled={loading}
                    className="rounded-xl border border-blue-600 bg-white px-8 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer disabled:opacity-50"
                >
                    {loading ? "Saving..." : "Save As Draft"}
                </button>
                <button
                    type="button"
                    onClick={() => handleSubmit("SUBMITTED")}
                    disabled={loading}
                    className="rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                >
                    {loading ? "Submitting..." : "Submit"}
                </button>
            </div>
        </div>
    );
}
