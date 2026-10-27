"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useContext } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { loginContext } from "../hooks/LoginContext";
import Header from "../Header";
import Loader from "../ui/Loader";
import CreditNoteItemsTable, { newEmptyCreditNoteItem, toCreditNotePayloadItems } from "../creditNote/CreditNoteItemsTable";
import CreditNoteSummaryPanel from "../creditNote/CreditNoteSummaryPanel";
import { toast } from "react-toastify";
import { getCreditNoteMode } from "@/lib/creditNoteMode";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { noteInvoiceFormConfig } from "./configs/noteInvoiceForm.config";

const MySwal = withReactContent(Swal);

export default function NoteInvoiceAddForm({ noteType }) {
    const cfg = noteInvoiceFormConfig[noteType];
    if (!cfg) throw new Error("NoteInvoiceAddForm: unknown noteType");

    const router = useRouter();
    const searchParams = useSearchParams();
    const urlInvoiceId = searchParams.get("invoiceId");
    const presetCustomerId = searchParams.get("customerId");
    
    const { loginDetails, activeAssignment, can } = useContext(loginContext) || {};
    const companyId = activeAssignment?.companyId;
    const mode = getCreditNoteMode();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        invoiceId: "",
        invoiceCode: "",
        invoiceDate: "",
        customerId: "",
        customerLabel: "",
        companyId: "",
        currencyId: "",
        currencyCode: "",
        currencySymbol: "",
        narration: "",
        remarks: "",
        ...cfg.initialFormExtras,
    });

    const [items, setItems] = useState([newEmptyCreditNoteItem()]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [totals, setTotals] = useState({});
    const [errors, setErrors] = useState({});
    const [itemErrors, setItemErrors] = useState({});
    const [isLocked, setIsLocked] = useState(false);
    const [presetCustomer, setPresetCustomer] = useState(null);
    const [invoiceOptions, setInvoiceOptions] = useState([]);
    const [invoiceLineItems, setInvoiceLineItems] = useState([]);
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const setFormField = (key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const loadPresetCustomerOptions = (inputValue, callback) => {
        const opts = (presetCustomer?.options || []).filter((o) =>
            !inputValue || o.label.toLowerCase().includes(inputValue.toLowerCase())
        );
        callback(opts);
    };

    const loadCustomerOptions = (inputValue, callback) => {
        if (!companyId) return callback([]);
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
                limit: 50,
                filters: [
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
                callback(options);
            })
            .catch(() => callback([]));
    };

    const handleCustomerCurrencySelect = async (selected) => {
        const hasDirtyData = items.some((it) => it.itemId || it.invoiceItemId || it.quantity || it.unitPrice || it.rate);
        if (hasDirtyData) {
            const result = await MySwal.fire({
                title: "Change Customer?",
                text: "Changing customer or currency will clear all selected items.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Change",
                confirmButtonColor: "#ef4444",
                cancelButtonText: "Cancel",
            });
            if (!result.isConfirmed) return;
        }

        if (!selected) {
            setFormData((prev) => ({
                ...prev,
                customerId: "",
                customerLabel: "",
                currencyId: "",
                currencyCode: "",
                currencySymbol: "",
                invoiceId: "",
                invoiceCode: "",
                invoiceDate: "",
                ...(cfg.hasIssueDate ? { issueDate: "" } : {}),
            }));
            setInvoiceOptions([]);
            setInvoiceLineItems([]);
            setItems([newEmptyCreditNoteItem()]);
            return;
        }

        const raw = selected.raw;
        const custId = raw.customerId;
        const curId = raw.curId;

        setFormData((prev) => ({
            ...prev,
            customerId: String(custId),
            customerLabel: raw.customer?.customerName || "",
            currencyId: String(curId),
            currencyCode: raw.currency?.code || "",
            currencySymbol: raw.currency?.symbol || "",
            invoiceId: "",
            invoiceCode: "",
            invoiceDate: "",
            ...(cfg.hasIssueDate ? { issueDate: "" } : {}),
        }));

        setItems([newEmptyCreditNoteItem()]);
        setInvoiceLineItems([]);

        // Load invoices for this customer and currency
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `invoices-by-customer/${custId}/${curId}`,
                    module: cfg.module,
                },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            const invoices = (data?.data ?? []).map((inv) => ({
                value: String(inv.invoiceId),
                label: `${inv.invoiceCode} — ${inv.status}`,
                raw: inv,
            }));
            setInvoiceOptions(invoices);
        } catch (err) {
            setInvoiceOptions([]);
        }
    };

    const fetchInvoiceDetails = async (invId) => {
        setLoading(true);
        try {
            const res = await fetch(`/relayapi`, {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `invoice-items/${invId}`,
                    module: cfg.module,
                },
            });
            if (res.status === 401 || res.status === 403) {
                setError("Unauthorized");
                setLoading(false);
                return;
            }
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            
            if (data.success) {
                setFormData((prev) => ({
                    ...prev,
                    invoiceId: String(data.invoiceId),
                    invoiceCode: data.invoiceCode,
                    invoiceDate: data.invoiceDate,
                    customerId: String(data.customerId),
                    customerLabel: data.customerName || prev.customerLabel,
                    currencyId: String(data.currencyId),
                    currencyCode: data.currencyCode || prev.currencyCode,
                    currencySymbol: data.currencySymbol || prev.currencySymbol,
                    companyId: companyId,
                }));
                
                setInvoiceLineItems(data.items);
                setItems([newEmptyCreditNoteItem()]);
            } else {
                toast.error(data.message || "Failed to load invoice items");
                if (urlInvoiceId) setError(data.message || "Failed to load invoice items");
            }
        } catch (err) {
            toast.error(err.message);
            if (urlInvoiceId) setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInvoiceSelect = async (option) => {
        const hasData = items.some((it) => it.invoiceItemId || it.itemId || (it.description && it.description.trim() !== ""));
        if (hasData) {
            const result = await MySwal.fire({
                title: "Change Invoice?",
                text: "Changing the invoice will clear the current items.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Change",
                confirmButtonColor: "#ef4444",
            });
            if (!result.isConfirmed) return;
        }

        if (!option) {
            setFormData((prev) => ({
                ...prev,
                invoiceId: "",
                invoiceCode: "",
                invoiceDate: "",
                ...(cfg.hasIssueDate ? { issueDate: "" } : {}),
            }));
            setItems([newEmptyCreditNoteItem()]);
            setInvoiceLineItems([]);
            return;
        }
        setItems([newEmptyCreditNoteItem()]);
        await fetchInvoiceDetails(option.value);
    };

    useEffect(() => {
        if (mode !== "INVOICE") {
            router.replace(cfg.listRoute);
            return;
        }

        const loadInitialData = async () => {
            if (urlInvoiceId) {
                setIsLocked(true);
                await fetchInvoiceDetails(urlInvoiceId);
            } else if (presetCustomerId) {
                try {
                    const res = await fetch("/relayapi", {
                        method: "POST",
                        headers: {
                            ...authHeaders(),
                            endpoint: "customer-currencies-list",
                            module: "customer",
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            page: 1,
                            limit: 50,
                            filters: [
                                { key: "customerId", value: String(presetCustomerId), operator: "equal" },
                            ],
                        }),
                    });
                    const payload = await res.json();
                    const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                    const rows = (data?.data?.data ?? data?.data ?? []).filter(
                        (c) => String(c.customerId) === String(presetCustomerId)
                    );
                    if (!rows.length) {
                        toast.error("Customer has no assigned currencies or not found.", { position: "top-right" });
                        setPresetCustomer(null);
                        setLoading(false);
                        return;
                    }

                    const options = rows.map((c) => ({
                        value: `${c.customerId}_${c.curId}`,
                        label: `${c.customer?.customerName} (${c.currency?.code})`,
                        raw: c,
                    }));

                    if (options.length === 1) {
                        const opt = options[0];
                        setPresetCustomer({
                            customerId: String(presetCustomerId),
                            customerName: opt.raw.customer?.customerName || "",
                            isSingle: true,
                            options,
                        });
                        await handleCustomerCurrencySelect(opt);
                    } else {
                        const custName = options[0].raw.customer?.customerName || "";
                        setPresetCustomer({
                            customerId: String(presetCustomerId),
                            customerName: custName,
                            isSingle: false,
                            options,
                        });
                    }
                } catch (err) {
                    toast.error("Failed to load customer details: " + err.message, { position: "top-right" });
                    setPresetCustomer(null);
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [urlInvoiceId, presetCustomerId, mode, router, loginDetails]);

    useEffect(() => {
        if (!submitAttempted) return;
        const parseRes = cfg.schema.safeParse({ ...formData, items });
        if (!parseRes.success) {
            const fieldErrors = {};
            const itemErrs = {};
            parseRes.error.issues.forEach((err) => {
                if (err.path[0] === "items" && typeof err.path[1] === "number") {
                    const idx = err.path[1];
                    const field = err.path[2];
                    itemErrs[idx] = { ...(itemErrs[idx] || {}), [field]: err.message };
                } else {
                    const field = err.path[0];
                    if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
                }
            });
            setErrors(fieldErrors);
            setItemErrors(itemErrs);
        } else {
            setErrors({});
            setItemErrors({});
        }
    }, [formData, items, submitAttempted]);

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
        if (result.isConfirmed) router.push(cfg.listRoute);
    };

    const handleSave = async () => {
        setSubmitAttempted(true);

        if (!companyId) {
            toast.error("No active company found");
            return;
        }

        const payloadToValidate = {
            ...formData,
            items,
        };

        const parseRes = cfg.schema.safeParse(payloadToValidate);
        if (!parseRes.success) {
            const fieldErrors = {};
            const itemErrs = {};
            parseRes.error.issues.forEach((err) => {
                if (err.path[0] === "items" && typeof err.path[1] === "number") {
                    const idx = err.path[1];
                    const field = err.path[2];
                    itemErrs[idx] = { ...(itemErrs[idx] || {}), [field]: err.message };
                } else {
                    const field = err.path[0];
                    if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
                }
            });
            setErrors(fieldErrors);
            setItemErrors(itemErrs);
            return;
        }

        setErrors({});
        setItemErrors({});

        if ((totals.finalAmount ?? 0) <= 0) {
            toast.error(cfg.zeroAmountMsg);
            return;
        }

        const confirmRes = await MySwal.fire({
            title: cfg.confirmTitle,
            text: cfg.confirmText,
            icon: "info",
            showCancelButton: true,
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, create it!",
            cancelButtonText: "Cancel",
        });
        if (!confirmRes.isConfirmed) return;

        setSubmitting(true);
        try {
            const payload = {
                companyId: companyId,
                customerId: formData.customerId,
                currencyId: formData.currencyId,
                invoiceId: formData.invoiceId,
                narration: formData.narration,
                remarks: formData.remarks,
                noteMode: "INVOICE",
                items: JSON.stringify(toCreditNotePayloadItems(items)),
                ...(cfg.hasIssueDate ? { issueDate: formData.issueDate } : {}),
                ...(cfg.hasVatWithheld ? { vatWithheld: formData.vatWithheld } : {}),
            };

            const form = new FormData();
            for (const key in payload) {
                if (payload[key] !== null && payload[key] !== undefined) {
                    form.append(key, payload[key]);
                }
            }
            selectedFiles.forEach((file) => {
                form.append("attachments", file);
            });

            const res = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    endpoint: cfg.addEndpoint,
                    module: cfg.module,
                },
                body: form,
            });

            if (res.status === 401 || res.status === 403) throw new Error("Unauthorized");
            const responsePayload = await res.json();
            const data = responsePayload.encrypted ? decryptResponse(responsePayload.encrypted) : responsePayload;

            if (data.success) {
                toast.success(data.message || cfg.successMsg, { position: "top-right" });
                router.push(cfg.listRoute);
            } else {
                toast.error(data.message || cfg.failMsg, { position: "top-right" });
                setSubmitting(false);
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
                <Header page={cfg.headerPage} />
                <div className="flex-1 flex items-center justify-center">
                    <Loader label={cfg.loaderLabel} />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
                <Header page={cfg.headerPage} />
                <div className="p-8 max-w-7xl mx-auto flex-1">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <h2 className="text-lg font-semibold">{error}</h2>
                        </div>
                        <button onClick={() => router.push(cfg.listRoute)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium">
                            Back to List
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
            <Header page={cfg.headerPage} />

            <div className="px-6 pt-4">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <Link href="/" className="cursor-pointer hover:text-blue-600">Home</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <Link href={cfg.listRoute} className="cursor-pointer hover:text-blue-600">{cfg.breadcrumbListLabel}</Link>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">{cfg.pageTitle}</span>
                </nav>
            </div>
            
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6 px-6 pt-4">
                <h1 className="text-2xl font-semibold text-[#1f2937]">
                    {cfg.pageTitle}
                </h1>
            </div>

            <div className="flex-1 px-6 py-4 pb-24 space-y-5">
                <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Customer + Currency <span className="text-red-500">*</span>
                            </label>
                            {isLocked || (presetCustomer && presetCustomer.isSingle) ? (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium h-[42px] flex items-center">
                                    {formData.currencyCode ? `${formData.customerLabel} (${formData.currencyCode})` : formData.customerLabel}
                                </div>
                            ) : (
                                <AsyncSelect
                                    instanceId="customer-currency-select"
                                    cacheOptions={!presetCustomer}
                                    defaultOptions={presetCustomer ? presetCustomer.options : true}
                                    loadOptions={presetCustomer ? loadPresetCustomerOptions : loadCustomerOptions}
                                    value={formData.customerId && formData.currencyId ? { value: `${formData.customerId}_${formData.currencyId}`, label: `${formData.customerLabel} (${formData.currencyCode})` } : null}
                                    onChange={handleCustomerCurrencySelect}
                                    placeholder={presetCustomer ? "Select Currency..." : "Select Customer & Currency..."}
                                    isClearable={!presetCustomer}
                                    classNamePrefix="react-select"
                                    styles={{
                                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                        control: (base) => ({
                                            ...base,
                                            minHeight: "42px",
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
                                Invoice <span className="text-red-500">*</span>
                            </label>
                            {isLocked ? (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-medium h-[42px] flex items-center">
                                    {formData.invoiceCode}
                                </div>
                            ) : (
                                <Select
                                    instanceId="invoice-select"
                                    value={formData.invoiceId ? { value: formData.invoiceId, label: formData.invoiceCode } : null}
                                    onChange={handleInvoiceSelect}
                                    options={invoiceOptions}
                                    isDisabled={!formData.customerId || !formData.currencyId}
                                    placeholder={(!formData.customerId || !formData.currencyId) ? "Select customer first..." : "Select Invoice..."}
                                    noOptionsMessage={() => "No eligible invoices"}
                                    isClearable
                                    classNamePrefix="react-select"
                                    styles={{
                                        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                        control: (base) => ({
                                            ...base,
                                            minHeight: "42px",
                                            borderRadius: "0.75rem",
                                            borderColor: errors.invoiceId ? "#ef4444" : "#d1d5db",
                                            padding: "1px",
                                            fontSize: "0.875rem",
                                            boxShadow: "none",
                                            "&:hover": { borderColor: errors.invoiceId ? "#ef4444" : "#3b82f6" },
                                        }),
                                    }}
                                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                                />
                            )}
                            {errors.invoiceId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.invoiceId}</p>}
                        </div>

                        {cfg.hasIssueDate && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Issue Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.issueDate}
                                    onChange={(e) => setFormField("issueDate", e.target.value)}
                                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 cursor-pointer h-[42px] ${errors.issueDate ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                                />
                                {errors.issueDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.issueDate}</p>}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <CreditNoteItemsTable
                        companyId={companyId}
                        items={items}
                        onChange={(newItems) => {
                            setItems(newItems);
                        }}
                        submitAttempted={submitAttempted}
                        currencySymbol={formData.currencySymbol}
                        itemErrors={itemErrors}
                        invoiceItems={invoiceLineItems}
                    />
                    {errors.items && <p className="text-red-500 text-xs mt-1 font-medium px-2">{errors.items}</p>}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-7 space-y-5">
                        {cfg.hasVatWithheld && (
                            <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                            VAT Withheld <span className="text-red-500">*</span>
                                        </label>
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
                                </div>
                            </div>
                        )}

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
                    </div>

                    <div className="lg:col-span-5 space-y-5">
                        <CreditNoteSummaryPanel
                            items={items}
                            vatWithheld={cfg.hasVatWithheld ? formData.vatWithheld : "NO"}
                            currencyCode={formData.currencyCode}
                            currencySymbol={formData.currencySymbol}
                            selectedFiles={selectedFiles}
                            onFilesChange={setSelectedFiles}
                            onTotalsChange={setTotals}
                        />
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-center gap-4 shadow-lg">
                <button
                    type="button"
                    onClick={handleDiscard}
                    className="rounded-sm border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                    Discard
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={submitting}
                    className="rounded-sm bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                >
                    {submitting ? "Submitting..." : "Submit"}
                </button>
            </div>
        </div>
    );
}
