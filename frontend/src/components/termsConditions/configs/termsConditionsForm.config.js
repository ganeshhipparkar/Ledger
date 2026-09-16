import { TermsConditionsFormSchema, TermsConditionsUpdateSchema } from "../../Zod";

export const termsConditionsFormConfig = {
    contexts: {
        "termsConditions-add": {
            mode: "add",
            title: "Terms & Conditions",
            api: {
                method: "POST",
                endpoint: "terms-conditions-add",
                module: "terms-conditions",
            },
            schema: TermsConditionsFormSchema,
            submitButtonText: "Save",
            loadingButtonText: "Creating...",
            successMessage: "Terms & Conditions created successfully",
            fields: [
                {
                    name: "title",
                    label: "Title",
                    type: "text",
                    placeholder: "Enter Terms title",
                    required: true,
                    defaultValue: "",
                    readOnly: false,
                    hidden: false,
                },
                {
                    name: "companyId",
                    label: "Company",
                    type: "company-select",
                    required: true,
                    defaultValue: "",
                    readOnly: false,
                    hidden: false,
                },
                {
                    name: "content",
                    label: "Content",
                    type: "textarea",
                    placeholder: "Terms and conditions content...",
                    required: true,
                    defaultValue: "",
                    readOnly: false,
                    hidden: false,
                }
            ],
        },
        "termsConditions-update": {
            mode: "update",
            title: "Terms & Conditions",
            api: {
                fetchEndpoint: "terms-conditions-details",
                method: "PUT",
                endpoint: "terms-conditions-update",
                module: "terms-conditions",
            },
            schema: TermsConditionsUpdateSchema,
            submitButtonText: "Update",
            loadingButtonText: "Updating...",
            successMessage: "Terms & Conditions updated successfully",
            fields: [
                {
                    name: "title",
                    label: "Title",
                    type: "text",
                    placeholder: "e.g. Standard Terms",
                    required: true,
                    defaultValue: "",
                    readOnly: false,
                    hidden: false,
                },
                {
                    name: "companyId",
                    label: "Company",
                    type: "company-select",
                    required: true,
                    defaultValue: "",
                    readOnly: true,
                    hidden: false,
                },
                {
                    name: "content",
                    label: "Content",
                    type: "textarea",
                    placeholder: "Terms and conditions content...",
                    required: true,
                    defaultValue: "",
                    readOnly: false,
                    hidden: false,
                }
            ],
        },
    },
};
