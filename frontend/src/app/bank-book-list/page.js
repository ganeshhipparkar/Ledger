import BankBookList from "@/components/bankBook/BankBookList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Bank Books | Dashboard",
    description: "Manage bank books for your company.",
};

export default function BankBookListPage() {
    return (
        <RouteGuard permission="bankBookList">
            <BankBookList />
        </RouteGuard>
    );
}
