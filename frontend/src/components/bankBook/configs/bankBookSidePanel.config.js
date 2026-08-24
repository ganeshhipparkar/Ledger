/**
 * Config for the Bank Book read-only preview side panel.
 * Used by DetailsSidePanel in BankBookList.jsx.
 *
 * Currency display: "<code> (<symbol>)" or just "<code>" — uses currency-display renderer.
 * Bank Name falls back to bankBook.bank?.bankName when bankBook.bankName is absent —
 * expressed via companyFallbackPath-style "bankFallbackPath" but we use a text renderer
 * with a dual-key helper instead. Since DetailsSidePanel's "text" renderer only reads a
 * single key, we store the pre-resolved bank name via the key "bankName" (the API already
 * sets this at the top level); companyFallbackPath handles the rare nested case via the
 * linked-company renderer. For bankName we use a dedicated "text-fallback" type so the
 * generic renderer can try the primary key then the dotted fallback path.
 */
export const bankBookSidePanelConfig = {
    title: "Bank Book Details",
    fetchEndpoint: "bank-book-details",
    module: "bank-book",
    idKey: "bankBookId",
    nameKey: "bankBookName",
    subtitleKey: "bankBookCode",
    statusKey: "status",
    initialsPrefix: "BB",
    detailsRoute: "/bank-book/{id}",

    sections: [
        {
            title: "Bank Book Information",
            fields: [
                { label: "Bank Book Code",   type: "text", key: "bankBookCode" },
                { label: "Bank Book Name",   type: "text", key: "bankBookName" },
                { label: "Beneficiary Name", type: "text", key: "beneficiaryName" },
                {
                    label: "Bank Name",
                    type: "text-fallback",
                    key: "bankName",
                    fallbackPath: "bank.bankName",
                },
                {
                    label: "Company",
                    type: "linked-company",
                    companyIdKey: "companyId",
                    companyNameKey: "companyName",
                    companyFallbackPath: "company.companyName",
                },
                {
                    label: "Currency",
                    type: "currency-display",
                    currencyCodeKey: "currencyCode",
                    currencySymbolKey: "currencySymbol",
                },
            ],
        },
        {
            title: "Account Details",
            fields: [
                { label: "Account Number", type: "text", key: "accountNumber" },
                { label: "Branch Name",    type: "text", key: "branchName" },
                { label: "Status",         type: "text", key: "status" },
                { label: "Remarks",        type: "text", key: "remarks" },
            ],
        },
        {
            title: "Audit Information",
            fields: [
                { label: "Added By",     type: "text", key: "addedByName" },
                { label: "Added Date",   type: "date", key: "addedDate" },
                { label: "Updated By",   type: "text", key: "updatedByName" },
                { label: "Updated Date", type: "date", key: "updatedDate" },
            ],
        },
    ],
};
