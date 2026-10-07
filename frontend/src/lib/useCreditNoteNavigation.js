import { getCreditNoteMode } from "@/lib/creditNoteMode";

export function handleCreditNoteAddNavigation({ router, setShowAddPanel, invoice }) {
    const mode = getCreditNoteMode();
    if (mode === "INVOICE") {
        router.push(invoice ? `/add-credit-note?invoiceId=${invoice.invoiceId}` : "/add-credit-note");
    } else {
        if (setShowAddPanel) setShowAddPanel(invoice || true);
    }
}
