export const creditNoteSidePanelConfig = {
    title: "Credit Note Details",
    fetchEndpoint: "credit-note-details",
    module: "credit-note",
    idKey: "id",
    nameKey: "creditNoteCode",
    subtitleKey: "customerName",
    statusKey: "status",
    initialsPrefix: "CN",
    detailsRoute: "/credit-note/{id}",

    sections: [
        {
            title: "Credit Note Information",
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
                { label: "Issue Date", type: "date", key: "issueDate" },
                { label: "VAT Withheld", type: "text", key: "vatWithheld" },
                { label: "Narration", type: "text", key: "narration" },
                { label: "Remarks", type: "text", key: "remarks" },
            ],
        },
        {
            title: "Amounts",
            fields: [
                { label: "Total Amount", type: "text", key: "totalAmount" },
                { label: "Taxable Amount", type: "text", key: "taxableAmount" },
                { label: "Tax Amount", type: "text", key: "taxAmount" },
                { label: "VAT Withheld Amount", type: "text", key: "vatWithheldAmount" },
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

