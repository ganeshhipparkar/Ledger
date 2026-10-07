"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import RouteGuard from "@/components/RouteGuard";
import DebitNoteDetails from "@/components/debitNote/DebitNoteDetails";
import Loader from "@/components/ui/Loader";

function DebitNotePageInner() {
    const { id } = useParams();
    return <DebitNoteDetails id={id} />;
}

export default function DebitNotePage() {
    return (
        <RouteGuard permission="debitNoteView">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader /></div>}>
                <DebitNotePageInner />
            </Suspense>
        </RouteGuard>
    );
}
