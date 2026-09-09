"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import AsyncSelect from "react-select/async";
import { Country } from "country-state-city";
import Header from "../Header";
import Loader from "../ui/Loader";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import { OrderFormSchema } from "../Zod";
import OrderItemsTable, { newEmptyItem, computeItem, generateRowId, getItemLabel } from "./OrderItemsTable";
import OrderSummaryPanel from "./OrderSummaryPanel";
import TermsConditionsWidget from "../quotation/TermsConditionsWidget";

const MySwal = withReactContent(Swal);

function formatDateForInput(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
}

export default function AddOrder() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { activeAssignment } = useContext(loginContext) || {};

    const quotationId = searchParams.get("quotationId");
    const sourceId = quotationId;

    const companyId = activeAssignment?.companyId;

    const [formData, setFormData] = useState({
        sourceQuotationId: "", sourceQuotationLabel: "",
        customerId: "", customerLabel: "",
        currencyId: "", currencyCode: "", currencySymbol: "", currencyConversionRate: 1,
        contactPersonId: "", contactPersonLabel: "",
        orderDate: "", deliveryDate: "",
        businessTerms: "", paymentType: "",
        deliveryTerms: "",
        discountApplicable: "",
        shippingState: "", billingState: "", deliveryState: "",
        deliveryType: "", invoiceGenerationOn: "", invoiceAutoApproval: "NO",
        bankBookId: "", bankBookLabel: "",
        placeOfSupply: "", vatWithheld: "NO",
        salesPersonId: "", salesPersonLabel: "",
        remarks: "", termsConditionsId: null, termsConditionsText: "",
    });

    const [errors, setErrors] = useState({});

    const setFormField = (key, value) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
    };

    const [currencies, setCurrencies] = useState([]);
    const [bankBooks, setBankBooks] = useState([]);
    const [items, setItems] = useState([newEmptyItem()]);
    const [orderDiscounts, setOrderDiscounts] = useState([]);
    const [orderExtraCharges, setOrderExtraCharges] = useState([]);

    const [termsConditionsFile, setTermsConditionsFile] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [existingAttachments, setExistingAttachments] = useState([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]);

    const [loading, setLoading] = useState(false);
    const [prefillState, setPrefillState] = useState(sourceId ? "loading" : "ok");

    const [lockedCustomer, setLockedCustomer] = useState(false);

    const countries = Country.getAllCountries().map(c => ({ value: c.name, label: c.name }));

    const loadQuotationIntoForm = async (id, isFromUrl = false) => {
        setPrefillState("loading");
        try {
            let res = await fetch("/relayapi", {
                method: "GET",
                headers: { ...authHeaders(), endpoint: `quotation-details/${id}`, module: "quotation" },
            });
            let payload = await res.json();
            let data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (!data?.quotationId) {
                if (isFromUrl) {
                    setPrefillState("denied");
                } else {
                    toast.error("Could not load quotation details.");
                    setPrefillState("ok");
                }
                return;
            }

            if (data.status !== "CONFIRMED") {
                toast.error("Only CONFIRMED quotations can be converted into orders.");
                if (isFromUrl) {
                    setPrefillState("denied");
                    router.push("/quotation-list");
                } else {
                    setPrefillState("ok");
                }
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

            setFormData({
                sourceQuotationId: String(data.quotationId ?? ""), sourceQuotationLabel: data.quotationCode ?? "",
                customerId: String(data.customerId ?? ""), customerLabel: data.customerName ?? "",
                currencyId: String(data.currencyId ?? ""), currencyCode: data.currencyCode ?? "", currencySymbol: data.currencySymbol ?? "", currencyConversionRate: rate,
                contactPersonId: String(data.contactPersonId ?? ""), contactPersonLabel: data.contactPersonName ?? "",
                orderDate: formatDateForInput(data.orderDate), deliveryDate: formatDateForInput(data.deliveryDate),
                businessTerms: data.businessTerms ?? "", paymentType: data.paymentType ?? "",
                deliveryTerms: data.deliveryTerms ?? "",
                discountApplicable: data.discountApplicable ?? "",
                shippingState: data.shippingState ?? "", billingState: data.billingState ?? "", deliveryState: data.deliveryState ?? "",
                deliveryType: data.deliveryType ?? "", invoiceGenerationOn: data.invoiceGenerationOn ?? "", invoiceAutoApproval: data.invoiceAutoApproval ?? "NO",
                bankBookId: String(data.bankBookId ?? ""), bankBookLabel: data.bankBookName ?? "",
                placeOfSupply: data.placeOfSupply ?? "", vatWithheld: data.vatWithheld ?? "NO",
                salesPersonId: String(data.salesPersonId ?? ""), salesPersonLabel: data.salesPersonName ?? "",
                remarks: data.remarks ?? "", termsConditionsId: data.termsConditionsId ?? null, termsConditionsText: data.termsConditionsText ?? "",
            });

            const rawItems = data.quotationItems || data.items || [];
            if (rawItems.length) {
                setItems(
                    rawItems.map((it) => {
                        const unitPriceVal = parseFloat(it.unitPrice) || 0;
                        const basePrice =
                            parseFloat(it.baseCurrencyPrice) ||
                            parseFloat(it.item?.convertedCostPerUnit) ||
                            (parseFloat(it.item?.costPerUnit) / (parseFloat(it.item?.conversionRate) || 1)) ||
                            (unitPriceVal / rate) ||
                            0;
                        const realItemId = String(it.itemId ?? it.item?.itemId ?? it.id ?? "");
                        const labelStr = getItemLabel(it);

                        const loadedTaxCalc = it.taxCalculation === "NA" ? "N/A" : (it.taxCalculation || "N/A");
                        const isTaxableLoad = loadedTaxCalc === "EXCLUSIVE" || loadedTaxCalc === "INCLUSIVE";
                        const loadedTaxable = parseFloat(it.taxableAmount) || 0;
                        const loadedTaxAmt = parseFloat(it.taxAmount) || 0;
                        const derivedTaxRate = parseFloat(it.taxRate) || (isTaxableLoad && loadedTaxable > 0 ? (loadedTaxAmt / loadedTaxable) * 100 : 0);

                        return computeItem({
                            _id: generateRowId(),
                            itemId: realItemId,
                            itemLabel: labelStr,
                            itemGL: it.itemGL ?? "",
                            isDecimalAllowed:
                                it.isDecimalAllowed !== undefined
                                    ? (it.isDecimalAllowed !== false && String(it.isDecimalAllowed) !== "false")
                                    : (it.item?.isDecimalAllowed !== undefined
                                        ? (it.item.isDecimalAllowed !== false && String(it.item.isDecimalAllowed) !== "false")
                                        : true),
                            baseCurrencyPrice: basePrice,
                            quantity: it.quantity ?? 1,
                            unitPrice: unitPriceVal,
                            taxCalculation: loadedTaxCalc,
                            taxGroup: it.taxGroup || "",
                            taxGroupId: it.taxGroupId || "",
                            taxRate: derivedTaxRate,
                            taxAmount: loadedTaxAmt,
                            taxableAmount: loadedTaxable,
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

            const rawHeaderDisc = data.discounts || data.quotationDiscounts || [];
            setOrderDiscounts(
                rawHeaderDisc.map((d) => ({
                    id: d.quotationDiscountId || d.id,
                    description: d.discountDescription || d.description || "",
                    amount: parseFloat(d.discountPrice ?? d.amount) || 0,
                    discountDescription: d.discountDescription || d.description || "",
                    discountPrice: parseFloat(d.discountPrice ?? d.amount) || 0,
                }))
            );

            const rawHeaderEC = data.extraCharges || data.quotationExtraCharges || [];
            setOrderExtraCharges(
                rawHeaderEC.map((ec) => ({
                    id: ec.quotationExtraChargeId || ec.id,
                    description: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                    amount: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                    extraChargesDescription: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                    extraChargesPrice: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
                }))
            );

            setLockedCustomer(true);
            setPrefillState("ok");
        } catch {
            if (isFromUrl) {
                setPrefillState("denied");
            } else {
                toast.error("Failed to load quotation.");
                setPrefillState("ok");
            }
        }
    };

    useEffect(() => {
        const idToLoad = sourceId || quotationId;
        if (!idToLoad) {
            setPrefillState("ok");
            return;
        }
        loadQuotationIntoForm(idToLoad, true);
    }, [quotationId, sourceId]);

    const loadContactPersonOptions = (inputValue, callback) => {
        if (!formData.customerId) return callback([]);
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
                page: 1, limit: 20,
                filters: [
                    ...(inputValue ? [{ key: "name", value: inputValue, operator: "contains" }] : []),
                ],
            }),
        }).then(res => res.json()).then(payload => {
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            callback((data?.data ?? []).map((cp) => ({ value: cp.userId, label: cp.name, raw: cp })));
        }).catch(() => callback([]));
    };

    const loadQuotationOptions = (inputValue, callback) => {
        if (!companyId) return callback([]);
        fetch("/relayapi", {
            method: "POST",
            headers: { ...authHeaders(), endpoint: "quotation-list", module: "quotation", "Content-Type": "application/json" },
            body: JSON.stringify({
                page: 1, limit: 20,
                filters: [
                    { key: "companyId", value: String(companyId), operator: "eq" },
                    { key: "status", value: "CONFIRMED", operator: "eq" },
                    ...(inputValue ? [{ key: "quotationCode", value: inputValue, operator: "like" }] : []),
                ],
            }),
        }).then(res => res.json()).then(payload => {
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            callback((data?.data ?? []).map((q) => ({
                value: q.quotationId,
                label: q.customerName ? `${q.quotationCode} (${q.customerName})` : q.quotationCode,
                raw: q
            })));
        }).catch(() => callback([]));
    };

    const handleQuotationChange = (selected) => {
        if (!selected) {
            setFormData({
                sourceQuotationId: "", sourceQuotationLabel: "",
                customerId: "", customerLabel: "",
                currencyId: "", currencyCode: "", currencySymbol: "", currencyConversionRate: 1,
                contactPersonId: "", contactPersonLabel: "",
                orderDate: "", deliveryDate: "",
                businessTerms: "", paymentType: "",
                deliveryTerms: "",
                discountApplicable: "",
                shippingState: "", billingState: "", deliveryState: "",
                deliveryType: "", invoiceGenerationOn: "", invoiceAutoApproval: "NO",
                bankBookId: "", bankBookLabel: "",
                placeOfSupply: "", vatWithheld: "NO",
                salesPersonId: "", salesPersonLabel: "",
                remarks: "", termsConditionsId: null, termsConditionsText: "",
            });
            setItems([newEmptyItem()]);
            setOrderDiscounts([]);
            setOrderExtraCharges([]);
            setLockedCustomer(false);
            return;
        }
        loadQuotationIntoForm(selected.value, false);
    };

    const loadCustomerOptions = (inputValue, callback) => {
        if (!companyId) return callback([]);
        fetch("/relayapi", {
            method: "POST",
            headers: { ...authHeaders(), endpoint: "customer-list", module: "customer", "Content-Type": "application/json" },
            body: JSON.stringify({
                page: 1, limit: 20,
                filters: [
                    { key: "companyId", value: String(companyId), operator: "eq" },
                    ...(inputValue ? [{ key: "customerName", value: inputValue, operator: "like" }] : []),
                ],
            }),
        }).then(res => res.json()).then(payload => {
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            callback((data?.data ?? []).map((c) => ({ value: c.customerId, label: c.customerName, raw: c })));
        }).catch(() => callback([]));
    };

    const handleCustomerChange = async (selected) => {
        if (!selected) {
            setFormData(prev => ({
                ...prev, customerId: "", customerLabel: "",
                currencyId: "", currencyCode: "", currencySymbol: "", currencyConversionRate: 1,
                contactPersonId: "", contactPersonLabel: "",
                bankBookId: "", bankBookLabel: "",
            }));
            setCurrencies([]);
            setItems((prevItems) => prevItems.map((it) => computeItem({ ...it, unitPrice: 0 })));
            return;
        }

        const custId = selected.customerId ?? selected.value ?? selected.id;
        const custName = selected.customerName ?? selected.label ?? "";

        setFormData(prev => ({
            ...prev,
            customerId: custId ? String(custId) : "", customerLabel: custName,
            currencyId: "", currencyCode: "", currencySymbol: "", currencyConversionRate: 1,
            contactPersonId: "", contactPersonLabel: "",
            bankBookId: "", bankBookLabel: "",
        }));
        setErrors(prev => ({ ...prev, customerId: null, currencyId: null, bankBookId: null }));

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
        const cur = currencies.find((c) => String(c.curId ?? c.currencyId) === String(curId));
        const rate = parseFloat(cur?.conversionRate) || 1;

        setFormData((prev) => {
            const currentBb = bankBooks.find((b) => String(b.bankBookId ?? b.value) === String(prev.bankBookId));
            const isBbValid = currentBb && String(currentBb.currencyId) === String(curId);
            return {
                ...prev,
                currencyId: String(curId),
                currencyCode: cur?.code ?? "",
                currencySymbol: cur?.symbol ?? "",
                currencyConversionRate: rate,
                bankBookId: isBbValid ? prev.bankBookId : "",
                bankBookLabel: isBbValid ? prev.bankBookLabel : "",
            };
        });
        if (errors.currencyId) setErrors((prev) => ({ ...prev, currencyId: null }));
        if (errors.bankBookId) setErrors((prev) => ({ ...prev, bankBookId: null }));

        setItems((prevItems) =>
            prevItems.map((it) => {
                const cost = parseFloat(it.item?.convertedCostPerUnit) || parseFloat(it.item?.costPerUnit) || 0;
                const newBase = rate > 0 ? cost / rate : 0;
                return computeItem({ ...it, baseCurrencyPrice: newBase, unitPrice: newBase });
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
                    body: JSON.stringify({
                        page: 1, limit: 100,
                        filters: [{ key: "companyId", value: String(companyId), operator: "eq" }],
                    }),
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                setBankBooks(data?.data ?? []);
            } catch {
                setBankBooks([]);
            }
        })();
    }, [companyId]);

    const loadSalesPersonOptions = loadContactPersonOptions;

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
        if (result.isConfirmed) router.push("/order-list");
    };

    const handleSubmit = async (status) => {
        const payloadToValidate = { ...formData, items };
        const parseRes = OrderFormSchema.safeParse(payloadToValidate);
        if (!parseRes.success) {
            const fieldErrors = {};
            parseRes.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
            });
            setErrors(fieldErrors);
            // toast.error("Please resolve the validation errors before proceeding.", { position: "top-right" });
            return;
        }

        setErrors({});

        if (status === "PLACED") {
            const confirm = await MySwal.fire({
                title: "Submit Order?",
                text: "This will submit the order and lock Customer/Currency.",
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
            fd.append("contactPersonId", formData.contactPersonId);
            fd.append("orderDate", formData.orderDate);
            fd.append("deliveryDate", formData.deliveryDate);
            fd.append("businessTerms", formData.businessTerms);
            fd.append("paymentType", formData.paymentType);
            if (formData.deliveryTerms) fd.append("deliveryTerms", formData.deliveryTerms);
            fd.append("discountApplicable", formData.discountApplicable);
            fd.append("shippingState", formData.shippingState);
            fd.append("billingState", formData.billingState);
            fd.append("deliveryState", formData.deliveryState);
            fd.append("deliveryType", formData.deliveryType);
            fd.append("invoiceGenerationOn", formData.invoiceGenerationOn);
            fd.append("invoiceAutoApproval", formData.invoiceAutoApproval);
            fd.append("companyId", String(companyId));
            fd.append("status", status);
            fd.append("vatWithheld", formData.vatWithheld);
            fd.append("currencyConversionRate", String(formData.currencyConversionRate));
            fd.append("bankBookId", formData.bankBookId);
            fd.append("salesPersonId", formData.salesPersonId);
            if (formData.placeOfSupply) fd.append("placeOfSupply", formData.placeOfSupply);
            if (formData.remarks) fd.append("remarks", formData.remarks);
            if (formData.termsConditionsId) fd.append("termsConditionsId", String(formData.termsConditionsId));
            if (formData.termsConditionsText) fd.append("termsConditionsText", formData.termsConditionsText);
            if (formData.parentOrderId) fd.append("parentOrderId", String(formData.parentOrderId));
            if (formData.sourceQuotationId) fd.append("sourceQuotationId", formData.sourceQuotationId);
            if (formData.customerId) fd.append("customerId", formData.customerId);

            const itemsPayload = items.map((it) => {
                const rawId = it.itemId;
                const validItemId = (rawId !== "" && rawId !== null && rawId !== undefined && !isNaN(Number(rawId)) && Number(rawId) > 0) ? Number(rawId) : undefined;
                return {
                    itemId: validItemId,
                    itemGL: it.itemGL || undefined,
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
            fd.append("orderItems", JSON.stringify(itemsPayload));

            const orderDiscPayload = orderDiscounts.map((d) => ({
                discountDescription: d.discountDescription || d.description || "",
                discountPrice: parseFloat(d.discountPrice ?? d.amount) || 0,
            }));
            fd.append("orderDiscounts", JSON.stringify(orderDiscPayload));

            const orderECPayload = orderExtraCharges.map((ec) => ({
                extraChargesDescription: ec.extraChargesDescription || ec.extraChargeDescription || ec.description || "",
                extraChargesPrice: parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0,
            }));
            fd.append("orderExtraCharges", JSON.stringify(orderECPayload));

            if (termsConditionsFile) fd.append("termsConditionsFile", termsConditionsFile);
            selectedFiles.forEach((f) => fd.append("attachments", f));

            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { endpoint: "order-add", module: "order" },
                body: fd,
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1 || data?.status === true) {
                toast.success("Order created successfully", { position: "top-right" });
                router.push("/order-list");
            } else {
                toast.error(data?.message || "Failed to create.", { position: "top-right" });
            }
        } catch (error) {
            toast.error(error.message || "Request failed", { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    if (prefillState === "loading") {
        return (
            <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
                <Header page="add-order" />
                <div className="flex-1 flex justify-center py-20"><Loader label="Loading..." /></div>
            </div>
        );
    }

    if (prefillState === "denied") return null;

    const bankOptionsForCurrency = formData.currencyId
        ? bankBooks.filter((b) => b.currencyId === formData.currencyId)
        : bankBooks;

    const InputLabel = ({ label, required, error }) => (
        <label className="mb-1 block text-sm font-semibold text-gray-700">
            {label} {required && <span className="text-red-500">*</span>}
            {error && <span className="ml-2 text-xs font-medium text-red-500">{error}</span>}
        </label>
    );

    return (
        <div className="min-h-screen bg-[#f5f6fa] flex flex-col">
            <Header page="add-order" />

            <div className="px-6 pt-4">
                <nav className="flex items-center space-x-2 text-sm font-medium text-gray-500">
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/")}>Home</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="cursor-pointer hover:text-blue-600" onClick={() => router.push("/order-list")}>Orders</span>
                    <span className="text-gray-400">{">>"}</span>
                    <span className="text-gray-800">
                        Order
                    </span>
                </nav>
            </div>

            <div className="flex-1 px-6 py-4 pb-24 space-y-5">
                {/* <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                        <h3 className="text-base font-semibold text-gray-800">Quotation</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Quotation Number
                            </label>
                            <AsyncSelect
                                instanceId="quotation-select"
                                cacheOptions
                                defaultOptions
                                loadOptions={loadQuotationOptions}
                                value={formData.sourceQuotationId ? { value: formData.sourceQuotationId, label: formData.sourceQuotationLabel } : null}
                                onChange={handleQuotationChange}
                                placeholder="Search quotation..."
                                isClearable
                                isDisabled={!!quotationId}
                                classNamePrefix="react-select"
                                styles={{
                                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                    control: (base) => ({
                                        ...base,
                                        borderRadius: "0.75rem",
                                        borderColor: "#d1d5db",
                                        padding: "1px",
                                        fontSize: "0.875rem",
                                        boxShadow: "none",
                                        "&:hover": { borderColor: "#3b82f6" },
                                    }),
                                }}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                        </div>
                    </div>
                </div> */}

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
                                    onChange={handleCustomerChange}
                                    placeholder="Search customer..."
                                    isClearable
                                    isDisabled={lockedCustomer}
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
                                disabled={!formData.customerId || currencies.length === 0 || lockedCustomer}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${errors.currencyId ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            >
                                <option value="">{formData.customerId ? "-- Select currency --" : "Select customer first"}</option>
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
                                Contact Person <span className="text-red-500">*</span>
                            </label>
                            <AsyncSelect
                                instanceId="contact-person-select"
                                cacheOptions
                                // defaultOptions
                                loadOptions={loadContactPersonOptions}
                                value={formData.contactPersonId ? { value: formData.contactPersonId, label: formData.contactPersonLabel } : null}
                                onChange={(selected) => {
                                    setFormField("contactPersonId", selected?.value ?? "");
                                    setFormField("contactPersonLabel", selected?.label ?? "");
                                }}
                                placeholder="Select contact..."
                                isClearable
                                classNamePrefix="react-select"
                                styles={{
                                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                    control: (base) => ({
                                        ...base,
                                        borderRadius: "0.75rem",
                                        borderColor: errors.contactPersonId ? "#ef4444" : "#d1d5db",
                                        padding: "1px",
                                        fontSize: "0.875rem",
                                        boxShadow: "none",
                                        "&:hover": { borderColor: errors.contactPersonId ? "#ef4444" : "#3b82f6" },
                                    }),
                                }}
                                menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                            />
                            {errors.contactPersonId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.contactPersonId}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Order Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.orderDate}
                                onChange={(e) => setFormField("orderDate", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 cursor-pointer ${errors.orderDate ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                            />
                            {errors.orderDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.orderDate}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Delivery Date
                            </label>
                            <input
                                type="date"
                                value={formData.deliveryDate}
                                min={formData.orderDate}
                                onChange={(e) => setFormField("deliveryDate", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 cursor-pointer ${errors.deliveryDate ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                            />
                            {errors.deliveryDate && <p className="text-red-500 text-xs mt-1 font-medium">{errors.deliveryDate}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Business Terms <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.businessTerms}
                                onChange={(e) => setFormField("businessTerms", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer ${errors.businessTerms ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            >
                                <option value="">-- Select --</option>
                                <option value="TWELVE_DAYS">12 Days</option>
                                <option value="FIVE_DAYS">5 Days</option>
                                <option value="SEVEN_DAYS">7 Days</option>
                                <option value="CASH_IN_ADVANCE">Cash In Advance</option>
                                <option value="CASH_NEXT_DELIVERY">Cash Next Delivery</option>
                            </select>
                            {errors.businessTerms && <p className="text-red-500 text-xs mt-1 font-medium">{errors.businessTerms}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Payment Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.paymentType}
                                onChange={(e) => setFormField("paymentType", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer ${errors.paymentType ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            >
                                <option value="">-- Select --</option>
                                <option value="CREDIT">Credit</option>
                                <option value="CASH">Cash</option>
                            </select>
                            {errors.paymentType && <p className="text-red-500 text-xs mt-1 font-medium">{errors.paymentType}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Delivery Terms
                            </label>
                            <input
                                type="text"
                                value={formData.deliveryTerms}
                                onChange={(e) => setFormField("deliveryTerms", e.target.value)}
                                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                            />
                            {errors.deliveryTerms && <p className="text-red-500 text-xs mt-1 font-medium">{errors.deliveryTerms}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Discount Applicable <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.discountApplicable}
                                onChange={(e) => setFormField("discountApplicable", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer ${errors.discountApplicable ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            >
                                <option value="">-- Select --</option>
                                <option value="ON_EACH_DELIVERY">On Each Delivery</option>
                                <option value="ON_LAST_DELIVERY">On Last Delivery</option>
                            </select>
                            {errors.discountApplicable && <p className="text-red-500 text-xs mt-1 font-medium">{errors.discountApplicable}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Shipping Address <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.shippingState}
                                onChange={(e) => setFormField("shippingState", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer ${errors.shippingState ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            >
                                <option value="">-- Select --</option>
                                {countries.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                            {errors.shippingState && <p className="text-red-500 text-xs mt-1 font-medium">{errors.shippingState}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Billing Address <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.billingState}
                                onChange={(e) => setFormField("billingState", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer ${errors.billingState ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            >
                                <option value="">-- Select --</option>
                                {countries.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                            {errors.billingState && <p className="text-red-500 text-xs mt-1 font-medium">{errors.billingState}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Place Of Delivery <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.deliveryState}
                                onChange={(e) => setFormField("deliveryState", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer ${errors.deliveryState ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            >
                                <option value="">-- Select --</option>
                                {countries.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                            {errors.deliveryState && <p className="text-red-500 text-xs mt-1 font-medium">{errors.deliveryState}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Delivery Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.deliveryType}
                                onChange={(e) => setFormField("deliveryType", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer ${errors.deliveryType ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            >
                                <option value="">-- Select --</option>
                                <option value="LOCAL">Local Delivery</option>
                                <option value="INTERSTATE">Interstate</option>
                                <option value="INTERNATIONAL">International</option>
                            </select>
                            {errors.deliveryType && <p className="text-red-500 text-xs mt-1 font-medium">{errors.deliveryType}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Invoice Generation On <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.invoiceGenerationOn}
                                onChange={(e) => setFormField("invoiceGenerationOn", e.target.value)}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer ${errors.invoiceGenerationOn ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                            >
                                <option value="">-- Select --</option>
                                <option value="ORDER_LEVEL">Order Level</option>
                                <option value="DELIVERY_LEVEL">Delivery Level</option>
                            </select>
                            {errors.invoiceGenerationOn && <p className="text-red-500 text-xs mt-1 font-medium">{errors.invoiceGenerationOn}</p>}
                        </div>
                    </div>
                </div>

                <div>
                    <OrderItemsTable
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
                                                        const bb = bankBooks.find((b) => String(b.bankBookId ?? b.value) === e.target.value);
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            bankBookId: e.target.value,
                                                            bankBookLabel: bb?.accountNumber ?? bb?.bankBookName ?? "",
                                                        }));
                                                        if (errors.bankBookId) setErrors((prev) => ({ ...prev, bankBookId: null }));
                                                    }}
                                                    disabled={!formData.currencyId || filteredBankBooks.length === 0}
                                                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${errors.bankBookId ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                                                >
                                                    <option value="">
                                                        {formData.currencyId ? "-- Select bank account --" : "Select currency first"}
                                                    </option>
                                                    {filteredBankBooks.map((bb, bbIdx) => {
                                                        const baseName = bb.bankBookName || (bb.accountNumber ? `${bb.accountNumber}${bb.bankName ? ` — ${bb.bankName}` : ""}` : `Bank Account #${bb.bankBookId ?? bb.value}`);
                                                        const currencyStr = bb.currencyCode || bb.currency?.code || currencies.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.curCode || currencies.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.currencyCode || currencies.find((c) => String(c.curId ?? c.currencyId ?? c.id) === String(bb.currencyId))?.code || "";
                                                        const labelText = currencyStr ? `${baseName} (${currencyStr})` : baseName;
                                                        return (
                                                            <option key={bb.bankBookId ?? bb.value ?? `bb-${bbIdx}`} value={bb.bankBookId ?? bb.value}>
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
                                        Place Of Supply
                                    </label>
                                    <select
                                        value={formData.placeOfSupply}
                                        onChange={(e) => setFormField("placeOfSupply", e.target.value)}
                                        className={`w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 cursor-pointer ${errors.placeOfSupply ? "border-red-500" : "border-gray-300"}`}
                                    >
                                        <option value="">-- Select --</option>
                                        <option value="John Martin - Lagos">John Martin - Lagos</option>
                                        <option value="Steve - Lagos">Steve - Lagos</option>
                                        <option value="MRS Oil Gas - Baner">MRS Oil Gas - Baner</option>
                                    </select>
                                    {errors.placeOfSupply && <p className="text-red-500 text-xs mt-1 font-medium">{errors.placeOfSupply}</p>}
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
                                        Invoice Auto Approval <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.invoiceAutoApproval}
                                        onChange={(e) => setFormField("invoiceAutoApproval", e.target.value)}
                                        className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none cursor-pointer ${errors.invoiceAutoApproval ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-blue-500"}`}
                                    >
                                        <option value="NO">No</option>
                                        <option value="YES">Yes</option>
                                    </select>
                                    {errors.invoiceAutoApproval && <p className="text-red-500 text-xs mt-1 font-medium">{errors.invoiceAutoApproval}</p>}
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
                                            setFormField("salesPersonId", selected?.value ?? "");
                                            setFormField("salesPersonLabel", selected?.label ?? "");
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
                        <OrderSummaryPanel
                            items={items}
                            orderDiscounts={orderDiscounts}
                            orderExtraCharges={orderExtraCharges}
                            vatWithheld={formData.vatWithheld}
                            currencyCode={formData.currencyCode}
                            currencySymbol={formData.currencySymbol}
                            onDiscountsChange={setOrderDiscounts}
                            onExtraChargesChange={setOrderExtraCharges}
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
                    disabled={loading}
                    className="rounded-xl border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
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
                    onClick={() => handleSubmit("PLACED")}
                    disabled={loading}
                    className="rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                >
                    {loading ? "Saving..." : "Save"}
                </button>
            </div>
        </div>
    );
}
