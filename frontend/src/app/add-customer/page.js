import CustomerFormPage from "@/components/customer/CustomerFormPage";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Add Customer | Dashboard",
    description: "Create a new customer.",
};

export default function AddCustomerPage() {
    return (
        <RouteGuard permission="customerAdd">
            <CustomerFormPage context="customer-add" />
        </RouteGuard>
    );
}
