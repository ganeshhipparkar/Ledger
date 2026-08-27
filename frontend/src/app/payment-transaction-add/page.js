import AddPaymentTransaction from "@/components/paymentTransaction/AddPaymentTransaction";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Add Payment Transaction | Dashboard",
    description: "Add a new payment transaction.",
};

export default function AddPaymentTransactionPage() {
    return (
        <RouteGuard permission="paymentTransactionAdd">
            <AddPaymentTransaction />
        </RouteGuard>
    );
}
