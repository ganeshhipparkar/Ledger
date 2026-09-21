"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import RouteGuard from "@/components/RouteGuard";
import InvoiceDetails from "@/components/invoice/InvoiceDetails";
import InvoiceUpdate from "@/components/invoice/InvoiceUpdate";
import Loader from "@/components/ui/Loader";

function InvoicePageInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { id } = params;
    const editMode = searchParams.get("edit") === "true";

    return editMode ? (
        <InvoiceUpdate id={id} />
    ) : (
        <InvoiceDetails id={id} />
    );
}

export default function InvoicePage() {
    return (
        <RouteGuard permission="invoiceView">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader /></div>}>
                <InvoicePageInner />
            </Suspense>
        </RouteGuard>
    );
}
