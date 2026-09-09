/**
 * Config for the Payment Transaction read-only preview side panel.
 * Used by DetailsSidePanel in PaymentTransactionList.jsx.
 */
export const paymentTransactionSidePanelConfig = {
    title: "Payment Transaction Details",
    fetchEndpoint: "payment-transaction-details",
    module: "payment-transaction",
    idKey: "paymentTransactionId",
    nameKey: "narration",
    subtitleKey: "paymentMode",
    initialsPrefix: "PT",
    detailsRoute: "/payment-transaction/{id}",

    sections: [
        {
            title: "Transaction Information",
            fields: [
                {
                    label: "Customer",
                    type: "text-fallback",
                    key: "customerName",
                    fallbackPath: "customer.customerName",
                },
                {
                    label: "Bank Account",
                    type: "text-fallback",
                    key: "bankBookName",
                    fallbackPath: "bankBook.bankBookName",
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
                { label: "Payment Mode", type: "text", key: "paymentMode" },
                { label: "Payment Date", type: "date", key: "paymentDate" },
            ],
        },
        {
            title: "Amounts & Conversion",
            fields: [
                { label: "Transaction Amount", type: "text", key: "transactionAmount" },
                { label: "Exchange Rate", type: "text", key: "exchangeRate" },
                { label: "Exchange Date", type: "date", key: "exchangeDate" },
                { label: "Base Amount", type: "text", key: "baseAmount" },
            ],
        },
        {
            title: "Status & Approval",
            fields: [
                { label: "Status", type: "text", key: "status" },
                { label: "Status Remarks", type: "text", key: "statusRemarks" },
            ],
        },


    ],
};
