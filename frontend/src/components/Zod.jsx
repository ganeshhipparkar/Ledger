import { min } from "date-fns";
import z from "zod";
import dayjs from "dayjs";

export const userLoginSchema = z.object({
    email: z.string()
        .min(2, "Please enter Email.")
        .email('Invalid email.'),

    password: z.string()
        .min(1, "Please enter the Password.")
        .max(20, "Password must be at most 20 characters."),
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const UpdateFormSchema = z.object({
    email: z.string()
        .min(2, "Please enter Email.")
        .email("Please enter valid Email."),

    name: z.string()
        .min(1, "Please enter the UserName.")
        .max(10, "UserName must be at most 10 characters.")
        .regex(/^\S+$/, "UserName cannot contain spaces."),

    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please Select a valid status." }),
    }),

    firstName: z.string()
        .min(1, "Please enter the First Name.")
        .max(50, "First name must be at most 50 characters.")
        .regex(/^[a-zA-Z0-9]+$/, "First Name cannot contain special characters."),

    middleName: z.string()
        .max(50, "Middle name must be at most 50 characters.")
        .regex(/^[a-zA-Z0-9]+$/, "Middle Name cannot contain special characters.")
        .optional()
        .or(z.literal("")),

    surname: z.string()
        .min(1, "Please enter the Last name.")
        .max(50, "Last name must be at most 50 characters."),
    // .regex(/^[a-zA-Z0-9]+$/, "Surname cannot contain special characters."),

    dob: z
        .any()
        .refine((val) => val && dayjs(val).isValid(), {
            message: "Please select Date of Birth.",
        })
        .refine((val) => val && dayjs().diff(dayjs(val), "year") >= 18, {
            message: "You must be at least 18 years old.",
        }),

    phone: z.string().min(1, "Please Enter Phone number "),
    dialCode: z.string().optional().or(z.literal("")),

    alternatePhone: z.string()
        .optional()
        .or(z.literal(""))
        .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
            message: "Invalid phone number.",
        }),

    userFile: z.any()
        .optional()
        .refine((file) => {
            if (!file) return true;
            return file.size <= MAX_FILE_SIZE;
        }, "Max file size is 5MB.")
        .refine((file) => {
            if (!file) return true;
            return ACCEPTED_IMAGE_TYPES.includes(file.type);
        }, ".jpg, .jpeg, .png and .webp files are accepted."),
});

export const AddFormSchema = z.object({
    email: z.string()
        .min(2, "Please enter Email.")
        .email("Invalid email, enter valid Email."),

    name: z.string()
        .min(1, "Please enter UserName. ")
        .max(10, "UserName must be at most 50 characters."),

    firstName: z.string()
        .min(1, "Please enter First name.")
        .max(50, "First name must be at most 50 characters."),

    middleName: z.string()
        .max(50, "Middle name must be at most 50 characters.")
        .optional()
        .or(z.literal("")),

    surname: z.string()
        .min(1, "Please enter Last name.")
        .max(50, "Last name must be at most 50 characters."),

    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please Select a valid Status." }),
    }),

    phone: z.string()
        .min(1, "Please enter Phone Number")
    ,

    password: z
        .string()
        .min(1, "Please enter Password.")
        .min(8, "Password must be at least 8 characters long.")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]*$/,
            "Password must contain uppercase, lowercase, number, and special character."
        ),
    alternatePhone: z.string()
        .optional()
        .or(z.literal(""))
        .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
            message: "Invalid Phone Number.",
        }),

    groupId: z.string().min(1, "Please select Role."),
    companyId: z.string().min(1, "Please select Company."),

    dob: z
        .any()
        .refine((val) => val && dayjs(val).isValid(), {
            message: "Please select Date of Birth.",
        })
        .refine((val) => val && dayjs().diff(dayjs(val), "year") >= 18, {
            message: "You must be at least 18 years old.",
        }),

    userFile: z.any()
        .optional()
        .refine((file) => {
            if (!file) return true;
            return file.size <= MAX_FILE_SIZE;
        }, "Max file size is 5MB.")
        .refine((file) => {
            if (!file) return true;
            return ACCEPTED_IMAGE_TYPES.includes(file.type);
        }, ".jpg, .jpeg, .png and .webp files are accepted."),
});

export const CompanyUpdateSchema = z.object({
    companyName: z.string().
        min(1, "Please enter Company Name."),
    companyCode: z.string()
        .min(1, "Please enter Company Code.")
        .min(2, "Company Code should be more that 2 Letters"),
    AddressLineOne: z.string().
        min(1, "please enter Address Line 1.")
        .min(2, "Address Line should be more than 2 letters"),
    status: z.enum(["active", "inactive"], {
        errorMap: () => ({ message: "Please Select a valid Status." }),
    }),
    companyFile: z.any()
        .optional()
        .refine((file) => {
            if (!file) return true;
            return file.size <= MAX_FILE_SIZE;
        }, "Max file size is 5MB.")
        .refine((file) => {
            if (!file) return true;
            return ACCEPTED_IMAGE_TYPES.includes(file.type);
        }, ".jpg, .jpeg, .png and .webp files are accepted."),
    email: z.string()
        .min(2, "Please enter Email")
        .email("Invalid email, enter valid Email."),
    website: z.string()
        .min(2, "Please enter Website."),
    dialCode: z.union([z.coerce.number("Please enter DialCode"), z.literal(""), z.undefined()]),
    phone: z
        .string({ required_error: "Please enter Phone number." })
        .min(1, { message: "Please enter Phone Number." })
        .max(10, { message: "Enter valid Phone Number." })
        .regex(/^\d+$/, { message: "Enter valid Phone Number." }),
    country: z.string()
        .min(1, "Please select Country. "),
    state: z.string()
        .min(1, "Please select State. "),
    city: z.string()
        .min(1, "Please select City. "),
    postalCode: z.coerce.string({ required_error: "Please enter Postal Code." }).min(1, "Please enter Postal Code.").regex(/^\d+$/, "Postal Code must contain only numbers."),
    ownerName: z.string().min(2, "Please enter Owner Name."),
    ownerEmail: z.string().min(2, "Please enter Owner Email.")
        .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Enter a valid owner email."),
    ownerPhone: z.string().min(2, "Please enter Owner phone. "),
    companyFile: z.any()
        .optional()
        .refine((file) => {
            if (!file) return true;
            return file.size <= MAX_FILE_SIZE;
        }, "Max file size is 5MB.")
        .refine((file) => {
            if (!file) return true;
            return ACCEPTED_IMAGE_TYPES.includes(file.type);
        }, ".jpg, .jpeg, .png and .webp files are accepted."),
});

export const ResetPasswordSchema = z.object({
    password: z.string()
        .min(1, "Please enter the Password.")
        .max(100, "Password must be at most 100 characters.")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            "Password must contain uppercase, lowercase, number, and special character."
        ),
    confirmPass: z.string()
        .min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPass, {
    message: "Passwords do not match",
    path: ["confirmPass"],
});

export const ChangePasswordSchema = z.object({
    currentPassword: z.string()
        .min(1, "Current password is required"),
    newPassword: z.string()
        .min(1, "Please enter the Password.")
        .max(100, "Password must be at most 100 characters.")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            "Password must contain uppercase, lowercase, number, and special character."
        ),
    confirmPassword: z.string()
        .min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
}).refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
});

export const GroupFormSchema = z.object({
    groupName: z.string()
        .trim()
        .min(1, "Please enter Group Name.")
        .max(20, "Group name must be at most 50 characters."),

    groupCode: z.string()
        .trim()
        .min(1, "Please enter Group Code.")
        .max(20, "Group code must be at most 20 characters."),

    status: z.enum(["active", "inactive"], {
        errorMap: () => ({ message: "Status is required." }),
    }),
});

export const CurrencyFormSchema = z.object({
    name: z.string()
        .min(1, "Please enter Currency Name."),
    code: z.string()
        .min(1, "Please enter Code.")
        .min(2, "Code should be at least 2 letters.")
        .max(255, "Code should be at most 255 characters."),
    symbol: z.string()
        .min(1, "Please enter Symbol.")
        .max(10, "Symbol should be at most 10 characters."),
    conversionRate: z
        .coerce
        .number({
            required_error: "Please enter Conversion Rate.",
            invalid_type_error: "Conversion Rate must be a number.",
        })
        .min(0, { message: "Conversion Rate cannot be negative." }),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please Select a valid Status." }),
    }),
});

export const CurrencyUpdateSchema = z.object({
    curId: z.coerce.number(),
    name: z.string()
        .min(1, "Please enter Currency Name."),
    code: z.string()
        .min(1, "Please enter Code.")
        .min(2, "Code should be at least 2 letters.")
        .max(255, "Code should be at most 255 characters."),
    symbol: z.string()
        .min(1, "Please enter Symbol.")
        .max(10, "Symbol should be at most 10 characters."),
    conversionRate: z
        .coerce
        .number({
            required_error: "Please enter Conversion Rate.",
            invalid_type_error: "Conversion Rate must be a number.",
        })
        .min(0, { message: "Conversion Rate cannot be negative." }),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please Select a valid Status." }),
    }),
});

export const ItemCategoryFormSchema = z.object({
    itemCategoryName: z.string()
        .min(1, "Please enter Item Category Name."),
    type: z.enum(["Goods", "Service"], {
        message: "Please select a valid Type.",
    }),
    companyId: z.coerce.number("Please select a Company.")
        .min(1, "Please select a Company."),
    parentCategoryId: z.coerce.number().nullable().optional().or(z.literal("")),
    status: z.enum(["Active", "Inactive"], {
        message: "Please select a valid Status.",
    }),
});

export const ItemCategoryUpdateSchema = z.object({
    itemCategoryId: z.coerce.number(),
    itemCategoryName: z.string()
        .min(1, "Please enter Item Category Name."),
    type: z.enum(["Goods", "Service"], {
        message: "Please select a valid Type.",
    }),
    companyId: z.coerce.number().min(1, "Please select a Company."),
    parentCategoryId: z.coerce.number().nullable().optional().or(z.literal("")),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const ManufacturerFormSchema = z.object({
    manufacturerName: z.string()
        .min(1, "Please enter Manufacturer Name."),
    companyId: z.coerce.number("Please select a Company.")
        .min(1, "Please select a Company."),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const ManufacturerUpdateSchema = z.object({
    manufacturerId: z.coerce.number(),
    manufacturerName: z.string()
        .min(1, "Please enter Manufacturer Name."),
    companyId: z.coerce.number().min(1, "Please select a Company."),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const BankFormSchema = z.object({
    bankName: z.string()
        .min(1, "Please enter Bank Name."),
    companyId: z.coerce.number("Please select a Company.")
        .min(1, "Please select a Company."),
    remarks: z.string().optional().or(z.literal("")),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const BankUpdateSchema = z.object({
    bankId: z.coerce.number(),
    bankName: z.string()
        .min(1, "Please enter Bank Name."),
    companyId: z.coerce.number().min(1, "Please select a Company."),
    remarks: z.string().optional().or(z.literal("")),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const BankBookFormSchema = z.object({
    bankBookName: z.string().min(1, "Please enter Bank Book Name."),
    companyId: z.coerce.number("Please select a Company.").min(1, "Please select a Company."),
    bankId: z.coerce.number("Please select a Bank.").min(1, "Please select a Bank."),
    currencyId: z.coerce.number("Please select a Currency.").min(1, "Please select a Currency."),
    beneficiaryName: z.string().min(1, "Please enter Beneficiary Name."),
    accountNumber: z.string().min(1, "Please enter Account Number."),
    branchName: z.string().min(1, "Please enter Branch Name."),
    remarks: z.string().optional().or(z.literal("")),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const BankBookUpdateSchema = z.object({
    bankBookId: z.coerce.number().min(1),
    bankBookName: z.string().min(1, "Please enter Bank Book Name."),
    companyId: z.coerce.number().min(1, "Please select a Company."),
    bankId: z.coerce.number("Please select a Bank.").min(1, "Please select a Bank."),
    currencyId: z.coerce.number("Please select a Currency.").min(1, "Please select a Currency."),
    beneficiaryName: z.string().min(1, "Please enter Beneficiary Name."),
    accountNumber: z.string().min(1, "Please enter Account Number."),
    branchName: z.string().min(1, "Please enter Branch Name."),
    remarks: z.string().optional().or(z.literal("")),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const BrandFormSchema = z.object({
    brandName: z.string()
        .min(1, "Please enter Brand Name."),
    companyId: z.coerce.number("Please select a Company.")
        .min(1, "Please select a Company."),
    manufacturerId: z.coerce.number("Please select a Manufacturer.")
        .min(1, "Please select a Manufacturer."),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const BrandUpdateSchema = z.object({
    brandId: z.coerce.number(),
    brandName: z.string()
        .min(1, "Please enter Brand Name."),
    companyId: z.coerce.number().min(1, "Please select a Company."),
    manufacturerId: z.coerce.number("Please select a Manufacturer.")
        .min(1, "Please select a Manufacturer."),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const UomFormSchema = z.object({
    uomName: z.string()
        .min(1, "Please enter UOM Name."),
    abbreviation: z.string()
        .min(1, "Please enter Abbreviation."),
    isoCode: z.string()
        .min(1, "Please enter ISO Code."),
    companyId: z.coerce.number("Please select a Company.")
        .min(1, "Please select a Company."),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const UomUpdateSchema = z.object({
    uomId: z.coerce.number(),
    uomName: z.string()
        .min(1, "Please enter UOM Name."),
    abbreviation: z.string()
        .min(1, "Please enter Abbreviation."),
    isoCode: z.string()
        .min(1, "Please enter ISO Code."),
    companyId: z.coerce.number().min(1, "Please select a Company."),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const PackageFormSchema = z.object({
    packageName: z.string()
        .min(1, "Please enter Package Name."),
    description: z.string().optional(),
    companyId: z.coerce.number("Please select a Company.")
        .min(1, "Please select a Company."),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const PackageUpdateSchema = z.object({
    packageId: z.coerce.number(),
    packageName: z.string()
        .min(1, "Please enter Package Name."),
    description: z.string().optional(),
    companyId: z.coerce.number().min(1, "Please select a Company."),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
});

export const CustomerFormSchema = z.object({
    customerName: z.string()
        .min(1, "Please enter Customer Name."),
    customerLogo: z.any().optional(),
    customerEmail: z.string()
        .min(1, "Please enter Customer Email.")
        .email("Please enter valid Email."),
    customerIncorporationDate: z.string()
        .min(1, "Please enter Incorporation Date.")
        .refine((val) => {
            if (!val) return true;
            const d = new Date(val);
            if (isNaN(d.getTime())) return true;
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            return d <= today;
        }, { message: "Incorporation Date cannot be in the future." }),
    dialCode: z.coerce.number("Please enter Dial Code.")
        .min(1, "Please enter Dial Code."),
    phone: z.string()
        .min(1, "Please enter Phone."),
    companyId: z.coerce.number("Please select a Company.")
        .min(1, "Please select a Company."),
    country: z.string()
        .min(1, "Please enter Country."),
    state: z.string()
        .min(1, "Please enter State."),
    city: z.string()
        .min(1, "Please enter city."),
    AddressLineOne: z.string()
        .min(1, "Please enter Address Line One."),
    postalCode: z.number("Please enter postal Code.")
        .min(1, "Please enter postal Code."),
    ownerFirstName: z.string()
        .min(1, "Please enter Owner First Name."),
    ownerLastName: z.string()
        .min(1, "Please enter Owner Last Name."),
    ownerEmail: z.string()
        .min(1, "Please enter Owner Email.")
        .email("Please enter valid Email."),
    ownerPhone: z.string()
        .min(1, "Please enter Owner Phone."),
    ownerDialCode: z.coerce.number().optional().nullable().or(z.literal("")),
    ownerDob: z.string()
        .min(1, "Please enter Owner Date of Birth.")
        .refine((val) => {
            if (!val) return true;
            const d = new Date(val);
            if (isNaN(d.getTime())) return true;
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            return d <= today;
        }, { message: "Owner Date of Birth cannot be in the future." }),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
    curIds: z.array(z.number()).optional(),
});

export const CustomerUpdateSchema = z.object({
    customerId: z.coerce.number(),
    customerName: z.string()
        .min(1, "Please enter Customer Name."),
    customerLogo: z.any().optional(),
    removeCustomerLogo: z.string().optional(),
    customerEmail: z.string()
        .min(1, "Please enter Customer Email.")
        .email("Please enter valid Email."),
    customerIncorporationDate: z.string()
        .min(1, "Please enter Incorporation Date.")
        .refine((val) => {
            if (!val) return true;
            const d = new Date(val);
            if (isNaN(d.getTime())) return true;
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            return d <= today;
        }, { message: "Incorporation Date cannot be in the future." }),
    dialCode: z.coerce.number("Please enter Dial Code.")
        .min(1, "Please enter Dial Code."),
    phone: z.string()
        .min(1, "Please enter Phone."),
    companyId: z.coerce.number("Please select a Company.")
        .min(1, "Please select a Company."),
    country: z.string()
        .min(1, "Please enter Country."),
    state: z.string()
        .min(1, "Please enter State."),
    city: z.string().optional().or(z.literal("")),
    AddressLineOne: z.string().optional().or(z.literal("")),
    postalCode: z.coerce.number().optional().nullable().or(z.literal("")),
    ownerFirstName: z.string()
        .min(1, "Please enter Owner First Name."),
    ownerLastName: z.string()
        .min(1, "Please enter Owner Last Name."),
    ownerEmail: z.string()
        .min(1, "Please enter Owner Email.")
        .email("Please enter valid Email."),
    ownerPhone: z.string()
        .min(1, "Please enter Owner Phone."),
    ownerDialCode: z.coerce.number().optional().nullable().or(z.literal("")),
    ownerDob: z.string()
        .min(1, "Please enter Owner Date of Birth.")
        .refine((val) => {
            if (!val) return true;
            const d = new Date(val);
            if (isNaN(d.getTime())) return true;
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            return d <= today;
        }, { message: "Owner Date of Birth cannot be in the future." }),
    status: z.enum(["Active", "Inactive"], {
        errorMap: () => ({ message: "Please select a valid Status." }),
    }),
    curIds: z.array(z.number()).optional(),
});

export const ItemFormSchema = z.object({
    itemName: z.string("Please enter Item Name.").min(1, "Please enter Item Name."),
    companyId: z.coerce.number("Please select a Company.").min(1, "Please select a Company."),
    categoryId: z.coerce.number("Please select a Category.").min(1, "Please select a Category."),
    manufacturerId: z.coerce.number("Please select a Manufacturer.").min(1, "Please select a Manufacturer."),
    brandId: z.coerce.number("Please select a Brand.").min(1, "Please select a Brand."),
    itemUom: z.coerce.number("Please select an Item UOM.").min(1, "Please select an Item UOM."),
    packageUom: z.coerce.number().optional().nullable(),
    primitiveQuantity: z.coerce.number("Please enter Primitive Quantity.").min(0, "Please enter Primitive Quantity."),
    purchasePrice: z.coerce.number("Please enter Purchase Price.").min(0, "Please enter Purchase Price."),
    costPerUnit: z.coerce.number("Please enter Cost Per Unit.").min(0, "Please enter Cost Per Unit."),
    sourceCurrencyId: z.coerce.number("Please select a Currency.").min(1, "Please select a Currency."),
    conversionRate: z.coerce.number().optional(),
    isDecimalAllowed: z.enum(["true", "false"]).optional(),
    checkShelfLife: z.enum(["true", "false"]).optional(),
    shelfLifeUnit: z.enum(["minute", "hour", "day", "month", "year"]).optional(),
    shelfLifeSpan: z.coerce.number().optional().nullable(),
    shortName: z.string().optional(),
    remarks: z.string().optional(),
    archive: z.enum(["true", "false"]).optional(),
    status: z.enum(["Active", "Inactive"]).optional(),
});

export const ItemUpdateSchema = z.object({
    itemId: z.coerce.number().min(1),
    itemName: z.string().min(1, "Please enter Item Name.").optional(),
    companyId: z.coerce.number().optional(),
    categoryId: z.coerce.number().optional(),
    manufacturerId: z.coerce.number().optional(),
    brandId: z.coerce.number().optional(),
    itemUom: z.coerce.number().optional(),
    packageUom: z.coerce.number().optional().nullable(),
    primitiveQuantity: z.coerce.number().optional(),
    purchasePrice: z.coerce.number().optional(),
    costPerUnit: z.coerce.number().optional(),
    sourceCurrencyId: z.coerce.number().optional(),
    conversionRate: z.coerce.number().optional(),
    isDecimalAllowed: z.enum(["true", "false"]).optional(),
    checkShelfLife: z.enum(["true", "false"]).optional(),
    shelfLifeUnit: z.enum(["minute", "hour", "day", "month", "year"]).optional(),
    shelfLifeSpan: z.coerce.number().optional().nullable(),
    shortName: z.string().optional(), // display only — not sent in payload
    remarks: z.string().optional(),
    archive: z.enum(["true", "false"]).optional(),
    status: z.enum(["Active", "Inactive"]).optional(),
});

export const TermsConditionsFormSchema = z.object({
    title: z.string().min(1, "Please enter Title."),
    content: z.string().min(1, "Please enter Content.").max(10000, "Content cannot exceed 10000 characters."),
    companyId: z.coerce.number("Please select a Company.").min(1, "Please select a Company."),
});

export const TermsConditionsUpdateSchema = z.object({
    termsConditionsId: z.coerce.number(),
    title: z.string().min(1, "Please enter Title."),
    content: z.string().min(1, "Please enter Content.").max(10000, "Content cannot exceed 10000 characters."),
    companyId: z.coerce.number().optional(),
});

export const TaxGroupFormSchema = z.object({
    taxName: z.string().min(1, "Please enter Tax Name."),
    taxValue: z.coerce.number("Please enter Tax Value.").min(0, "Tax Value cannot be negative."),
    companyId: z.coerce.number("Please select a Company.").min(1, "Please select a Company."),
});

export const TaxGroupUpdateSchema = z.object({
    taxId: z.coerce.number(),
    taxName: z.string().min(1, "Please enter Tax Name.").optional(),
    taxValue: z.coerce.number({ required_error: "Please enter Tax Value.", invalid_type_error: "Tax Value must be a number." }).min(0, "Tax Value cannot be negative.").optional(),
    companyId: z.coerce.number().optional(),
});

export const PaymentTransactionFormSchema = z.object({
    customerId: z.coerce.number("Please select a Customer.").min(1, "Please select a Customer."),
    currencyId: z.coerce.number("Please select a Currency.").min(1, "Please select a Currency."),
    bankBookId: z.coerce.number("Please select a Bank Account.").min(1, "Please select a Bank Account."),
    companyId: z.coerce.number("Please select a Company.").min(1, "Please select a Company."),
    paymentMode: z.enum(["Cash", "Credit Card", "Debit Card", "Digital Wallet", "Bank Transfer", "UPI", "Buy Now Pay Later"], ("Please select a valid Payment Mode."),
    ),
    paymentDate: z.string().min(1, "Please select Payment Date."),
    // exchangeRate: z.coerce.number("Please enter Exchange Rate.").min(0.000001, "Exchange Rate must be positive."),
    exchangeDate: z.string().min(1, "Please select Exchange Date."),
    narration: z.string().min(1, "Please enter Narration."),
    transactionAmount: z.coerce.number("Please enter valid Transaction Amount.").min(0.0001, "Transaction Amount must be positive."),
    description: z.string().min(1, "Please enter Description."),
});

export const PaymentTransactionUpdateSchema = z.object({
    paymentTransactionId: z.coerce.number().min(1),
    customerId: z.coerce.number("Please select a Customer.").min(1, "Please select a Customer.").optional(),
    currencyId: z.coerce.number("Please select a Currency.").min(1, "Please select a Currency.").optional(),
    bankBookId: z.coerce.number("Please select a Bank Account.").min(1, "Please select a Bank Account.").optional(),
    companyId: z.coerce.number("Please select a Company.").min(1, "Please select a Company.").optional(),
    paymentMode: z.enum(["Cash", "Credit Card", "Debit Card", "Digital Wallet", "Bank Transfer", "UPI", "Buy Now Pay Later"]).optional(),
    paymentDate: z.string().optional(),
    exchangeRate: z.coerce.number().optional(),
    exchangeDate: z.string().optional(),
    narration: z.string().optional(),
    transactionAmount: z.coerce.number().optional(),
    description: z.string().optional(),
    deletedAttachmentIds: z.array(z.number()).optional(),
});

const QuotationItemRowSchema = z.object({
    itemId: z.union([z.string(), z.number()])
        .refine((val) => val !== undefined && val !== null && String(val).trim() !== "" && Number(val) > 0, {
            message: "Item selection is required.",
        }),
    quantity: z.union([z.string(), z.number()])
        .refine((val) => parseFloat(val) > 0, { message: "Quantity must be greater than 0." }),
    unitPrice: z.union([z.string(), z.number()])
        .refine((val) => parseFloat(val) >= 0, { message: "Unit Price cannot be negative." }),
});

export const QuotationFormSchema = z.object({
    customerId: z.union([z.string(), z.number()])
        .refine((val) => val !== undefined && val !== null && String(val).trim() !== "", {
            message: "Customer is required.",
        }),
    currencyId: z.union([z.string(), z.number()])
        .refine((val) => val !== undefined && val !== null && String(val).trim() !== "", {
            message: "Currency is required.",
        }),
    issueDate: z.string()
        .min(1, "Issue Date is required.")
        .refine((val) => dayjs(val).isValid(), { message: "Invalid Issue Date." }),
    expiryDate: z.string()
        .min(1, "Expiry Date is required.")
        .refine((val) => dayjs(val).isValid(), { message: "Invalid Expiry Date." }),
    bankBookId: z.union([z.string(), z.number()])
        .refine((val) => val !== undefined && val !== null && String(val).trim() !== "", {
            message: "Bank Account is required.",
        }),
    salesPersonId: z.union([z.string(), z.number()])
        .refine((val) => val !== undefined && val !== null && String(val).trim() !== "", {
            message: "Sales Person is required.",
        }),
    items: z.array(QuotationItemRowSchema).min(1, "At least one item is required."),
    vatWithheld: z.enum(["YES", "NO"]).default("NO"),
}).refine((data) => {
    if (data.issueDate && data.expiryDate && dayjs(data.issueDate).isValid() && dayjs(data.expiryDate).isValid()) {
        const diff = dayjs(data.expiryDate).diff(dayjs(data.issueDate), "day");
        return diff >= 15;
    }
    return true;
}, {
    message: "Expiry date must be at least 15 days after issue date.",
    path: ["expiryDate"],
});

export const QuotationUpdateFormSchema = z.object({
    customerId: z.union([z.string(), z.number()])
        .refine((val) => val !== undefined && val !== null && String(val).trim() !== "", {
            message: "Customer is required.",
        }),
    currencyId: z.union([z.string(), z.number()])
        .refine((val) => val !== undefined && val !== null && String(val).trim() !== "", {
            message: "Currency is required.",
        }),
    issueDate: z.string()
        .min(1, "Issue Date is required.")
        .refine((val) => dayjs(val).isValid(), { message: "Invalid Issue Date." }),
    expiryDate: z.string()
        .min(1, "Expiry Date is required.")
        .refine((val) => dayjs(val).isValid(), { message: "Invalid Expiry Date." }),
    bankBookId: z.union([z.string(), z.number()])
        .refine((val) => val !== undefined && val !== null && String(val).trim() !== "", {
            message: "Bank Account is required.",
        }),
    salesPersonId: z.union([z.string(), z.number()])
        .refine((val) => val !== undefined && val !== null && String(val).trim() !== "", {
            message: "Sales Person is required.",
        }),
    items: z.array(QuotationItemRowSchema).min(1, "At least one item is required."),
    vatWithheld: z.enum(["YES", "NO"]).default("NO"),
}).refine((data) => {
    if (data.issueDate && data.expiryDate && dayjs(data.issueDate).isValid() && dayjs(data.expiryDate).isValid()) {
        const diff = dayjs(data.expiryDate).diff(dayjs(data.issueDate), "day");
        return diff >= 15;
    }
    return true;
}, {
    message: "Expiry date must be at least 15 days after issue date.",
    path: ["expiryDate"],
});

const nonEmpty = (val) => val !== undefined && val !== null && String(val).trim() !== "";

const OrderItemRowSchema = z.object({
    itemId: z.union([z.string(), z.number()]).refine(nonEmpty, "Item is required."),
    itemGL: z.string().optional(),
    quantity: z.number({ coerce: true }).positive("Quantity must be > 0"),
    unitPrice: z.number({ coerce: true }).nonnegative("Unit Price must be ≥ 0"),
    taxCalculation: z.enum(["N/A", "EXCLUSIVE", "INCLUSIVE"]),
});

export const OrderFormSchema = z.object({
    customerId: z.union([z.string(), z.number()]).refine(nonEmpty, "Customer is required."),
    currencyId: z.union([z.string(), z.number()]).refine(nonEmpty, "Currency is required."),
    contactPersonId: z.union([z.string(), z.number()]).refine(nonEmpty, "Contact Person is required."),
    orderDate: z.string().min(1, "Order Date is required.")
        .refine(val => dayjs(val) >= dayjs().startOf("day"), "Order Date cannot be in the past."),
    deliveryDate: z.string().optional(),
    businessTerms: z.string().min(1, "Business Terms required."),
    paymentType: z.string().min(1, "Payment Type required."),
    deliveryTerms: z.string().optional(),
    discountApplicable: z.string().min(1, "Discount Applicable required."),
    shippingState: z.string().min(1, "Shipping Address required."),
    billingState: z.string().min(1, "Billing Address required."),
    deliveryState: z.string().min(1, "Place of Delivery required."),
    deliveryType: z.string().min(1, "Delivery Type required."),
    invoiceGenerationOn: z.string().min(1, "Invoice Generation required."),
    invoiceAutoApproval: z.string().min(1, "Invoice Auto Approval required."),
    bankBookId: z.union([z.string(), z.number()]).refine(nonEmpty, "Bank Account is required."),
    placeOfSupply: z.string().optional(),
    vatWithheld: z.enum(["YES", "NO"]).default("NO"),
    salesPersonId: z.union([z.string(), z.number()]).refine(nonEmpty, "Sales Person is required."),
    items: z.array(OrderItemRowSchema).min(1, "At least one item is required."),
});

export const OrderUpdateFormSchema = z.object({
    contactPersonId: z.union([z.string(), z.number()]).refine(nonEmpty, "Contact Person required."),
    orderDate: z.string().optional(),
    deliveryDate: z.string().optional(),
    businessTerms: z.string().min(1, "Business Terms required."),
    paymentType: z.string().min(1, "Payment Type required."),
    deliveryTerms: z.string().optional(),
    discountApplicable: z.string().min(1, "Discount Applicable required."),
    shippingState: z.string().min(1, "Shipping Address required."),
    billingState: z.string().min(1, "Billing Address required."),
    deliveryState: z.string().min(1, "Place of Delivery required."),
    deliveryType: z.string().min(1, "Delivery Type required."),
    invoiceGenerationOn: z.string().min(1, "Invoice Generation required."),
    invoiceAutoApproval: z.string().min(1, "Invoice Auto Approval required."),
    bankBookId: z.union([z.string(), z.number()]).refine(nonEmpty, "Bank Account is required."),
    placeOfSupply: z.string().optional(),
    vatWithheld: z.enum(["YES", "NO"]).default("NO"),
    salesPersonId: z.union([z.string(), z.number()]).refine(nonEmpty, "Sales Person required."),
    items: z.array(OrderItemRowSchema).min(1, "At least one item is required."),
}); 