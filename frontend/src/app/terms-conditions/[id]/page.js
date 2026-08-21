import TermsConditionsDetails from "@/components/termsConditions/TermsConditionsDetails";
import RouteGuard from "@/components/RouteGuard";

export default async function TermsConditionsDetailsPage({ params }) {
    const { id } = await params;
    return (
        <RouteGuard permission="termsConditionsView">
            <TermsConditionsDetails id={id} />
        </RouteGuard>
    );
}
