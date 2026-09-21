"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import AsyncSelect from "react-select/async";
import Select from "react-select";
import Header from "../Header";
import Loader from "../ui/Loader";
import FormattedNumberInput from "../ui/FormattedNumberInput";
import InvoiceItemsTable, { newEmptyItem } from "./InvoiceItemsTable";
import InvoiceSummaryPanel from "./InvoiceSummaryPanel";
import TermsConditionsWidget from "../quotation/TermsConditionsWidget";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import { computeItem } from "@/lib/itemTaxCalc";

const MySwal = withReactContent(Swal);

// ─── Constants ────────────────────────────────────────────────────────────────
const BUSINESS_TERMS_OPTIONS = [
    { value: "TWELVE_DAYS", label: "12 Days" },
    { value: "FIVE_DAYS", label: "5 Days" },
    { value: "SEVEN_DAYS", label: "7 Days" },
    { value: "CASH_IN_ADVANCE", label: "Cash in Advance" },
    { value: "CASH_NEXT_DELIVERY", label: "Cash Next Delivery" },
];

const PAYMENT_TYPE_OPTIONS = [
    { value: "CREDIT", label: "Credit" },
    { value: "CASH", label: "Cash" },
];

const VAT_WITHHELD_OPTIONS = [
    { value: "NO", label: "No" },
    { value: "YES", label: "Yes" },
];

const DISCOUNT_APPLICABLE_OPTIONS = [
    { value: "ON_EACH_DELIVERY", label: "On Each Delivery" },
    { value: "ON_LAST_DELIVERY", label: "On Last Delivery" },
];

const DELIVERY_TYPE_OPTIONS = [
    { value: "LOCAL", label: "Local" },
    { value: "INTERSTATE", label: "Interstate" },
    { value: "INTERNATIONAL", label: "International" },
];

const INVOICE_FOR_OPTIONS = [
    { value: "", label: "None" },
    { value: "ORDER", label: "Order" },
    { value: "QUOTATION", label: "Quotation" },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatDateForInput(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
}

function getOneMonthAgo() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
}

// ─── ReactSelect shared styles ────────────────────────────────────────────────
function rsStyles(hasError = false) {
    return {
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        control: (base) => ({
            ...base,
            borderRadius: "0.75rem",
            borderColor: hasError ? "#ef4444" : "#d1d5db",
            padding: "1px",
            fontSize: "0.875rem",
            boxShadow: "none",
            "&:hover": { borderColor: hasError ? "#ef4444" : "#3b82f6" },
        }),
    };
}

export default function InvoiceUpdate({ id }) {
    const router = useRouter();
    const { activeAssignment } = useContext(loginContext) || {};
    const companyId = activeAssignment?.companyId;
    const oneMonthAgo = getOneMonthAgo();

    // ── Form state ──────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        invoiceCode: "",
        statusValue: "",
        customerId: "",
        customerLabel: "",
        currencyId: "",
        currencyCode: "",
        currencySymbol: "",
        currencyConversionRate: 1,
        invoiceDate: "",
        deliveryDate: "",
        bankBookId: "",
        bankBookLabel: "",
        accountNumber: "",
        vatWithheld: "NO",
        businessTerms: "",
        paymentType: "CREDIT",
        discountApplicable: "ON_EACH_DELIVERY",
        deliveryTerms: "",
        salesPersonId: "",
        salesPersonLabel: "",
        contactPersonId: "",
        contactPersonLabel: "",
        shippingState: "",
        billingState: "",
        deliveryState: "",
        deliveryType: "LOCAL",
        remarks: "",
        termsConditionsId: null,
        termsConditionsText: "",
        invoiceFor: "",
        sourceOrderId: "",
        sourceQuotationId: "",
        existingFileName: "",
    });

    const [errors, setErrors] = useState({});
    const [itemErrors, setItemErrors] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [totals, setTotals] = useState({});

    // ── Data state ──────────────────────────────────────────────────────────
    const [currencies, setCurrencies] = useState([]);
    const [bankBooks, setBankBooks] = useState([]);
    const [items, setItems] = useState([newEmptyItem()]);
    const [invoiceDiscounts, setInvoiceDiscounts] = useState([]);
    const [invoiceExtraCharges, setInvoiceExtraCharges] = useState([]);
    const [termsConditionsFile, setTermsConditionsFile] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadState, setLoadState] = useState("loading");
    const [isDraft, setIsDraft] = useState(true);

    // ── Field setter ────────────────────────────────────────────────────────
    const setFormField = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
    }, [errors]);

    // ── Load Invoice Details ────────────────────────────────────────────────
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: { ...authHeaders(), endpoint: `invoice-details/${id}`, module: "invoice" },
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                
                if (!data?.invoiceId) {
                    toast.error("Invoice not found.", { position: "top-right" });
                    router.push("/invoice-list");
                    setLoadState("denied");
                    return;
                }

                const draft = data.status === "DRAFT";
                setIsDraft(draft);

                const rate = parseFloat(data.currencyConversionRate) || 1;

                setFormData({
                    invoiceCode: data.invoiceCode ?? "",
                    statusValue: data.status ?? "",
                    customerId: String(data.customerId ?? ""),
                    customerLabel: data.customerName ?? "",
                    currencyId: String(data.currencyId ?? ""),
                    currencyCode: data.currencyCode ?? "",
                    currencySymbol: data.currencySymbol ?? "",
                    currencyConversionRate: rate,
                    invoiceDate: formatDateForInput(data.invoiceDate),
                    deliveryDate: formatDateForInput(data.deliveryDate),
                    bankBookId: String(data.bankBookId ?? ""),
                    bankBookLabel: data.bankBookName ?? "",
                    accountNumber: data.accountNumber ?? "",
                    vatWithheld: data.vatWithheld ?? "NO",
                    businessTerms: data.businessTerms ?? "",
                    paymentType: data.paymentType ?? "CREDIT",
                    discountApplicable: data.discountApplicable ?? "ON_EACH_DELIVERY",
                    deliveryTerms: data.deliveryTerms ?? "",
                    salesPersonId: String(data.salesPersonId ?? ""),
                    salesPersonLabel: data.salesPersonName ?? "",
                    contactPersonId: String(data.contactPersonId ?? ""),
                    contactPersonLabel: data.contactPersonName ?? "",
                    shippingState: data.shippingState ?? "",
                    billingState: data.billingState ?? "",
                    deliveryState: data.deliveryState ?? "",
                    deliveryType: data.deliveryType ?? "LOCAL",
                    remarks: data.remarks ?? "",
                    termsConditionsId: data.termsConditionsId ?? null,
                    termsConditionsText: data.termsConditionsText ?? "",
                    existingFileName: data.termsConditionsFileName ?? "",
                    invoiceFor: data.invoiceFor ?? "",
                    sourceOrderId: data.sourceOrderId ? String(data.sourceOrderId) : "",
                    sourceQuotationId: data.sourceQuotationId ? String(data.sourceQuotationId) : "",
                });

                setExistingAttachments(data.attachments ?? []);

                // Currencies
                if (data.customerId) {
                    const custRes = await fetch("/relayapi", {
                        method: "GET",
                        headers: { ...authHeaders(), endpoint: `customer-details/${data.customerId}`, module: "customer" },
                    });
                    const custPayload = await custRes.json();
                    const custData = custPayload.encrypted ? decryptResponse(custPayload.encrypted) : custPayload;
                    setCurrencies(custData?.currencies ?? []);
                }

                // Discounts/Charges
                const rawHeaderDisc = data.invoiceDiscounts || data.discounts || [];
                setInvoiceDiscounts(rawHeaderDisc.map((d) => ({
                    id: d.invoiceDiscountId || d.id,
                    description: d.discountDescription || d.description || "",
                    amount: parseFloat(d.discountPrice ?? d.amount) || 0,
                    discountDescription: d.discountDescription || d.description || "",
                    discountPrice: parseFloat(d.discountPrice ?? d.amount) || 0,
                })));

                const rawHeaderEC = data.invoiceExtraCharges || data.extraCharges || [];
                setInvoiceExtraCharges(rawHeaderEC.map((ec) => ({
                    id: ec.invoiceExtraChargeId || ec.id,
                    description: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                    amount: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                    extraChargesDescription: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                    extraChargesPrice: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                })));

                // Items
                if (data.invoiceItems?.length) {
                    setItems(data.invoiceItems.map((it) => {
                        const unitPriceVal = parseFloat(it.unitPrice) || 0;
                        const basePrice = parseFloat(it.item?.convertedCostPerUnit) || (parseFloat(it.item?.costPerUnit) / (parseFloat(it.item?.conversionRate) || 1)) || (unitPriceVal / rate) || 0;
                        const loadedTaxCalc = it.taxCalculation === "NA" ? "N/A" : (it.taxCalculation ?? "N/A");
                        const isTaxableLoad = loadedTaxCalc === "EXCLUSIVE" || loadedTaxCalc === "INCLUSIVE";
                        const loadedTaxable = parseFloat(it.taxableAmount) || 0;
                        const loadedTaxAmt = parseFloat(it.taxAmount) || 0;
                        const derivedTaxRate = parseFloat(it.taxRate) || (isTaxableLoad && loadedTaxable > 0 ? (loadedTaxAmt / loadedTaxable) * 100 : 0);

                        return computeItem({
                            _id: Math.random().toString(36).substr(2, 9),
                            itemId: String(it.itemId ?? it.item?.itemId ?? it.id ?? ""),
                            itemLabel: it.item?.itemName ?? it.item?.itemCode ?? it.description ?? "",
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
                                id: d.invoiceDiscountId || d.id,
                                description: d.discountDescription || d.description || "",
                                amount: parseFloat(d.discountPrice ?? d.amount) || 0,
                                discountDescription: d.discountDescription || d.description || "",
                                discountPrice: parseFloat(d.discountPrice ?? d.amount) || 0,
                            })),
                            extraCharges: (it.extraCharges || []).map((ec) => ({
                                id: ec.invoiceExtraChargeId || ec.id,
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
    }, [id, router]);

    // ── Bank books ──────────────────────────────────────────────────────────
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

    // ── Discard ──────────────────────────────────────────────────────────────
    const handleDiscard = async () => {
        const result = await MySwal.fire({ title: "Discard changes?", text: "All unsaved data will be lost.", icon: "warning", showCancelButton: true, confirmButtonText: "Discard", confirmButtonColor: "#ef4444" });
        if (result.isConfirmed) router.push(`/invoice/${id}`);
    };

    // ── Validate ─────────────────────────────────────────────────────────────
    function validate() {
        const errs = {};
        if (!formData.customerId) errs.customerId = "Customer is required";
        if (!formData.currencyId) errs.currencyId = "Currency is required";
        if (!formData.invoiceDate) errs.invoiceDate = "Invoice date is required";
        if (!formData.deliveryDate) errs.deliveryDate = "Exchange date is required";
        if (!formData.businessTerms) errs.businessTerms = "Business terms is required";
        if (!formData.paymentType) errs.paymentType = "Payment type is required";
        if (!formData.discountApplicable) errs.discountApplicable = "Discount applicable is required";
        if (!formData.deliveryType) errs.deliveryType = "Delivery type is required";
        if (!formData.vatWithheld) errs.vatWithheld = "VAT withheld is required";

        // date validation: both dates must not be > 1 month in the past
        const oneMonthAgoDate = new Date();
        oneMonthAgoDate.setMonth(oneMonthAgoDate.getMonth() - 1);
        oneMonthAgoDate.setHours(0, 0, 0, 0);
        if (formData.invoiceDate && new Date(formData.invoiceDate) < oneMonthAgoDate) {
            errs.invoiceDate = "Invoice date cannot be more than 1 month in the past";
        }
        if (formData.deliveryDate && new Date(formData.deliveryDate) < oneMonthAgoDate) {
            errs.deliveryDate = "Exchange date cannot be more than 1 month in the past";
        }

        // items
        const iErrs = {};
        items.forEach((it, idx) => {
            if (!it.itemId && !it.description?.trim()) {
                iErrs[idx] = { description: "Item or description required" };
            }
            if (!it.quantity || Number(it.quantity) <= 0) {
                iErrs[idx] = { ...(iErrs[idx] || {}), quantity: "Quantity must be > 0" };
            }
        });
        if (Object.keys(iErrs).length > 0) {
            errs.items = "Please fix item errors";
        }
        return { errs, iErrs };
    }

    // ── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        setSubmitAttempted(true);
        const { errs, iErrs } = validate();

        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            setItemErrors(iErrs);
            toast.error("Please fix the form errors before submitting.", { position: "top-right" });
            return;
        }
        setErrors({});
        setItemErrors({});

        if ((totals.finalAmount ?? 0) <= 0) {
            toast.error("Total amount must be greater than zero.", { position: "top-right" });
            return;
        }

        const confirm = await MySwal.fire({ title: "Update Invoice?", icon: "question", showCancelButton: true, confirmButtonText: "Update", confirmButtonColor: "#2563eb" });
        if (!confirm.isConfirmed) return;

        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("invoiceId", String(id));
            
            // Re-send core read-only identifiers
            fd.append("customerId", formData.customerId);
            fd.append("currencyId", formData.currencyId);
            fd.append("companyId", String(companyId));
            
            // Editable fields for DRAFT and non-DRAFT (if relaxed in guard)
            fd.append("invoiceDate", formData.invoiceDate);
            fd.append("remarks", formData.remarks);
            fd.append("businessTerms", formData.businessTerms);
            fd.append("paymentType", formData.paymentType);
            fd.append("discountApplicable", formData.discountApplicable);
            if (formData.termsConditionsId) fd.append("termsConditionsId", String(formData.termsConditionsId));
            if (formData.termsConditionsText) fd.append("termsConditionsText", formData.termsConditionsText);

            // DRAFT-only editable fields (will be ignored by backend guard if not DRAFT, but we send them)
            fd.append("deliveryDate", formData.deliveryDate);
            fd.append("currencyConversionRate", String(formData.currencyConversionRate));
            fd.append("vatWithheld", formData.vatWithheld);
            fd.append("deliveryType", formData.deliveryType);
            if (formData.shippingState) fd.append("shippingState", formData.shippingState);
            if (formData.billingState) fd.append("billingState", formData.billingState);
            if (formData.deliveryState) fd.append("deliveryState", formData.deliveryState);
            if (formData.deliveryTerms) fd.append("deliveryTerms", formData.deliveryTerms);
            if (formData.bankBookId) fd.append("bankBookId", formData.bankBookId);
            if (formData.accountNumber) fd.append("accountNumber", formData.accountNumber);
            if (formData.salesPersonId) fd.append("salesPersonId", formData.salesPersonId);
            if (formData.contactPersonId) fd.append("contactPersonId", formData.contactPersonId);

            const mappedItems = items.map((it) => ({
                itemId: it.itemId || null,
                description: it.description || null,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
                taxCalculation: it.taxCalculation,
                taxGroup: it.taxGroup || null,
                discounts: (it.discounts || []).map((d) => ({ discountDescription: d.discountDescription || d.description || "", discountPrice: Number(d.discountPrice || d.amount || 0) })),
                extraCharges: (it.extraCharges || []).map((ec) => ({ extraChargesDescription: ec.extraChargesDescription || ec.description || "", extraChargesPrice: Number(ec.extraChargesPrice || ec.amount || 0) })),
            }));
            fd.append("invoiceItems", JSON.stringify(mappedItems));

            if (invoiceDiscounts.length > 0) {
                fd.append("invoiceDiscounts", JSON.stringify(invoiceDiscounts.map((d) => ({ discountDescription: d.discountDescription || d.description || "", discountPrice: Number(d.amount ?? d.discountPrice ?? 0) }))));
            }
            if (invoiceExtraCharges.length > 0) {
                fd.append("invoiceExtraCharges", JSON.stringify(invoiceExtraCharges.map((ec) => ({ extraChargesDescription: ec.extraChargesDescription || ec.description || "", extraChargesPrice: Number(ec.amount ?? ec.extraChargesPrice ?? 0) }))));
            }

            for (const file of selectedFiles) fd.append("attachments", file);
            if (termsConditionsFile) fd.append("termsConditionsFile", termsConditionsFile);

            const res = await fetch("/relayapi", {
                method: "PUT",
                headers: { ...authHeaders(), endpoint: "invoice-update", module: "invoice" },
                body: fd,
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1) {
                toast.success("Invoice updated successfully.", { position: "top-right" });
                router.push(`/invoice/${id}`);
            } else {
                toast.error(data?.message || "Failed to update invoice.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    if (loadState === "loading") {
        return <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center"><Loader label="Loading..." /></div>;
    }
    if (loadState === "denied") return null;

    const filteredBankBooks = formData.currencyId ? bankBooks.filter((b) => String(b.currencyId) === String(formData.currencyId)) : bankBooks;

    return (
        <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
            <Header page="update-invoice" />

            <div className="px-6 pt-4">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/invoice-list")}>Invoices</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push(`/invoice/${id}`)}>Invoice</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Edit</span>
                </nav>
            </div>

            <div className="flex-1 px-6 py-4 pb-24 space-y-5">
                {/* ── Section 1: Header / Meta ─────────────────────────────── */}
                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-gray-800">Invoice Details</h2>
                        <span className="text-sm font-bold text-gray-500">#{formData.invoiceCode}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Customer - Always Locked on Update */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Customer <span className="text-red-500">*</span></label>
                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium opacity-80 cursor-not-allowed">
                                {formData.currencyCode ? `${formData.customerLabel} (${formData.currencyCode})` : formData.customerLabel}
                            </div>
                        </div>

                        {/* Invoice Date - EDITABLE */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                id="invoice-date"
                                value={formData.invoiceDate}
                                min={oneMonthAgo}
                                onChange={(e) => setFormField("invoiceDate", e.target.value)}
                                onClick={(e) => e.target.showPicker?.()}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 cursor-pointer ${errors.invoiceDate ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                            />
                            {errors.invoiceDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.invoiceDate}</p>}
                        </div>

                        {/* Exchange Date - LOCKED IF NON-DRAFT */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Exchange Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                id="invoice-exchange-date"
                                value={formData.deliveryDate}
                                disabled={!isDraft}
                                min={oneMonthAgo}
                                onChange={(e) => setFormField("deliveryDate", e.target.value)}
                                onClick={(e) => e.target.showPicker?.()}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50 ${errors.deliveryDate ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                            />
                            {errors.deliveryDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.deliveryDate}</p>}
                        </div>

                        {/* Currency Conversion Rate - LOCKED IF NON-DRAFT */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Conversion Rate {formData.currencyCode && <span className="text-gray-400">({formData.currencyCode})</span>}
                            </label>
                            <FormattedNumberInput
                                id="invoice-conversion-rate"
                                value={String(formData.currencyConversionRate)}
                                disabled={!isDraft}
                                onChange={(raw) => setFormField("currencyConversionRate", parseFloat(raw) || 0)}
                                placeholder="1.00"
                                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
                            />
                        </div>
                    </div>

                    {/* Source - Locked */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice For</label>
                            <Select
                                instanceId="invoice-for-select"
                                value={INVOICE_FOR_OPTIONS.find((o) => o.value === formData.invoiceFor) || INVOICE_FOR_OPTIONS[0]}
                                isDisabled={true}
                                classNamePrefix="react-select"
                                styles={rsStyles()}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                        </div>
                        {formData.invoiceFor === "ORDER" && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Order</label>
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium opacity-80 cursor-not-allowed">
                                    {formData.sourceOrderId}
                                </div>
                            </div>
                        )}
                        {formData.invoiceFor === "QUOTATION" && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quotation</label>
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium opacity-80 cursor-not-allowed">
                                    {formData.sourceQuotationId}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Items table - EDITABLE ──────────────────────────────── */}
                <div>
                    <InvoiceItemsTable
                        items={items}
                        onChange={(newItems) => {
                            setItems(newItems);
                            if (errors.items) setErrors((prev) => { const e = { ...prev }; delete e.items; return e; });
                        }}
                        companyId={companyId}
                        submitAttempted={submitAttempted}
                        currencyConversionRate={formData.currencyConversionRate}
                        currencySymbol={formData.currencySymbol}
                        itemErrors={itemErrors}
                    />
                    {errors.items && <p className="text-red-500 text-xs mt-1 font-medium px-2">{errors.items}</p>}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* ── Left column ─────────────────────────────────────── */}
                    <div className="lg:col-span-7 space-y-5">
                        {/* Financial terms */}
                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Financial Terms</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Bank Book - LOCKED IF NON-DRAFT */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Bank Account</label>
                                    <select
                                        id="invoice-bank-book"
                                        value={formData.bankBookId}
                                        disabled={!isDraft}
                                        onChange={(e) => {
                                            const bb = bankBooks.find((b) => String(b.bankBookId) === e.target.value);
                                            setFormData((prev) => ({ ...prev, bankBookId: e.target.value, bankBookLabel: bb?.bankBookName || "" }));
                                        }}
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
                                    >
                                        <option value="">-- Select Bank Book --</option>
                                        {filteredBankBooks.map((b) => (
                                            <option key={b.bankBookId} value={b.bankBookId}>{b.bankBookName}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Account Number - LOCKED IF NON-DRAFT */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Account Number</label>
                                    <input
                                        type="text"
                                        id="invoice-account-number"
                                        value={formData.accountNumber}
                                        disabled={!isDraft}
                                        onChange={(e) => setFormField("accountNumber", e.target.value)}
                                        placeholder="Account number"
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
                                    />
                                </div>

                                {/* Business Terms - EDITABLE */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business Terms <span className="text-red-500">*</span></label>
                                    <Select
                                        instanceId="invoice-business-terms"
                                        value={BUSINESS_TERMS_OPTIONS.find((o) => o.value === formData.businessTerms) || null}
                                        onChange={(selected) => setFormField("businessTerms", selected?.value || "")}
                                        options={BUSINESS_TERMS_OPTIONS}
                                        placeholder="Select..."
                                        isClearable
                                        classNamePrefix="react-select"
                                        styles={rsStyles(!!errors.businessTerms)}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                    {errors.businessTerms && <p className="text-red-500 text-xs mt-1">{errors.businessTerms}</p>}
                                </div>

                                {/* Payment Type - EDITABLE */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Type <span className="text-red-500">*</span></label>
                                    <Select
                                        instanceId="invoice-payment-type"
                                        value={PAYMENT_TYPE_OPTIONS.find((o) => o.value === formData.paymentType) || null}
                                        onChange={(selected) => setFormField("paymentType", selected?.value || "")}
                                        options={PAYMENT_TYPE_OPTIONS}
                                        classNamePrefix="react-select"
                                        styles={rsStyles(!!errors.paymentType)}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                    {errors.paymentType && <p className="text-red-500 text-xs mt-1">{errors.paymentType}</p>}
                                </div>

                                {/* VAT Withheld - LOCKED IF NON-DRAFT */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">VAT Withheld <span className="text-red-500">*</span></label>
                                    <Select
                                        instanceId="invoice-vat-withheld"
                                        value={VAT_WITHHELD_OPTIONS.find((o) => o.value === formData.vatWithheld) || null}
                                        isDisabled={!isDraft}
                                        onChange={(selected) => setFormField("vatWithheld", selected?.value || "NO")}
                                        options={VAT_WITHHELD_OPTIONS}
                                        classNamePrefix="react-select"
                                        styles={rsStyles(!!errors.vatWithheld)}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                </div>

                                {/* Discount Applicable - EDITABLE */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Discount Applicable <span className="text-red-500">*</span></label>
                                    <Select
                                        instanceId="invoice-discount-applicable"
                                        value={DISCOUNT_APPLICABLE_OPTIONS.find((o) => o.value === formData.discountApplicable) || null}
                                        onChange={(selected) => setFormField("discountApplicable", selected?.value || "")}
                                        options={DISCOUNT_APPLICABLE_OPTIONS}
                                        classNamePrefix="react-select"
                                        styles={rsStyles(!!errors.discountApplicable)}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                    {errors.discountApplicable && <p className="text-red-500 text-xs mt-1">{errors.discountApplicable}</p>}
                                </div>

                                {/* Sales Person - LOCKED IF NON-DRAFT */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sales Person</label>
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium opacity-80 cursor-not-allowed">
                                        {formData.salesPersonLabel || "—"}
                                    </div>
                                </div>

                                {/* Contact Person - LOCKED IF NON-DRAFT */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Contact Person</label>
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium opacity-80 cursor-not-allowed">
                                        {formData.contactPersonLabel || "—"}
                                    </div>
                                </div>

                                {/* Delivery Terms - LOCKED IF NON-DRAFT */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery Terms</label>
                                    <input
                                        type="text"
                                        id="invoice-delivery-terms"
                                        value={formData.deliveryTerms}
                                        disabled={!isDraft}
                                        onChange={(e) => setFormField("deliveryTerms", e.target.value)}
                                        placeholder="e.g. FOB, CIF..."
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Location - LOCKED IF NON-DRAFT */}
                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Location & Delivery</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Shipping State</label>
                                    <input type="text" id="invoice-shipping-state" value={formData.shippingState} disabled={!isDraft} onChange={(e) => setFormField("shippingState", e.target.value)} placeholder="Shipping state" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Billing State</label>
                                    <input type="text" id="invoice-billing-state" value={formData.billingState} disabled={!isDraft} onChange={(e) => setFormField("billingState", e.target.value)} placeholder="Billing state" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery State</label>
                                    <input type="text" id="invoice-delivery-state" value={formData.deliveryState} disabled={!isDraft} onChange={(e) => setFormField("deliveryState", e.target.value)} placeholder="Delivery state" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery Type <span className="text-red-500">*</span></label>
                                    <Select
                                        instanceId="invoice-delivery-type"
                                        value={DELIVERY_TYPE_OPTIONS.find((o) => o.value === formData.deliveryType) || null}
                                        isDisabled={!isDraft}
                                        onChange={(selected) => setFormField("deliveryType", selected?.value || "")}
                                        options={DELIVERY_TYPE_OPTIONS}
                                        classNamePrefix="react-select"
                                        styles={rsStyles(!!errors.deliveryType)}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Remarks - EDITABLE */}
                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                            <textarea
                                id="invoice-remarks"
                                value={formData.remarks}
                                onChange={(e) => setFormField("remarks", e.target.value)}
                                rows={4}
                                placeholder="Optional remarks..."
                                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                            />
                            <p className="text-right text-xs text-gray-400 mt-1">{formData.remarks.length} characters</p>
                        </div>

                        {/* Terms & Conditions - EDITABLE */}
                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                            <TermsConditionsWidget
                                companyId={companyId}
                                termsConditionsId={formData.termsConditionsId}
                                termsConditionsText={formData.termsConditionsText}
                                termsConditionsFile={termsConditionsFile}
                                existingFileName={formData.existingFileName}
                                onFileChange={setTermsConditionsFile}
                                onTemplateChange={(val) => setFormField("termsConditionsId", val)}
                                onTextChange={(val) => setFormField("termsConditionsText", val)}
                            />
                        </div>
                    </div>

                    {/* ── Summary panel ───────────────────────────────────── */}
                    <div className="lg:col-span-5 space-y-5">
                        <InvoiceSummaryPanel
                            items={items}
                            quotationDiscounts={invoiceDiscounts}
                            quotationExtraCharges={invoiceExtraCharges}
                            vatWithheld={formData.vatWithheld}
                            currencyCode={formData.currencyCode}
                            currencySymbol={formData.currencySymbol}
                            onDiscountsChange={setInvoiceDiscounts}
                            onExtraChargesChange={setInvoiceExtraCharges}
                            selectedFiles={selectedFiles}
                            onFilesChange={setSelectedFiles}
                            existingAttachments={existingAttachments}
                            onTotalsChange={setTotals}
                        />
                    </div>
                </div>
            </div>

            {/* ── Sticky footer buttons ─────────────────────────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-6 py-4 flex items-center justify-between z-40">
                <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={loading}
                    className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    Discard
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    {loading ? "Saving…" : "Save Changes"}
                </button>
            </div>
        </div>
    );
}
