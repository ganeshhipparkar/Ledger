import { Suspense } from "react";
import { redirect } from "next/navigation";
import AddCreditNote from "@/components/creditNote/AddCreditNote";
import RouteGuard from "@/components/RouteGuard";
import Loader from "@/components/ui/Loader";
import { getCreditNoteMode } from "@/lib/creditNoteMode";

export const metadata = {
    title: "Add Credit Note",
    description: "Create a new credit note for an invoice.",
};

export default function AddCreditNotePage() {
    if (getCreditNoteMode() !== "INVOICE") {
        redirect("/credit-note-list");
    }

    return (
        <RouteGuard permission="creditNoteAdd">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader /></div>}>
                <AddCreditNote />
            </Suspense>
        </RouteGuard>
    );
}
