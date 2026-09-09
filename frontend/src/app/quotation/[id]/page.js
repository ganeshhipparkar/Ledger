"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import RouteGuard from "@/components/RouteGuard";
import QuotationDetails from "@/components/quotation/QuotationDetails";
import QuotationUpdate from "@/components/quotation/quotationUpdate";
import Loader from "@/components/ui/Loader";

function QuotationPageInner() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { id } = params;
    const editMode = searchParams.get("edit") === "true";

    return editMode ? (
        <QuotationUpdate id={id} />
    ) : (
        <QuotationDetails id={id} />
    );
}

export default function QuotationPage() {
    return (
        <RouteGuard permission="quotationView">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader /></div>}>
                <QuotationPageInner />
            </Suspense>
        </RouteGuard>
    );
}
