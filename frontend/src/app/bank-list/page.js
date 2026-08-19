import BankList from "@/components/bank/BankList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Banks | Dashboard",
    description: "Manage banks for your company.",
};

export default function BankListPage() {
    return (
        <RouteGuard permission="bankList">
            <BankList />
        </RouteGuard>
    );
}
