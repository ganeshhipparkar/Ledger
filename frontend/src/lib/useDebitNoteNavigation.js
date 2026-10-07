import { getCreditNoteMode } from "./creditNoteMode";

export function handleDebitNoteAddNavigation({ router, setShowAddPanel, invoice }) {
    const mode = getCreditNoteMode();
    if (mode === "INVOICE") {
        if (invoice) {
            router.push(`/add-debit-note?invoiceId=${invoice.invoiceId}`);
        } else {
            router.push("/add-debit-note");
        }
    } else {
        if (setShowAddPanel) {
            setShowAddPanel(invoice || true);
        }
    }
}
