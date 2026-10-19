import DeliveryNoteList from "@/components/deliveryNote/DeliveryNoteList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Delivery Notes",
    description: "Browse and manage all delivery notes.",
};

export default function DeliveryNoteListPage() {
    return (
        <RouteGuard permission="deliveryNoteList">
            <DeliveryNoteList />
        </RouteGuard>
    );
}
