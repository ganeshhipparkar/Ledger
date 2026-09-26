import RouteGuard from "@/components/RouteGuard";
import AddRole from "@/components/roles/AddRole";

export const metadata = {
    title: "Add Role | Dashboard",
};

export default function AddRolePage() {
    return (
        <RouteGuard permission="groupAdd">
            <AddRole />
        </RouteGuard>
    );
}
