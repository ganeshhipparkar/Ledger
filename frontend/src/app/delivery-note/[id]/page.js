"use client";

import RouteGuard from "@/components/RouteGuard";
import DeliveryNoteDetails from "@/components/deliveryNote/DeliveryNoteDetails";
import { use, Suspense } from "react";

function DeliveryNotePageContent({ id }) {
    return (
        <RouteGuard permission="deliveryNoteView">
            <DeliveryNoteDetails id={id} />
        </RouteGuard>
    );
}

export default function DeliveryNotePage({ params }) {
    const unwrappedParams = use(params);

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DeliveryNotePageContent id={unwrappedParams.id} />
        </Suspense>
    );
}
