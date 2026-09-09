import { Suspense } from "react";
import AddQuotation from "@/components/quotation/AddQuotation";
import RouteGuard from "@/components/RouteGuard";
import Loader from "@/components/ui/Loader";

export const metadata = {
    title: "Add Quotation",
    description: "Create a new sales quotation for a customer.",
};

export default function AddQuotationPage() {
    return (
        <RouteGuard permission="quotationAdd">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader /></div>}>
                <AddQuotation />
            </Suspense>
        </RouteGuard>
    );
}
