import PaymentTransactionUpdate from "@/components/paymentTransaction/PaymentTransactionUpdate";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Edit Payment Transaction | Dashboard",
    description: "Edit payment transaction details.",
};

export default async function EditPaymentTransactionPage({ params }) {
    const { id } = await params;
    return (
        <RouteGuard permission="paymentTransactionUpdate">
            <PaymentTransactionUpdate id={id} />
        </RouteGuard>
    );
}
