
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
                { label: "Bank Book Code", type: "text", key: "bankBookCode" },
                { label: "Bank Book Name", type: "text", key: "bankBookName" },
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
                { label: "Branch Name", type: "text", key: "branchName" },
                { label: "Status", type: "text", key: "status" },
                { label: "Remarks", type: "text", key: "remarks" },
            ],
        },

    ],
};
