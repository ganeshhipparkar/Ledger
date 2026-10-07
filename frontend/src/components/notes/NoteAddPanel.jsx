"use client";

import { useContext, useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { toast } from "react-toastify";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { loginContext } from "../hooks/LoginContext";
import NoteFormCore from "./NoteFormCore";
import { CreditNoteFormSchema, DebitNoteFormSchema } from "../Zod";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

const EMPTY_FORM = {
    customerId: "",
    currencyId: "",
    invoiceId: "",
    customerCharges: "",
    narration: "",
    taxCalculation: "NA",
    taxGroupId: "",
    totalAmount: "",
};


export default function NoteAddPanel({
    noteType,
    lockedCustomerId = null,
    lockedCustomerName = null,
    lockedCurrencyId = null,
    lockedCurrencyCode = null,
    lockedInvoiceId = null,
    lockedInvoiceCode = null,
    lockedCompanyId = null,

    onClose,
    onSuccess,
}) {
    const { activeAssignment } = useContext(loginContext) || {};

    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [errors, setErrors] = useState({});

    const [invoices, setInvoices] = useState([]);
    const [taxGroups, setTaxGroups] = useState([]);

    const [formData, setFormData] = useState({
        ...EMPTY_FORM,
        customerId: lockedCustomerId ? String(lockedCustomerId) : "",
        currencyId: lockedCurrencyId ? String(lockedCurrencyId) : "",
        invoiceId: lockedInvoiceId ? String(lockedInvoiceId) : "",
    });

    const config = {
        CREDIT: { endpointPrefix: "credit-note", module: "credit-note", title: "Add Credit Note" },
        DEBIT:  { endpointPrefix: "debit-note",  module: "debit-note",  title: "Add Debit Note"  },
    }[noteType];

    useEffect(() => {
        const t = setTimeout(() => setIsOpen(true), 10);
        return () => clearTimeout(t);
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(() => onClose?.(), 300);
    };


    const fetchTaxGroups = async () => {
        try {
            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { ...authHeaders(), endpoint: "tax-group-list", module: "tax-group", "Content-Type": "application/json" },
                body: JSON.stringify({ page: 1, limit: 500 }),
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setTaxGroups(data?.data ?? []);
        } catch { }
    };

    const fetchInvoicesByCustomer = async (customerId, currencyId) => {
        if (!customerId || !currencyId) { setInvoices([]); return; }
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: { ...authHeaders(), endpoint: `invoices-by-customer/${customerId}/${currencyId}`, module: config.module },
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            setInvoices(data?.data ?? []);
        } catch { }
    };

    useEffect(() => {
        fetchTaxGroups();
    }, []);

    useEffect(() => {
        if (lockedCustomerId === null) {
            fetchInvoicesByCustomer(formData.customerId, formData.currencyId);
        }
    }, [formData.customerId, formData.currencyId, lockedCustomerId]);


    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const effectiveCustomerId = lockedCustomerId ?? formData.customerId;
        const effectiveCurrencyId = lockedCurrencyId ?? formData.currencyId;
        const effectiveInvoiceId = lockedInvoiceId ?? formData.invoiceId;

        const payloadToValidate = {
            ...formData,
            customerId: effectiveCustomerId,
            currencyId: effectiveCurrencyId,
            ...(effectiveInvoiceId ? { invoiceId: effectiveInvoiceId } : {})
        };

        const schema = noteType === "CREDIT" ? CreditNoteFormSchema : DebitNoteFormSchema;
        const parseRes = schema.safeParse(payloadToValidate);
        if (!parseRes.success) {
            const fieldErrors = {};
            parseRes.error.issues.forEach((err) => {
                const field = err.path[0];
                if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
            });
            setErrors(fieldErrors);
            return;
        }

        const confirmRes = await MySwal.fire({
            title: noteType === "CREDIT" ? "Create Credit Note?" : "Create Debit Note?",
            text: noteType === "CREDIT" ? "Are you sure you want to create this credit note?" : "Are you sure you want to create this debit note?",
            icon: "info",
            showCancelButton: true,
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, create it!",
            cancelButtonText: "Cancel",
        });
        if (!confirmRes.isConfirmed) return;

        setLoading(true);
        try {
            const effectiveCompanyId = lockedCompanyId ?? activeAssignment?.companyId;
            if (!effectiveCompanyId) {
                toast.error("No active company found. Please re-login.", { position: "top-right" });
                setLoading(false);
                return;
            }

            const fd = new FormData();
            fd.append("companyId", String(effectiveCompanyId));
            fd.append("customerId", String(effectiveCustomerId));
            fd.append("currencyId", String(effectiveCurrencyId));
            if (effectiveInvoiceId) {
                fd.append("invoiceId", String(effectiveInvoiceId));
            }
            fd.append("customerCharges", formData.customerCharges);
            if (formData.narration?.trim()) fd.append("narration", formData.narration.trim());
            fd.append("taxCalculation", formData.taxCalculation);
            if (formData.taxGroupId) fd.append("taxGroupId", String(formData.taxGroupId));
            fd.append("totalAmount", String(formData.totalAmount));

            for (const file of selectedFiles) fd.append("attachments", file);


            const res = await fetch("/relayapi", {
                method: "POST",
                headers: { endpoint: `${config.endpointPrefix}-add`, module: config.module },
                body: fd,
            });
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (data?.success === 1) {
                toast.success(`${config.title.replace('Add ', '')} created successfully.`, { position: "top-right" });
                handleClose();
                onSuccess?.();
            } else {
                toast.error(data?.message || `Failed to create ${config.title.replace('Add ', '').toLowerCase()}.`, { position: "top-right" });
            }
        } catch (err) {
            toast.error(err.message, { position: "top-right" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div
                className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
                onClick={handleClose}
            />

            <div
                className={`fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
            >
                <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-500" />
                            {config.title}
                        </h2>
                        {lockedInvoiceCode && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                Invoice: <span className="font-medium text-gray-700">{lockedInvoiceCode}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-sm p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <NoteFormCore
                    noteType={noteType}
                    lockedCustomerId={lockedCustomerId}
                    lockedCustomerName={lockedCustomerName}
                    lockedCurrencyId={lockedCurrencyId}
                    lockedCurrencyCode={lockedCurrencyCode}
                    lockedInvoiceId={lockedInvoiceId}
                    lockedInvoiceCode={lockedInvoiceCode}
                    formData={formData}
                    onChange={handleChange}
                    selectedFiles={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    companyId={lockedCompanyId ?? activeAssignment?.companyId}
                    invoices={invoices}
                    taxGroups={taxGroups}
                    loading={loading}
                    onSubmit={handleSubmit}
                    onCancel={handleClose}
                    errors={errors}
                />
            </div>
        </>
    );
}
