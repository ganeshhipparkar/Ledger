"use client";

import RouteGuard from "@/components/RouteGuard";
import OrderDetails from "@/components/order/OrderDetails";
import OrderUpdate from "@/components/order/orderUpdate";
import { useSearchParams } from "next/navigation";
import { use, Suspense } from "react";

function OrderPageContent({ id }) {
    const searchParams = useSearchParams();
    const isEdit = searchParams.get("edit") === "true";

    return (
        <RouteGuard permission={isEdit ? "orderUpdate" : "orderView"}>
            {isEdit ? <OrderUpdate id={id} /> : <OrderDetails id={id} />}
        </RouteGuard>
    );
}

export default function OrderPage({ params }) {
    const unwrappedParams = use(params);

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <OrderPageContent id={unwrappedParams.id} />
        </Suspense>
    );
}
