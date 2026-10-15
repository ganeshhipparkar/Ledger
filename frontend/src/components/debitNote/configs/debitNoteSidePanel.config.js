export const debitNoteSidePanelConfig = {
    title: "Debit Note Details",
    fetchEndpoint: "debit-note-details",
    module: "debit-note",
    idKey: "id",
    nameKey: "debitNoteCode",
    subtitleKey: "customerName",
    statusKey: "status",
    initialsPrefix: "DN",
    detailsRoute: "/debit-note/{id}",

    sections: [
        {
            title: "Debit Note Information",
            fields: [
                {
                    label: "Customer",
                    type: "text-fallback",
                    key: "customerName",
                    fallbackPath: "customer.customerName",
                },
                { label: "Invoice", type: "text", key: "invoiceCode" },
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
                { label: "Customer Charges", type: "text", key: "customerCharges" },
                { label: "Narration", type: "text", key: "narration" },
                { label: "Tax Calculation", type: "text", key: "taxCalculation" },
            ],
        },
        {
            title: "Amounts",
            fields: [
                { label: "Total Amount", type: "text", key: "totalAmount" },
                { label: "Tax Amount", type: "text", key: "taxAmount" },
                { label: "Final Amount", type: "text", key: "finalAmount" },
            ],
        },
        // {
        //     title: "Attachments",
        //     fields: [
        //         { label: "Attachments", type: "attachments", key: "attachments" },
        //     ],
        // },

    ],
};
