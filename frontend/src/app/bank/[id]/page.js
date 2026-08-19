import BankDetails from "@/components/bank/BankDetails";
import RouteGuard from "@/components/RouteGuard";

export default async function BankDetailsPage({ params }) {
    const { id } = await params;
    return (
        <RouteGuard permission="bankView">
            <BankDetails id={id} />
        </RouteGuard>
    );
}
