export const packageSidePanelConfig = {
    title: "Package Details",
    fetchEndpoint: "package-details",
    module: "package",
    idKey: "packageId",
    nameKey: "packageName",
    subtitleKey: "packageCode",
    statusKey: "status",
    initialsPrefix: "PK",
    detailsRoute: "/package/{id}",

    sections: [
        {
            title: "Package Info",
            fields: [
                { label: "Package Code", type: "text", key: "packageCode" },
                { label: "Package Name", type: "text", key: "packageName" },
                { label: "Description", type: "text", key: "description" },
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
