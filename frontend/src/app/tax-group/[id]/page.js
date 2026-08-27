import TaxGroupDetails from "@/components/taxGroup/TaxGroupDetails";
import RouteGuard from "@/components/RouteGuard";

export default async function TaxGroupDetailsPage({ params }) {
    const { id } = await params;
    return (
        <RouteGuard permission="taxGroupView">
            <TaxGroupDetails id={id} />
        </RouteGuard>
    );
}
