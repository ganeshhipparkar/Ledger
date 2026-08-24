/**
 * Config for the Bank read-only preview side panel.
 * Used by DetailsSidePanel in BankList.jsx.
 */
export const bankSidePanelConfig = {
    title: "Bank Details",
    fetchEndpoint: "bank-details",
    module: "bank",
    idKey: "bankId",
    nameKey: "bankName",
    subtitleKey: "bankCode",
    statusKey: "status",
    initialsPrefix: "BK",
    detailsRoute: "/bank/{id}",

    sections: [
        {
            title: "Bank Info",
            fields: [
                { label: "Bank Code", type: "text", key: "bankCode" },
                { label: "Bank Name", type: "text", key: "bankName" },
                {
                    label: "Company",
                    type: "linked-company",
                    companyIdKey: "companyId",
                    companyNameKey: "companyName",
                    companyFallbackPath: "company.companyName",
                },
                { label: "Remarks", type: "text", key: "remarks" },
                { label: "Status",  type: "text", key: "status" },
            ],
        },
        {
            title: "Audit",
            fields: [
                { label: "Added By",     type: "text", key: "addedByName" },
                { label: "Added Date",   type: "date", key: "addedDate" },
                { label: "Updated By",   type: "text", key: "updatedByName" },
                { label: "Updated Date", type: "date", key: "updatedDate" },
            ],
        },
    ],
};
