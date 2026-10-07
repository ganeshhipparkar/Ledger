import AddDebitNote from "@/components/debitNote/AddDebitNote";
import RouteGuard from "@/components/RouteGuard";
import { Suspense } from "react";

export const metadata = {
    title: "Add Debit Note",
};

export default function Page() {
    return (
        <RouteGuard permission="debitNoteAdd">
            <Suspense fallback={<div>Loading...</div>}>
                <AddDebitNote />
            </Suspense>
        </RouteGuard>
    );
}
