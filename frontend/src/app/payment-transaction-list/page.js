import PaymentTransactionList from "@/components/paymentTransaction/PaymentTransactionList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Payment Transactions | Dashboard",
    description: "Manage payment transactions for your company.",
};

export default function PaymentTransactionListPage() {
    return (
        <RouteGuard permission="paymentTransactionList">
            <PaymentTransactionList />
        </RouteGuard>
    );
}
