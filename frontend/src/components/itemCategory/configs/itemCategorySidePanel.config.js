export const itemCategorySidePanelConfig = {
    title: "Item Category Details",
    fetchEndpoint: "item-category-details",
    module: "item-category",
    idKey: "itemCategoryId",
    nameKey: "itemCategoryName",
    subtitleKey: "itemCategoryCode",
    statusKey: "status",
    initialsPrefix: "IC",
    detailsRoute: "/item-category/{id}",

    sections: [
        {
            title: "Category Info",
            fields: [
                { label: "Category Code", type: "text", key: "itemCategoryCode" },
                { label: "Category Name", type: "text", key: "itemCategoryName" },
                {
                    label: "Parent Category",
                    type: "linked-record",
                    labelKey: "parentCategoryName",
                    idKey: "parentCategoryId",
                    permissionKey: "itemCategoryView",
                },
                {
                    label: "Company",
                    type: "linked-company",
                    companyIdKey: "companyId",
                    companyNameKey: "companyName",
                    companyFallbackPath: "company.companyName",
                },
                { label: "Type", type: "text", key: "type" },
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
