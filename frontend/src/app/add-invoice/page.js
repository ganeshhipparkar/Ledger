import { Suspense } from "react";
import AddInvoice from "@/components/invoice/AddInvoice";
import RouteGuard from "@/components/RouteGuard";
import Loader from "@/components/ui/Loader";

export const metadata = {
    title: "Add Invoice",
    description: "Create a new sales invoice.",
};

export default function AddInvoicePage() {
    return (
        <RouteGuard permission="invoiceAdd">
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader /></div>}>
                <AddInvoice />
            </Suspense>
        </RouteGuard>
    );
}
