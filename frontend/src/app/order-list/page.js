import OrderList from "@/components/order/OrderList";
import RouteGuard from "@/components/RouteGuard";

export const metadata = {
    title: "Orders - Ledger",
};

export default function OrderListPage() {
    return (
        <RouteGuard permission="orderList">
            <OrderList />
        </RouteGuard>
    );
}
