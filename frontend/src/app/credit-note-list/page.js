import CreditNoteList from "@/components/creditNote/CreditNoteList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Credit Notes",
    description: "Browse and manage all credit notes.",
};

export default function CreditNoteListPage() {
    return (
        <RouteGuard permission="creditNoteList">
            <CreditNoteList />
        </RouteGuard>
    );
}
