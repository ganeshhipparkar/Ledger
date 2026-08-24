export const uomSidePanelConfig = {
    title: "UOM Details",
    fetchEndpoint: "uom-details",
    module: "uom",
    idKey: "uomId",
    nameKey: "uomName",
    subtitleKey: "uomCode",
    statusKey: "status",
    initialsPrefix: "UM",
    detailsRoute: "/uom/{id}",

    sections: [
        {
            title: "UOM Info",
            fields: [
                { label: "UOM Code", type: "text", key: "uomCode" },
                { label: "UOM Name", type: "text", key: "uomName" },
                { label: "Abbreviation", type: "text", key: "abbreviation" },
                { label: "ISO Code", type: "text", key: "isoCode" },
                {
                    label: "Company",
                    type: "linked-company",
                    companyIdKey: "companyId",
                    companyNameKey: "companyName",
                    companyFallbackPath: "company.companyName",
                },
                { label: "Status", type: "text", key: "status" },
            ],
        },
        {
            title: "Audit",
            fields: [
                { label: "Added By", type: "text", key: "addedByName" },
                { label: "Added Date", type: "date", key: "addedDate" },
                { label: "Updated By", type: "text", key: "updatedByName" },
                { label: "Updated Date", type: "date", key: "updatedDate" },
            ],
        },
    ],
};
