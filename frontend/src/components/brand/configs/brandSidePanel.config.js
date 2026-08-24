/**
 * Config for the Brand read-only preview side panel.
 * Used by DetailsSidePanel in BrandList.jsx.
 */
export const brandSidePanelConfig = {
    title: "Brand Details",
    fetchEndpoint: "brand-details",
    module: "brand",
    idKey: "brandId",
    nameKey: "brandName",
    subtitleKey: "brandCode",
    statusKey: "status",
    initialsPrefix: "BR",
    detailsRoute: "/brand/{id}",

    sections: [
        {
            title: "Brand Info",
            fields: [
                { label: "Brand Code", type: "text", key: "brandCode" },
                { label: "Brand Name", type: "text", key: "brandName" },
                {
                    label: "Company",
                    type: "linked-company",
                    companyIdKey: "companyId",
                    companyNameKey: "companyName",
                    companyFallbackPath: "company.companyName",
                },
                { label: "Manufacturer", type: "text", key: "manufacturerName" },
                { label: "Status",       type: "text", key: "status" },
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
