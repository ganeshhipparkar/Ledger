export const itemSidePanelConfig = {
    title: "Item Details",
    fetchEndpoint: "item-details",
    module: "item",
    idKey: "itemId",
    nameKey: "itemName",
    subtitleKey: "itemCode",
    statusKey: "status",
    imageKey: "primaryImage",
    initialsPrefix: "IT",
    detailsRoute: "/item/{id}",

    sections: [
        {
            title: "Item Info",
            fields: [
                // { label: "Image", type: "image", key: "primaryImage" },
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
                    key: "itemUomName"
                },
                { label: "Status", type: "text", key: "status" },
            ],
        },


    ],
};
