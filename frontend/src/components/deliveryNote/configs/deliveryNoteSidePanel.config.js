export const deliveryNoteSidePanelConfig = {
    title: "Delivery Note Details",
    fetchEndpoint: "delivery-note-details",
    module: "delivery-note",
    idKey: "deliveryNoteId",
    nameKey: "deliveryNoteCode",
    subtitleKey: "customerName",
    initialsPrefix: "DN",
    detailsRoute: "/delivery-note/{id}",

    sections: [
        {
            title: "Delivery Note Information",
            fields: [
                {
                    label: "Customer",
                    type: "text-fallback",
                    key: "customerName",
                    fallbackPath: "customer.customerName",
                },
                { label: "Order Code", type: "text", key: "orderCode" },
                { label: "Delivery Date", type: "date", key: "deliveryDate" },
                { label: "Receiver Name", type: "text", key: "receiverName" },
                { label: "Billing Address", type: "text", key: "billingAddress" },
                {
                    label: "Company",
                    type: "linked-company",
                    companyIdKey: "companyId",
                    companyNameKey: "companyName",
                    companyFallbackPath: "company.companyName",
                },
            ],
        },
        {
            title: "Audit Info",
            fields: [
                { label: "Added By", type: "text", key: "addedByName" },
                { label: "Added Date", type: "date", key: "addedDate" },
            ],
        },
    ],
};
