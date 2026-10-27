import { Suspense } from "react";
import AddPaymentTransaction from "@/components/paymentTransaction/AddPaymentTransaction";
import RouteGuard from "@/components/RouteGuard";
import Loader from "@/components/ui/Loader";

export const metadata = {
    title: "Add Payment Transaction | Dashboard",
    description: "Add a new payment transaction.",
};

export default function AddPaymentTransactionPage() {
    return (
        <RouteGuard permission="paymentTransactionAdd">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader /></div>}>
                <AddPaymentTransaction />
            </Suspense>
        </RouteGuard>
    );
}
