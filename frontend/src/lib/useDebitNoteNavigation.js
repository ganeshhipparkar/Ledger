import { getCreditNoteMode } from "./creditNoteMode";

export function handleDebitNoteAddNavigation({ router, setShowAddPanel, invoice, customer }) {
    const mode = getCreditNoteMode();
    if (mode === "INVOICE") {
        if (invoice) {
            router.push(`/add-debit-note?invoiceId=${invoice.invoiceId}`);
        } else if (customer) {
            router.push(`/add-debit-note?customerId=${customer.customerId}`);
        } else {
            router.push("/add-debit-note");
        }
    } else {
        if (setShowAddPanel) {
            setShowAddPanel(invoice || customer || true);
        }
    }
}
