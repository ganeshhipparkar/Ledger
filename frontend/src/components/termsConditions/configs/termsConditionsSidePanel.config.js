
export const termsConditionsSidePanelConfig = {
    title: "Terms & Conditions Details",
    fetchEndpoint: "terms-conditions-details",
    module: "terms-conditions",
    idKey: "termsConditionsId",
    nameKey: "title",
    subtitleKey: "code",
    initialsPrefix: "TC",
    detailsRoute: "/terms-conditions/{id}",

    sections: [
        {
            title: "Terms & Conditions Info",
            fields: [
                { label: "Code", type: "text", key: "code" },
                { label: "Title", type: "text", key: "title" },
                { label: "Content", type: "text", key: "content" },
                {
                    label: "Company",
                    type: "linked-company",
                    companyIdKey: "companyId",
                    companyNameKey: "companyName",
                    companyFallbackPath: "company.companyName",
                },
            ],
        },

    ],
};
