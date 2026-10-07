import DebitNoteList from "@/components/debitNote/DebitNoteList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Debit Notes",
    description: "Browse and manage all credit notes.",
};

export default function DebitNoteListPage() {
    return (
        <RouteGuard permission="debitNoteList">
            <DebitNoteList />
        </RouteGuard>
    );
}
