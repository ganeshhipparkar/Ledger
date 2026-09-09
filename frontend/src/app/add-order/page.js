import AddOrder from "@/components/order/AddOrder";
import RouteGuard from "@/components/RouteGuard";
import { Suspense } from "react";

export const metadata = {
    title: "Add Order - Ledger",
};

export default function AddOrderPage() {
    return (
        <RouteGuard permission="orderAdd">
            <Suspense fallback={<div>Loading order form...</div>}>
                <AddOrder />
            </Suspense>
        </RouteGuard>
    );
}
