"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import RouteGuard from "@/components/RouteGuard";
import CreditNoteDetails from "@/components/creditNote/CreditNoteDetails";
import Loader from "@/components/ui/Loader";

function CreditNotePageInner() {
    const { id } = useParams();
    return <CreditNoteDetails id={id} />;
}

export default function CreditNotePage() {
    return (
        <RouteGuard permission="creditNoteView">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader /></div>}>
                <CreditNotePageInner />
            </Suspense>
        </RouteGuard>
    );
}
