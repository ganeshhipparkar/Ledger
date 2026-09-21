"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { limitDecimals } from "@/lib/utils";

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

// ─── Component ────────────────────────────────────────────────────────────────
export default function AddInvoice() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { activeAssignment } = useContext(loginContext) || {};

    const fromQuotationId = searchParams.get("fromQuotation");
    const fromOrderId = searchParams.get("fromOrder");
    const companyId = activeAssignment?.companyId;
    const oneMonthAgo = getOneMonthAgo();

    // ── Form state ──────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        customerId: "",
        customerLabel: "",
        currencyId: "",
        currencyCode: "",
        currencySymbol: "",
        currencyConversionRate: 1,
        invoiceDate: new Date().toISOString().split("T")[0],
        deliveryDate: new Date().toISOString().split("T")[0],
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
    const [loading, setLoading] = useState(false);
    const [lockedCustomer, setLockedCustomer] = useState(false);
    const [prefillLoading, setPrefillLoading] = useState(!!fromQuotationId || !!fromOrderId);

    // ── Field setter ────────────────────────────────────────────────────────
    const setFormField = useCallback((key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
    }, [errors]);

    // ── Prefill from quotation or order ─────────────────────────────────────
    useEffect(() => {
        if (!fromQuotationId && !fromOrderId) return;
        (async () => {
            try {
                let sourceData = null;
                let prefillItems = [];

                if (fromQuotationId) {
                    const res = await fetch("/relayapi", {
                        method: "GET",
                        headers: { ...authHeaders(), endpoint: `quotation-details/${fromQuotationId}`, module: "quotation" },
                    });
                    const payload = await res.json();
                    sourceData = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                    prefillItems = (sourceData?.quotationItems || []).map((it) => computeItem({
                        itemId: String(it.itemId || ""),
                        description: it.description || "",
                        itemLabel: it.item?.itemName || it.description || "",
                        isDecimalAllowed: true,
                        baseCurrencyPrice: parseFloat(it.unitPrice) || 0,
                        quantity: String(it.quantity || 1),
                        unitPrice: String(it.unitPrice || 0),
                        taxCalculation: it.taxCalculation || "N/A",
                        taxGroup: it.taxGroup || "",
                        taxRate: 0,
                        discounts: it.discounts || [],
                        extraCharges: it.extraCharges || [],
                    }));
                }

                if (fromOrderId) {
                    const res = await fetch("/relayapi", {
                        method: "GET",
                        headers: { ...authHeaders(), endpoint: `order-details/${fromOrderId}`, module: "order" },
                    });
                    const payload = await res.json();
                    sourceData = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                    prefillItems = (sourceData?.orderItems || []).map((it) => computeItem({
                        itemId: String(it.itemId || ""),
                        description: it.description || "",
                        itemLabel: it.item?.itemName || it.description || "",
                        isDecimalAllowed: true,
                        baseCurrencyPrice: parseFloat(it.unitPrice) || 0,
                        quantity: String(it.quantity || 1),
                        unitPrice: String(it.unitPrice || 0),
                        taxCalculation: it.taxCalculation || "N/A",
                        taxGroup: it.taxGroup || "",
                        taxRate: 0,
                        discounts: it.discounts || [],
                        extraCharges: it.extraCharges || [],
                    }));
                }

                if (!sourceData) { setPrefillLoading(false); return; }

                const rate = parseFloat(sourceData.currencyConversionRate) || 1;

                if (sourceData.customerId) {
                    const custRes = await fetch("/relayapi", {
                        method: "GET",
                        headers: { ...authHeaders(), endpoint: `customer-details/${sourceData.customerId}`, module: "customer" },
                    });
                    const custPayload = await custRes.json();
                    const custData = custPayload.encrypted ? decryptResponse(custPayload.encrypted) : custPayload;
                    setCurrencies(custData?.currencies ?? []);
                }

                setFormData((prev) => ({
                    ...prev,
                    customerId: String(sourceData.customerId ?? ""),
                    customerLabel: sourceData.customerName ?? "",
                    currencyId: String(sourceData.currencyId ?? ""),
                    currencyCode: sourceData.currencyCode ?? "",
                    currencySymbol: sourceData.currencySymbol ?? "",
                    currencyConversionRate: rate,
                    vatWithheld: sourceData.vatWithheld ?? "NO",
                    businessTerms: sourceData.businessTerms ?? "",
                    paymentType: sourceData.paymentType ?? "CREDIT",
                    salesPersonId: String(sourceData.salesPersonId ?? ""),
                    salesPersonLabel: sourceData.salesPersonName ?? "",
                    invoiceFor: fromQuotationId ? "QUOTATION" : "ORDER",
                    sourceQuotationId: fromQuotationId ? String(fromQuotationId) : "",
                    sourceOrderId: fromOrderId ? String(fromOrderId) : "",
                }));

                if (prefillItems.length > 0) setItems(prefillItems);
                setLockedCustomer(true);
            } catch (err) {
                toast.error("Failed to load source data: " + err.message, { position: "top-right" });
            } finally {
                setPrefillLoading(false);
            }
        })();
    }, [fromQuotationId, fromOrderId]);

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

    // ── Customer load ───────────────────────────────────────────────────────
    const loadCustomerOptions = (inputValue, callback) => {
        fetch("/relayapi", {
            method: "POST",
            headers: { ...authHeaders(), endpoint: "customer-currency-list", module: "customer", "Content-Type": "application/json" },
            body: JSON.stringify({ page: 1, limit: 50, filters: [...(inputValue ? [{ key: "customerName", value: inputValue, operator: "like" }] : [])] }),
        })
            .then((r) => r.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                const options = (data?.data?.data ?? data?.data ?? []).map((c) => ({
                    value: `${c.customerId}_${c.curId}`,
                    label: `${c.customer?.customerName} (${c.currency?.code})`,
                    raw: c,
                }));
                callback(options);
            })
            .catch(() => callback([]));
    };

    const handleCustomerCurrencySelect = async (option) => {
        if (!option) {
            setFormData((prev) => ({ ...prev, customerId: "", customerLabel: "", currencyId: "", currencyCode: "", currencySymbol: "", currencyConversionRate: 1, bankBookId: "", bankBookLabel: "" }));
            setCurrencies([]);
            return;
        }
        const raw = option.raw;
        const custId = raw.customerId;
        const curId = raw.curId;
        setFormData((prev) => ({ ...prev, customerId: String(custId || ""), customerLabel: raw.customer?.customerName || "" }));
        if (errors.customerId) setErrors((prev) => { const e = { ...prev }; delete e.customerId; return e; });

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
            const newRate = parseFloat(cur?.conversionRate) || 1;
            setFormData((prev) => ({
                ...prev,
                currencyId: String(curId),
                currencyCode: cur?.code ?? raw.currency?.code ?? "",
                currencySymbol: cur?.symbol ?? raw.currency?.symbol ?? "",
                currencyConversionRate: newRate,
                bankBookId: "",
                bankBookLabel: "",
            }));
            setItems((prevItems) => prevItems.map((it) => {
                if (!it.itemId) return it;
                const basePrice = parseFloat(it.baseCurrencyPrice) || 0;
                return computeItem({ ...it, unitPrice: newRate > 0 ? parseFloat((basePrice * newRate).toFixed(4)) : 0 });
            }));
        } catch {
            setCurrencies([]);
        }
    };

    // ── User search ─────────────────────────────────────────────────────────
    const loadUserOptions = (inputValue, callback) => {
        fetch("/relayapi", {
            method: "POST",
            headers: { ...authHeaders(), endpoint: "user-list", module: "user", "Content-Type": "application/json", self: "true" },
            body: JSON.stringify({ page: 1, limit: 20, filters: [...(inputValue ? [{ key: "name", value: inputValue, operator: "contains" }] : [])] }),
        })
            .then((r) => r.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                callback((data?.data ?? []).map((u) => ({ value: u.userId, label: u.name })));
            })
            .catch(() => callback([]));
    };

    // ── Order search ────────────────────────────────────────────────────────
    const loadOrderOptions = (inputValue, callback) => {
        fetch("/relayapi", {
            method: "POST",
            headers: { ...authHeaders(), endpoint: "order-list", module: "order", "Content-Type": "application/json" },
            body: JSON.stringify({ page: 1, limit: 20, filters: [...(inputValue ? [{ key: "orderCode", value: inputValue, operator: "like" }] : [])] }),
        })
            .then((r) => r.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                callback((data?.data ?? []).map((o) => ({ value: o.orderId, label: `${o.orderCode}` })));
            })
            .catch(() => callback([]));
    };

    // ── Quotation search ─────────────────────────────────────────────────────
    const loadQuotationOptions = (inputValue, callback) => {
        fetch("/relayapi", {
            method: "POST",
            headers: { ...authHeaders(), endpoint: "quotation-list", module: "quotation", "Content-Type": "application/json" },
            body: JSON.stringify({ page: 1, limit: 20, filters: [...(inputValue ? [{ key: "quotationCode", value: inputValue, operator: "like" }] : [])] }),
        })
            .then((r) => r.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                callback((data?.data ?? []).map((q) => ({ value: q.quotationId, label: `${q.quotationCode}` })));
            })
            .catch(() => callback([]));
    };

    // ── Discard ──────────────────────────────────────────────────────────────
    const handleDiscard = async () => {
        const result = await MySwal.fire({ title: "Discard changes?", text: "All unsaved data will be lost.", icon: "warning", showCancelButton: true, confirmButtonText: "Discard", confirmButtonColor: "#ef4444" });
        if (result.isConfirmed) router.push("/invoice-list");
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

        // source validation
        if (formData.invoiceFor === "ORDER" && !formData.sourceOrderId) errs.sourceOrderId = "Order is required";
        if (formData.invoiceFor === "QUOTATION" && !formData.sourceQuotationId) errs.sourceQuotationId = "Quotation is required";

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
    const handleSubmit = async (submitAfterCreate = false) => {
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

        const confirmTitle = submitAfterCreate ? "Create & Submit Invoice?" : "Save Invoice as Draft?";
        const confirmText = submitAfterCreate
            ? "The invoice will be created and immediately submitted. A PDF will be generated."
            : "Save this invoice as a draft. You can submit it later.";
        const confirmBtn = submitAfterCreate ? "Create & Submit" : "Save as Draft";
        const confirmColor = submitAfterCreate ? "#2563eb" : "#16a34a";

        const confirm = await MySwal.fire({ title: confirmTitle, text: confirmText, icon: "question", showCancelButton: true, confirmButtonText: confirmBtn, confirmButtonColor: confirmColor });
        if (!confirm.isConfirmed) return;

        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("customerId", formData.customerId);
            fd.append("currencyId", formData.currencyId);
            fd.append("invoiceDate", formData.invoiceDate);
            fd.append("deliveryDate", formData.deliveryDate);
            fd.append("companyId", String(companyId));
            fd.append("currencyConversionRate", String(formData.currencyConversionRate));
            fd.append("vatWithheld", formData.vatWithheld);
            fd.append("businessTerms", formData.businessTerms);
            fd.append("paymentType", formData.paymentType);
            fd.append("discountApplicable", formData.discountApplicable);
            fd.append("deliveryType", formData.deliveryType);
            if (formData.shippingState) fd.append("shippingState", formData.shippingState);
            if (formData.billingState) fd.append("billingState", formData.billingState);
            if (formData.deliveryState) fd.append("deliveryState", formData.deliveryState);
            if (formData.deliveryTerms) fd.append("deliveryTerms", formData.deliveryTerms);
            if (formData.bankBookId) fd.append("bankBookId", formData.bankBookId);
            if (formData.accountNumber) fd.append("accountNumber", formData.accountNumber);
            if (formData.salesPersonId) fd.append("salesPersonId", formData.salesPersonId);
            if (formData.contactPersonId) fd.append("contactPersonId", formData.contactPersonId);
            if (formData.remarks) fd.append("remarks", formData.remarks);
            if (formData.termsConditionsId) fd.append("termsConditionsId", String(formData.termsConditionsId));
            if (formData.termsConditionsText) fd.append("termsConditionsText", formData.termsConditionsText);
            if (formData.invoiceFor) fd.append("invoiceFor", formData.invoiceFor);
            if (formData.sourceOrderId) fd.append("sourceOrderId", formData.sourceOrderId);
            if (formData.sourceQuotationId) fd.append("sourceQuotationId", formData.sourceQuotationId);

            const mappedItems = items.map((it) => ({
                itemId: it.itemId || null,
                description: it.description || null,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
                taxCalculation: it.taxCalculation,
                taxGroup: it.taxGroup || null,
                discounts: (it.discounts || []).map((d) => ({ discountDescription: d.discountDescription || "", discountPrice: Number(d.discountPrice || d.amount || 0), manufacturerId: d.manufacturerId || null })),
                extraCharges: (it.extraCharges || []).map((ec) => ({ extraChargesDescription: ec.extraChargesDescription || "", extraChargesPrice: Number(ec.extraChargesPrice || ec.amount || 0), manufacturerId: ec.manufacturerId || null })),
            }));
            fd.append("invoiceItems", JSON.stringify(mappedItems));

            if (invoiceDiscounts.length > 0) {
                fd.append("invoiceDiscounts", JSON.stringify(invoiceDiscounts.map((d) => ({ discountDescription: d.discountDescription || "", discountPrice: Number(d.amount ?? d.discountPrice ?? 0), manufacturerId: d.manufacturerId || null }))));
            }
            if (invoiceExtraCharges.length > 0) {
                fd.append("invoiceExtraCharges", JSON.stringify(invoiceExtraCharges.map((ec) => ({ extraChargesDescription: ec.extraChargesDescription || "", extraChargesPrice: Number(ec.amount ?? ec.extraChargesPrice ?? 0), manufacturerId: ec.manufacturerId || null }))));
            }

            for (const file of selectedFiles) fd.append("attachments", file);
            if (termsConditionsFile) fd.append("termsConditionsFile", termsConditionsFile);

            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { ...authHeaders(), endpoint: "invoice-add", module: "invoice" },
                body: fd,
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1) {
                const invoiceId = data?.invoiceId ?? data?.data?.invoiceId;

                if (submitAfterCreate && invoiceId) {
                    // Two-step: add → submit
                    const subRes = await fetch("/relayapi", {
                        method: "PUT",
                        headers: { ...authHeaders(), endpoint: `invoice-submit/${invoiceId}`, module: "invoice" },
                    });
                    const subPayload = await subRes.json();
                    const subData = subPayload.encrypted ? decryptResponse(subPayload.encrypted) : subPayload;
                    if (subData?.success === 1) {
                        toast.success("Invoice created and submitted successfully.", { position: "top-right" });
                        router.push(invoiceId ? `/invoice/${invoiceId}` : "/invoice-list");
                    } else {
                        toast.warning(`Invoice created but submit failed: ${subData?.message || "Unknown error"}`, { position: "top-right" });
                        router.push(invoiceId ? `/invoice/${invoiceId}` : "/invoice-list");
                    }
                } else {
                    toast.success("Invoice saved as draft.", { position: "top-right" });
                    router.push(invoiceId ? `/invoice/${invoiceId}` : "/invoice-list");
                }
            } else {
                toast.error(data?.message || "Failed to create invoice.", { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    if (prefillLoading) {
        return <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center"><Loader label="Loading..." /></div>;
    }

    const filteredBankBooks = formData.currencyId
        ? bankBooks.filter((b) => String(b.currencyId) === String(formData.currencyId))
        : bankBooks;

    return (
        <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
            <Header page="add-invoice" />

            <div className="px-6 pt-4">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/invoice-list")}>Invoices</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Add Invoice</span>
                </nav>
            </div>

            <div className="flex-1 px-6 py-4 pb-24 space-y-5">
                {/* ── Section 1: Header / Meta ─────────────────────────────── */}
                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                    <h2 className="text-base font-semibold text-gray-800 mb-4">Invoice Details</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Customer */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Customer <span className="text-red-500">*</span></label>
                            {lockedCustomer ? (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium">
                                    {formData.currencyCode ? `${formData.customerLabel} (${formData.currencyCode})` : formData.customerLabel}
                                </div>
                            ) : (
                                <AsyncSelect
                                    instanceId="invoice-customer-select"
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
                                    styles={rsStyles(!!errors.customerId)}
                                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                />
                            )}
                            {errors.customerId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.customerId}</p>}
                        </div>

                        {/* Invoice Date */}
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

                        {/* Exchange Date */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Exchange Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                id="invoice-exchange-date"
                                value={formData.deliveryDate}
                                min={oneMonthAgo}
                                onChange={(e) => setFormField("deliveryDate", e.target.value)}
                                onClick={(e) => e.target.showPicker?.()}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 cursor-pointer ${errors.deliveryDate ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                            />
                            {errors.deliveryDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.deliveryDate}</p>}
                        </div>

                        {/* Currency Conversion Rate */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Conversion Rate {formData.currencyCode && <span className="text-gray-400">({formData.currencyCode})</span>}
                            </label>
                            <FormattedNumberInput
                                id="invoice-conversion-rate"
                                value={String(formData.currencyConversionRate)}
                                onChange={(raw) => setFormField("currencyConversionRate", parseFloat(raw) || 0)}
                                placeholder="1.00"
                                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>

                    {/* Source */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice For</label>
                            <Select
                                instanceId="invoice-for-select"
                                value={INVOICE_FOR_OPTIONS.find((o) => o.value === formData.invoiceFor) || INVOICE_FOR_OPTIONS[0]}
                                onChange={(selected) => {
                                    setFormField("invoiceFor", selected?.value || "");
                                    setFormField("sourceOrderId", "");
                                    setFormField("sourceQuotationId", "");
                                }}
                                options={INVOICE_FOR_OPTIONS}
                                isDisabled={lockedCustomer}
                                classNamePrefix="react-select"
                                styles={rsStyles()}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                        </div>
                        {formData.invoiceFor === "ORDER" && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Order <span className="text-red-500">*</span></label>
                                <AsyncSelect
                                    instanceId="invoice-source-order"
                                    cacheOptions
                                    defaultOptions
                                    loadOptions={loadOrderOptions}
                                    value={formData.sourceOrderId ? { value: formData.sourceOrderId, label: formData.sourceOrderId } : null}
                                    onChange={(selected) => setFormField("sourceOrderId", selected ? String(selected.value) : "")}
                                    placeholder="Search order..."
                                    isClearable
                                    isDisabled={lockedCustomer}
                                    classNamePrefix="react-select"
                                    styles={rsStyles(!!errors.sourceOrderId)}
                                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                />
                                {errors.sourceOrderId && <p className="text-red-500 text-xs mt-1">{errors.sourceOrderId}</p>}
                            </div>
                        )}
                        {formData.invoiceFor === "QUOTATION" && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quotation <span className="text-red-500">*</span></label>
                                <AsyncSelect
                                    instanceId="invoice-source-quotation"
                                    cacheOptions
                                    defaultOptions
                                    loadOptions={loadQuotationOptions}
                                    value={formData.sourceQuotationId ? { value: formData.sourceQuotationId, label: formData.sourceQuotationId } : null}
                                    onChange={(selected) => setFormField("sourceQuotationId", selected ? String(selected.value) : "")}
                                    placeholder="Search quotation..."
                                    isClearable
                                    isDisabled={lockedCustomer}
                                    classNamePrefix="react-select"
                                    styles={rsStyles(!!errors.sourceQuotationId)}
                                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                />
                                {errors.sourceQuotationId && <p className="text-red-500 text-xs mt-1">{errors.sourceQuotationId}</p>}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Items table ─────────────────────────────────────────── */}
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
                                {/* Bank Book */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Bank Account</label>
                                    <select
                                        id="invoice-bank-book"
                                        value={formData.bankBookId}
                                        onChange={(e) => {
                                            const bb = bankBooks.find((b) => String(b.bankBookId) === e.target.value);
                                            setFormData((prev) => ({ ...prev, bankBookId: e.target.value, bankBookLabel: bb?.bankBookName || "" }));
                                        }}
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 cursor-pointer"
                                    >
                                        <option value="">-- Select Bank Book --</option>
                                        {filteredBankBooks.map((b) => (
                                            <option key={b.bankBookId} value={b.bankBookId}>{b.bankBookName}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Account Number */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Account Number</label>
                                    <input
                                        type="text"
                                        id="invoice-account-number"
                                        value={formData.accountNumber}
                                        onChange={(e) => setFormField("accountNumber", e.target.value)}
                                        placeholder="Account number"
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>

                                {/* Business Terms */}
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

                                {/* Payment Type */}
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

                                {/* VAT Withheld */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">VAT Withheld <span className="text-red-500">*</span></label>
                                    <Select
                                        instanceId="invoice-vat-withheld"
                                        value={VAT_WITHHELD_OPTIONS.find((o) => o.value === formData.vatWithheld) || null}
                                        onChange={(selected) => setFormField("vatWithheld", selected?.value || "NO")}
                                        options={VAT_WITHHELD_OPTIONS}
                                        classNamePrefix="react-select"
                                        styles={rsStyles(!!errors.vatWithheld)}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                </div>

                                {/* Discount Applicable */}
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

                                {/* Sales Person */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sales Person</label>
                                    <AsyncSelect
                                        instanceId="invoice-sales-person"
                                        cacheOptions
                                        defaultOptions
                                        loadOptions={loadUserOptions}
                                        value={formData.salesPersonId ? { value: formData.salesPersonId, label: formData.salesPersonLabel } : null}
                                        onChange={(selected) => setFormData((prev) => ({ ...prev, salesPersonId: selected ? String(selected.value) : "", salesPersonLabel: selected?.label || "" }))}
                                        placeholder="Search user..."
                                        isClearable
                                        classNamePrefix="react-select"
                                        styles={rsStyles()}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                </div>

                                {/* Contact Person */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Contact Person</label>
                                    <AsyncSelect
                                        instanceId="invoice-contact-person"
                                        cacheOptions
                                        defaultOptions
                                        loadOptions={loadUserOptions}
                                        value={formData.contactPersonId ? { value: formData.contactPersonId, label: formData.contactPersonLabel } : null}
                                        onChange={(selected) => setFormData((prev) => ({ ...prev, contactPersonId: selected ? String(selected.value) : "", contactPersonLabel: selected?.label || "" }))}
                                        placeholder="Search user..."
                                        isClearable
                                        classNamePrefix="react-select"
                                        styles={rsStyles()}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                </div>

                                {/* Delivery Terms */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery Terms</label>
                                    <input
                                        type="text"
                                        id="invoice-delivery-terms"
                                        value={formData.deliveryTerms}
                                        onChange={(e) => setFormField("deliveryTerms", e.target.value)}
                                        placeholder="e.g. FOB, CIF..."
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Location & Delivery</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Shipping State</label>
                                    <input type="text" id="invoice-shipping-state" value={formData.shippingState} onChange={(e) => setFormField("shippingState", e.target.value)} placeholder="Shipping state" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Billing State</label>
                                    <input type="text" id="invoice-billing-state" value={formData.billingState} onChange={(e) => setFormField("billingState", e.target.value)} placeholder="Billing state" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery State</label>
                                    <input type="text" id="invoice-delivery-state" value={formData.deliveryState} onChange={(e) => setFormField("deliveryState", e.target.value)} placeholder="Delivery state" className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery Type <span className="text-red-500">*</span></label>
                                    <Select
                                        instanceId="invoice-delivery-type"
                                        value={DELIVERY_TYPE_OPTIONS.find((o) => o.value === formData.deliveryType) || null}
                                        onChange={(selected) => setFormField("deliveryType", selected?.value || "")}
                                        options={DELIVERY_TYPE_OPTIONS}
                                        classNamePrefix="react-select"
                                        styles={rsStyles(!!errors.deliveryType)}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                    {errors.deliveryType && <p className="text-red-500 text-xs mt-1">{errors.deliveryType}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Remarks */}
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

                        {/* Terms & Conditions */}
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
                            existingAttachments={[]}
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
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        id="invoice-save-draft-btn"
                        onClick={() => handleSubmit(false)}
                        disabled={loading}
                        className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {loading ? "Saving…" : "Save as Draft"}
                    </button>
                    <button
                        type="button"
                        id="invoice-submit-btn"
                        onClick={() => handleSubmit(true)}
                        disabled={loading}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {loading ? "Submitting…" : "Create & Submit"}
                    </button>
                </div>
            </div>
        </div>
    );
}
