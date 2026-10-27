"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import RouteGuard from "@/components/RouteGuard";
import NoteDetails from "@/components/common/NoteDetails";
import { creditNoteViewConfig } from "@/components/creditNote/configs/creditNoteView.config";
import Loader from "@/components/ui/Loader";

function CreditNotePageInner() {
    const { id } = useParams();
    return <NoteDetails id={id} config={creditNoteViewConfig} />;
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
