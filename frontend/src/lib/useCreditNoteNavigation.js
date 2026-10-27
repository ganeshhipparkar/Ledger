import { getCreditNoteMode } from "@/lib/creditNoteMode";

export function handleCreditNoteAddNavigation({ router, setShowAddPanel, invoice, customer }) {
    const mode = getCreditNoteMode();
    if (mode === "INVOICE") {
        if (invoice) {
            router.push(`/add-credit-note?invoiceId=${invoice.invoiceId}`);
        } else if (customer) {
            router.push(`/add-credit-note?customerId=${customer.customerId}`);
        } else {
            router.push("/add-credit-note");
        }
    } else {
        if (setShowAddPanel) setShowAddPanel(invoice || customer || true);
    }
}
