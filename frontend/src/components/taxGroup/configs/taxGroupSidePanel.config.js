/**
 * Config for the Tax Group read-only preview side panel.
 * Used by DetailsSidePanel in TaxGroupList.jsx.
 */
export const taxGroupSidePanelConfig = {
    title: "Tax Group Details",
    fetchEndpoint: "tax-group-details",
    module: "tax-group",
    idKey: "taxId",
    nameKey: "taxName",
    subtitleKey: "taxCode",
    initialsPrefix: "TG",
    detailsRoute: "/tax-group/{id}",

    sections: [
        {
            title: "Tax Group Info",
            fields: [
                { label: "Tax Name", type: "text", key: "taxName" },
                { label: "Tax Code", type: "text", key: "taxCode" },
                { label: "Tax Value (%)", type: "text", key: "taxValue" },
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
