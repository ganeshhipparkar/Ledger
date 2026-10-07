"use client";
import Link from "next/link";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import AsyncSelect from "react-select/async";
import Select from "react-select";
import { InvoiceUpdateFormSchema } from "../Zod";

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
import { limitDecimals, limitPriceDecimals } from "@/lib/utils";
import { Country } from "country-state-city";

const MySwal = withReactContent(Swal);

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
    const countries = Country.getAllCountries().map(c => ({ value: c.name, label: c.name }));
    const router = useRouter();
    const { activeAssignment } = useContext(loginContext) || {};
    const companyId = activeAssignment?.companyId;
    const oneMonthAgo = getOneMonthAgo();

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
        sourceOrderLabel: "",
        sourceQuotationId: "",
        sourceQuotationLabel: "",
        existingFileName: "",
    });

    const [errors, setErrors] = useState({});
    const [itemErrors, setItemErrors] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [totals, setTotals] = useState({});


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

    const [prefillLoading, setPrefillLoading] = useState(false);

    const loadSourceIntoForm = async (type, id) => {
        if (!id) return;
        setPrefillLoading(true);
        try {
            let sourceData = null;
            let prefillItems = [];

            if (type === "QUOTATION") {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: { ...authHeaders(), endpoint: `quotation-details/${id}`, module: "quotation" },
                });
                const payload = await res.json();
                sourceData = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (sourceData && sourceData.status !== "CONFIRMED") {
                    toast.error("Only CONFIRMED quotations can be converted into invoices.", { position: "top-right" });
                    setPrefillLoading(false);
                    return;
                }
                prefillItems = (sourceData?.quotationItems || []).map((it) => computeItem({
                    _id: Math.random().toString(36).substr(2, 9),
                    itemId: String(it.itemId || ""),
                    description: it.description || "",
                    itemLabel: it.item?.itemName || it.description || "",
                    isDecimalAllowed: true,
                    baseCurrencyPrice: parseFloat(it.unitPrice) || 0,
                    quantity: limitDecimals(String(it.quantity || 1)),
                    unitPrice: limitPriceDecimals(String(it.unitPrice || 0)),
                    taxCalculation: it.taxCalculation || "N/A",
                    taxGroup: it.taxGroup || "",
                    taxRate: 0,
                    discounts: it.discounts || [],
                    extraCharges: it.extraCharges || [],
                }));
            } else if (type === "ORDER") {
                const res = await fetch("/relayapi", {
                    method: "GET",
                    headers: { ...authHeaders(), endpoint: `order-details/${id}`, module: "order" },
                });
                const payload = await res.json();
                sourceData = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                if (sourceData && sourceData.status !== "DELIVERED") {
                    toast.error("Only DELIVERED orders can be converted into invoices.", { position: "top-right" });
                    setPrefillLoading(false);
                    return;
                }
                prefillItems = (sourceData?.orderItems || []).map((it) => computeItem({
                    _id: Math.random().toString(36).substr(2, 9),
                    itemId: String(it.itemId || ""),
                    description: it.description || "",
                    itemLabel: it.item?.itemName || it.description || "",
                    isDecimalAllowed: true,
                    baseCurrencyPrice: parseFloat(it.unitPrice) || 0,
                    quantity: limitDecimals(String(it.quantity || 1)),
                    unitPrice: limitPriceDecimals(String(it.unitPrice || 0)),
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
                contactPersonId: sourceData.contactPersonId ? String(sourceData.contactPersonId) : "",
                contactPersonLabel: sourceData.contactPersonName ?? "",
                shippingState: sourceData.shippingState ?? "",
                billingState: sourceData.billingState ?? "",
                deliveryState: sourceData.deliveryState ?? "",
                bankBookId: sourceData.bankBookId ? String(sourceData.bankBookId) : "",
                bankBookLabel: sourceData.bankBookName ?? "",
                invoiceFor: type,
                sourceQuotationId: type === "QUOTATION" ? String(id) : "",
                sourceQuotationLabel: type === "QUOTATION" ? sourceData.quotationCode ?? "" : "",
                sourceOrderId: type === "ORDER" ? String(id) : "",
                sourceOrderLabel: type === "ORDER" ? sourceData.orderCode ?? "" : "",
            }));

            if (prefillItems.length > 0) setItems(prefillItems);
        } catch (err) {
            toast.error("Failed to load source data: " + err.message, { position: "top-right" });
        } finally {
            setPrefillLoading(false);
        }
    };




    const setFormField = (key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
    };


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

                if (data.status !== "DRAFT") {
                    toast.error("Only Draft invoices can be edited.", { position: "top-right" });
                    router.replace(`/invoice/${id}`);
                    return;
                }




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
                    sourceOrderLabel: data.sourceOrderCode ?? "",
                    sourceQuotationId: data.sourceQuotationId ? String(data.sourceQuotationId) : "",
                    sourceQuotationLabel: data.sourceQuotationCode ?? "",
                });

                setExistingAttachments(data.attachments ?? []);


                if (data.customerId) {
                    const custRes = await fetch("/relayapi", {
                        method: "GET",
                        headers: { ...authHeaders(), endpoint: `customer-details/${data.customerId}`, module: "customer" },
                    });
                    const custPayload = await custRes.json();
                    const custData = custPayload.encrypted ? decryptResponse(custPayload.encrypted) : custPayload;
                    setCurrencies(custData?.currencies ?? []);
                }


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
                            quantity: limitDecimals(String(it.quantity ?? "")),
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


    const loadUserOptions = (inputValue, callback) => {
        fetch("/relayapi", {
            method: "POST",
            headers: { ...authHeaders(), endpoint: "user-list", module: "user", "Content-Type": "application/json", self: "true" },
            body: JSON.stringify({
                page: 1, limit: 20, filters: [...(inputValue ? [{ key: "name", value: inputValue, operator: "contains" }] : []),
                { key: "status", value: "Active", operator: "equal" }
                ]
            }),
        })
            .then((r) => r.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                callback((data?.data ?? []).map((u) => ({ value: u.userId, label: u.name })));
            })
            .catch(() => callback([]));
    };

    const loadOrderOptions = (inputValue, callback) => {
        fetch("/relayapi", {
            method: "POST",
            headers: { ...authHeaders(), endpoint: "order-list", module: "order", "Content-Type": "application/json" },
            body: JSON.stringify({ page: 1, limit: 20, filters: [{ key: "status", value: "DELIVERED", operator: "eq" }, ...(inputValue ? [{ key: "orderCode", value: inputValue, operator: "like" }] : [])] }),
        })
            .then((r) => r.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                callback((data?.data ?? []).map((o) => ({ value: o.orderId, label: `${o.orderCode}` })));
            })
            .catch(() => callback([]));
    };

    const loadQuotationOptions = (inputValue, callback) => {
        fetch("/relayapi", {
            method: "POST",
            headers: { ...authHeaders(), endpoint: "quotation-list", module: "quotation", "Content-Type": "application/json" },
            body: JSON.stringify({ page: 1, limit: 20, filters: [{ key: "status", value: "CONFIRMED", operator: "eq" }, ...(inputValue ? [{ key: "quotationCode", value: inputValue, operator: "like" }] : [])] }),
        })
            .then((r) => r.json())
            .then((payload) => {
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                callback((data?.data ?? []).map((q) => ({ value: q.quotationId, label: `${q.quotationCode}` })));
            })
            .catch(() => callback([]));
    };

    const handleDiscard = async () => {
        const result = await MySwal.fire({ title: "Discard changes?", text: "All unsaved data will be lost.", icon: "warning", showCancelButton: true, confirmButtonText: "Discard", confirmButtonColor: "#ef4444" });
        if (result.isConfirmed) router.push(`/invoice/${id}`);
    };





    const handleExchangeRateChange = (rawValue) => {
        setFormField("currencyConversionRate", rawValue);
        const newRate = parseFloat(rawValue) || 0;
        setItems((prevItems) => prevItems.map((it) => {
            if (!it.itemId) return it;
            const basePrice = parseFloat(it.baseCurrencyPrice) || 0;
            return computeItem({ ...it, unitPrice: newRate > 0 ? parseFloat((basePrice * newRate).toFixed(4)) : 0 });
        }));
    };

    const handleSubmit = async (isSubmit = false) => {
        setSubmitAttempted(true);
        const payloadToValidate = { ...formData, items };
        const parseRes = InvoiceUpdateFormSchema.safeParse(payloadToValidate);
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
            return;
        }
        setErrors({});
        setItemErrors({});

        if ((totals.finalAmount ?? 0) <= 0) {
            toast.error("Total amount must be greater than zero.", { position: "top-right" });
            return;
        }

        const confirmTitle = isSubmit ? "Submit Invoice?" : "Save Invoice as Draft?";
        const confirmText = isSubmit
            ? "The invoice will be updated and submitted. A PDF will be generated."
            : "Save this invoice as a draft. You can submit it later.";
        const confirmBtn = isSubmit ? "Submit" : "Save as Draft";
        const confirmColor = isSubmit ? "#060607" : "#2563eb";

        const confirm = await MySwal.fire({ title: confirmTitle, text: confirmText, icon: "question", showCancelButton: true, confirmButtonText: confirmBtn, confirmButtonColor: confirmColor });
        if (!confirm.isConfirmed) return;

        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("invoiceId", String(id));


            fd.append("customerId", formData.customerId);
            fd.append("currencyId", formData.currencyId);
            fd.append("companyId", String(companyId));


            fd.append("invoiceDate", formData.invoiceDate);
            fd.append("remarks", formData.remarks);
            fd.append("businessTerms", formData.businessTerms);
            fd.append("paymentType", formData.paymentType);
            fd.append("discountApplicable", formData.discountApplicable);
            if (formData.termsConditionsId) fd.append("termsConditionsId", String(formData.termsConditionsId));
            if (formData.termsConditionsText) fd.append("termsConditionsText", formData.termsConditionsText);


            fd.append("deliveryDate", formData.deliveryDate);
            fd.append("currencyConversionRate", String(formData.currencyConversionRate));
            fd.append("vatWithheld", formData.vatWithheld);
            fd.append("deliveryType", formData.deliveryType);
            if (formData.shippingState) fd.append("shippingState", formData.shippingState);
            if (formData.billingState) fd.append("billingState", formData.billingState);
            if (formData.deliveryState) fd.append("deliveryState", formData.deliveryState);
            if (formData.bankBookId) fd.append("bankBookId", formData.bankBookId);
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
                headers: { endpoint: "invoice-update", module: "invoice" },
                body: fd,
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1) {
                if (isSubmit) {
                    const subRes = await fetch("/relayapi", {
                        method: "PUT",
                        headers: { ...authHeaders(), endpoint: `invoice-submit/${id}`, module: "invoice" },
                    });
                    const subPayload = await subRes.json();
                    const subData = subPayload.encrypted ? decryptResponse(subPayload.encrypted) : subPayload;
                    if (subData?.success === 1) {
                        toast.success("Invoice updated and submitted successfully.", { position: "top-right" });
                    } else {
                        toast.warning(`Invoice updated but submit failed: ${subData?.message || "Unknown error"}`, { position: "top-right" });
                    }
                } else {
                    toast.success("Invoice saved as draft.", { position: "top-right" });
                }
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
                    <Link href="/" className="cursor-pointer hover:text-blue-600">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/invoice-list" className="cursor-pointer hover:text-blue-600">Invoices</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href="/invoice/${id}" className="cursor-pointer hover:text-blue-600">Invoice</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">Edit</span>
                </nav>
            </div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6 px-6 pt-4">
                <h1 className="text-2xl font-semibold text-[#1f2937]">
                    {"Invoice"}
                </h1>
            </div>

            <div className="flex-1 px-6 py-4 pb-24 space-y-5">

                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 mb-5">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Customer</label>
                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium">
                                {formData.currencyCode ? `${formData.customerLabel} (${formData.currencyCode})` : formData.customerLabel}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Contact Person <span className="text-red-500">*</span></label>
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
                                styles={rsStyles(!!errors.contactPersonId)}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {errors.contactPersonId && <p className="text-red-500 text-xs mt-1">{errors.contactPersonId}</p>}
                        </div>

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
                    </div>
                </div>

                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

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

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Exchange Rate {formData.currencyCode && <span className="text-gray-400">({formData.currencyCode})</span>}
                            </label>
                            <FormattedNumberInput
                                id="invoice-conversion-rate"
                                value={String(limitPriceDecimals(formData.currencyConversionRate ?? 1))}
                                onChange={(e) => handleExchangeRateChange(limitPriceDecimals(e.target.value))}
                                placeholder="1.00"
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.currencyConversionRate ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
                            />
                            {errors.currencyConversionRate && <p className="text-red-500 text-xs mt-1">{errors.currencyConversionRate}</p>}
                        </div>

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

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Shipping Address <span className="text-red-500">*</span></label>
                            <Select
                                instanceId="invoice-shipping-state"
                                value={formData.shippingState ? { value: formData.shippingState, label: countries.find(o => String(o.value) === String(formData.shippingState))?.label || formData.shippingState } : null}
                                onChange={(selected) => setFormField("shippingState", selected ? selected.value : "")}
                                options={countries}
                                isClearable
                                placeholder="Select country"
                                classNamePrefix="react-select"
                                styles={rsStyles(!!errors.shippingState)}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {errors.shippingState && <p className="text-red-500 text-xs mt-1">{errors.shippingState}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Billing Address <span className="text-red-500">*</span></label>
                            <Select
                                instanceId="invoice-billing-state"
                                value={formData.billingState ? { value: formData.billingState, label: countries.find(o => String(o.value) === String(formData.billingState))?.label || formData.billingState } : null}
                                onChange={(selected) => setFormField("billingState", selected ? selected.value : "")}
                                options={countries}
                                isClearable
                                placeholder="Select country"
                                classNamePrefix="react-select"
                                styles={rsStyles(!!errors.billingState)}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {errors.billingState && <p className="text-red-500 text-xs mt-1">{errors.billingState}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Place Of Delivery <span className="text-red-500">*</span></label>
                            <Select
                                instanceId="invoice-delivery-state"
                                value={formData.deliveryState ? { value: formData.deliveryState, label: countries.find(o => String(o.value) === String(formData.deliveryState))?.label || formData.deliveryState } : null}
                                onChange={(selected) => setFormField("deliveryState", selected ? selected.value : "")}
                                options={countries}
                                isClearable
                                placeholder="Select country"
                                classNamePrefix="react-select"
                                styles={rsStyles(!!errors.deliveryState)}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {errors.deliveryState && <p className="text-red-500 text-xs mt-1">{errors.deliveryState}</p>}
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

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice For</label>
                            <Select
                                instanceId="invoice-for-select"
                                value={INVOICE_FOR_OPTIONS.find((o) => o.value === formData.invoiceFor) || INVOICE_FOR_OPTIONS[0]}
                                onChange={(selected) => {
                                    setFormField("invoiceFor", selected?.value || "");
                                    setFormField("sourceOrderId", ""); setFormField("sourceOrderLabel", ""); setFormField("sourceQuotationId", ""); setFormField("sourceQuotationLabel", "");
                                }}
                                options={INVOICE_FOR_OPTIONS}

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
                                    value={formData.sourceOrderId ? { value: formData.sourceOrderId, label: formData.sourceOrderLabel || formData.sourceOrderId } : null}
                                    onChange={(selected) => {
                                        if (selected) {
                                            setFormField("sourceOrderId", String(selected.value));
                                            setFormField("sourceOrderLabel", selected.label);
                                            loadSourceIntoForm("ORDER", selected.value);

                                        } else {
                                            setFormField("sourceOrderId", ""); setFormField("sourceOrderLabel", "");
                                        }
                                    }}
                                    placeholder="Search order..."
                                    isClearable

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
                                    value={formData.sourceQuotationId ? { value: formData.sourceQuotationId, label: formData.sourceQuotationLabel || formData.sourceQuotationId } : null}
                                    onChange={(selected) => {
                                        if (selected) {
                                            setFormField("sourceQuotationId", String(selected.value));
                                            setFormField("sourceQuotationLabel", selected.label);
                                            loadSourceIntoForm("QUOTATION", selected.value);

                                        } else {
                                            setFormField("sourceQuotationId", ""); setFormField("sourceQuotationLabel", "");
                                        }
                                    }}
                                    placeholder="Search quotation..."
                                    isClearable

                                    classNamePrefix="react-select"
                                    styles={rsStyles(!!errors.sourceQuotationId)}
                                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                />
                                {errors.sourceQuotationId && <p className="text-red-500 text-xs mt-1">{errors.sourceQuotationId}</p>}
                            </div>
                        )}
                    </div>
                </div>

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
                                                            const currencyStr = bb.currencyCode || bb.currency?.code || currencies?.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.curCode || currencies?.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.currencyCode || currencies?.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.code || "";
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
                                                        const currencyStr = bb.currencyCode || bb.currency?.code || currencies?.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.curCode || currencies?.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.currencyCode || currencies?.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.code || "";
                                                        return {
                                                            value: String(bb.bankBookId ?? bb.value),
                                                            label: currencyStr ? `${baseName} (${currencyStr})` : baseName
                                                        };
                                                    })}
                                                    isDisabled={!formData.currencyId || filteredBankBooks.length === 0}
                                                    isClearable
                                                    placeholder={formData.currencyId ? "-- Select bank account --" : "Select currency first"}
                                                    classNamePrefix="react-select"
                                                    styles={rsStyles(!!errors.bankBookId)}
                                                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                                />
                                                {errors.bankBookId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.bankBookId}</p>}
                                            </>
                                        );
                                    })()}
                                </div>
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
                                    {errors.vatWithheld && <p className="text-red-500 text-xs mt-1">{errors.vatWithheld}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sales Person <span className="text-red-500">*</span></label>
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
                                        styles={rsStyles(!!errors.salesPersonId)}
                                        menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                    />
                                    {errors.salesPersonId && <p className="text-red-500 text-xs mt-1">{errors.salesPersonId}</p>}
                                </div>
                            </div>
                        </div>
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


            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-6 py-4 flex items-center justify-between z-30">
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
                        onClick={() => handleSubmit(false)}
                        disabled={loading}
                        className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {loading ? "Saving…" : "Save as Draft"}
                    </button>
                    {/* <button
                        type="button"
                        onClick={() => handleSubmit(true)}
                        disabled={loading}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {loading ? "Submitting…" : "Submit"}
                    </button> */}
                </div>
            </div>
        </div>
    );
}
