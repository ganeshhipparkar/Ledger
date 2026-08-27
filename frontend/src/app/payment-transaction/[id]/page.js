import PaymentTransactionDetails from "@/components/paymentTransaction/PaymentTransactionDetails";
import RouteGuard from "@/components/RouteGuard";

export default async function PaymentTransactionDetailsPage({ params }) {
    const { id } = await params;
    return (
        <RouteGuard permission="paymentTransactionView">
            <PaymentTransactionDetails id={id} />
        </RouteGuard>
    );
}
