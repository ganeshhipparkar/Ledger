import BankBookDetails from "@/components/bankBook/BankBookDetails";
import RouteGuard from "@/components/RouteGuard";

export default async function BankBookDetailsPage({ params }) {
    const { id } = await params;
    return (
        <RouteGuard permission="bankBookView">
            <BankBookDetails id={id} />
        </RouteGuard>
    );
}
