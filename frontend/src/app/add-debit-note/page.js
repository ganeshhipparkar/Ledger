import { Suspense } from "react";
import { redirect } from "next/navigation";
import NoteInvoiceAddForm from "@/components/notes/NoteInvoiceAddForm";
import RouteGuard from "@/components/RouteGuard";
import Loader from "@/components/ui/Loader";
import { getCreditNoteMode } from "@/lib/creditNoteMode";

export const metadata = {
    title: "Add Debit Note",
    description: "Create a new debit note for an invoice.",
};

export default function AddDebitNotePage() {
    if (getCreditNoteMode() !== "INVOICE") {
        redirect("/debit-note-list");
    }

    return (
        <RouteGuard permission="debitNoteAdd">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader /></div>}>
                <NoteInvoiceAddForm noteType="DEBIT" />
            </Suspense>
        </RouteGuard>
    );
}
