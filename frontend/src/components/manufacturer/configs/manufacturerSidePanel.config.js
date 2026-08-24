export const manufacturerSidePanelConfig = {
    title: "Manufacturer Details",
    fetchEndpoint: "manufacturer-details",
    module: "manufacturer",
    idKey: "manufacturerId",
    nameKey: "manufacturerName",
    subtitleKey: "manufacturerCode",
    statusKey: "status",
    initialsPrefix: "MF",
    detailsRoute: "/manufacturer/{id}",

    sections: [
        {
            title: "Manufacturer Info",
            fields: [
                { label: "Manufacturer Code", type: "text", key: "manufacturerCode" },
                { label: "Manufacturer Name", type: "text", key: "manufacturerName" },
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
