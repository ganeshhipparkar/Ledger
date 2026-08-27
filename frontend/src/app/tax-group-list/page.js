import TaxGroupList from "@/components/taxGroup/TaxGroupList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Tax Group | Dashboard",
    description: "Manage tax groups for your company.",
};

export default function TaxGroupListPage() {
    return (
        <RouteGuard permission="taxGroupList">
            <TaxGroupList />
        </RouteGuard>
    );
}
