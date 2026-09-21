import { Suspense } from "react";
import InvoiceList from "@/components/invoice/InvoiceList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Invoices",
    description: "Browse and manage all sales invoices.",
};

export default function InvoiceListPage() {
    return (
        <RouteGuard permission="invoiceList">
            <InvoiceList />
        </RouteGuard>
    );
}
