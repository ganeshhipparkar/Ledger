export function getCreditNoteMode() {
    const rawMode = process.env.NEXT_PUBLIC_CREDIT_NOTE;
    const mode = typeof rawMode === "string" ? rawMode.trim().toUpperCase() : "";
    return mode === "INVOICE" ? "INVOICE" : "CUSTOMER";
}
