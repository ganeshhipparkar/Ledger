import CompanyFormPage from "@/components/company/CompanyFormPage";
import RouteGuard from "@/components/RouteGuard";

export default function AddCompanyPage() {
    return (
        <RouteGuard permission="companyAdd">
            <CompanyFormPage context="company-add" />
        </RouteGuard>
    );
}