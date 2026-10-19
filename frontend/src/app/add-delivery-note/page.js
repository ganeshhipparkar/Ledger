import AddDeliveryNote from "@/components/deliveryNote/AddDeliveryNote";
import RouteGuard from "@/components/RouteGuard";
import { Suspense } from "react";

export const metadata = {
    title: "Add Delivery Note",
};

export default function Page() {
    return (
        <RouteGuard permission="deliveryNoteAdd">
            <Suspense fallback={<div>Loading...</div>}>
                <AddDeliveryNote />
            </Suspense>
        </RouteGuard>
    );
}
