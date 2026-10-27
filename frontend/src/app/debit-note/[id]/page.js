"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import RouteGuard from "@/components/RouteGuard";
import NoteDetails from "@/components/common/NoteDetails";
import { debitNoteViewConfig } from "@/components/debitNote/configs/debitNoteView.config";
import Loader from "@/components/ui/Loader";

function DebitNotePageInner() {
    const { id } = useParams();
    return <NoteDetails id={id} config={debitNoteViewConfig} />;
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
