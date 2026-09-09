import QuotationList from "@/components/quotation/QuotationList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Quotations",
    description: "Browse and manage all sales quotations.",
};

export default function QuotationListPage() {
    return (
        <RouteGuard permission="quotationList">
            <QuotationList />
        </RouteGuard>
    );
}
