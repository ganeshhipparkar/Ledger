import TermsConditionsList from "@/components/termsConditions/TermsConditionsList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Terms & Conditions | Dashboard",
    description: "Manage terms & conditions for your company.",
};

export default function TermsConditionsListPage() {
    return (
        <RouteGuard permission="termsConditionsList">
            <TermsConditionsList />
        </RouteGuard>
    );
}
