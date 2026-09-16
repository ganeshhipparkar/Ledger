export const itemSidePanelConfig = {
    title: "Item Details",
    fetchEndpoint: "item-details",
    module: "item",
    idKey: "itemId",
    nameKey: "itemName",
    subtitleKey: "itemCode",
    statusKey: "status",
    initialsPrefix: "IT",
    detailsRoute: "/item/{id}",

    sections: [
        {
            title: "Item Info",
            fields: [
                { label: "Item Code", type: "text", key: "itemCode" },
                { label: "Item Name", type: "text", key: "itemName" },
                { label: "Short Name", type: "text", key: "shortName" },
                { label: "Barcode", type: "text", key: "barcode" },
                {
                    label: "Category",
                    type: "text",
                    key: "categoryName"
                },
                {
                    label: "Manufacturer",
                    type: "text",
                    key: "manufacturerName"
                },
                {
                    label: "Brand",
                    type: "text",
                    key: "brandName"
                },
                {
                    label: "Item UoM",
                    type: "text",
                    key: "uomName"
                },
                { label: "Status", type: "text", key: "status" },
            ],
        },
        {
            title: "Pricing",
            fields: [
                { label: "Purchase Price", type: "text", key: "purchasePrice" },
                { label: "Cost Per Unit", type: "text", key: "costPerUnit" },
            ]
        },

    ],
};
