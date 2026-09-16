"use client";
import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import SidePanel from "../common/SidePanel";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import { formatDate } from "@/lib/utils";
import { loginContext } from "../hooks/LoginContext";

export default function CustomerSidePanel({ customerId, onClose }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [currentId, setCurrentId] = useState(customerId);
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorType, setErrorType] = useState(null);

    useEffect(() => {
        if (customerId) {
            setCurrentId(customerId);
        }
    }, [customerId]);

    useEffect(() => {
        if (!currentId) return;
        fetchCustomer(currentId);
    }, [currentId]);

    const fetchCustomer = async (idToFetch) => {
        setLoading(true);
        setErrorType(null);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `customer-details/${idToFetch}`,
                    module: "customer",
                },
            });
            if (res.status === 403) {
                setErrorType("forbidden");
                return;
            }
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.customerId) {
                setCustomer(data);
            } else {
                setErrorType("not-found");
            }
        } catch (err) {
            console.error(err);
            setErrorType("not-found");
        } finally {
            setLoading(false);
        }
    };

    const formattedCurrencies = customer?.currencies?.length > 0
        ? customer.currencies.map(c => `(${c.code}) ${c.symbol}`).join(", ")
        : "-";

    const sections = customer
        ? [
            {
                title: "Customer Info",
                rows: [
                    { label: "Customer Code", value: customer.customerCode || "-" },
                    { label: "Customer Name", value: customer.customerName || "-" },
                    { label: "Email", value: customer.customerEmail || "-" },
                    {
                        label: "Phone",
                        value: customer.phone ? `${customer.dialCode ? `+${customer.dialCode} ` : ""}${customer.phone}` : "-",
                    },
                    {
                        label: "Company",
                        value: (
                            <LinkedCompanyCell
                                companyId={customer.companyId}
                                companyName={customer.companyName || customer.company?.companyName}
                            />
                        ),
                    },
                    { label: "Location", value: `${customer.city ? `${customer.city}, ` : ""}${customer.state || ""}, ${customer.country || ""}` },
                    { label: "Currencies", value: formattedCurrencies },
                    { label: "Status", value: customer.status || "-" },
                ],
            },
            {
                title: "Owner Info",
                rows: [
                    { label: "Owner Name", value: `${customer.ownerFirstName || ""} ${customer.ownerLastName || ""}`.trim() || "-" },
                    { label: "Owner Email", value: customer.ownerEmail || "-" },
                    {
                        label: "Owner Phone",
                        value: customer.ownerPhone ? `${customer.ownerDialCode ? `+${customer.ownerDialCode} ` : ""}${customer.ownerPhone}` : "-",
                    },
                ],
            },

        ]
        : [];

    return (
        <SidePanel
            onClose={onClose}
            loading={loading}
            errorType={errorType}
            title="Customer Details"
            avatar={customer?.customerLogo ? `http://localhost:4000/upload/customer/${customer.customerId}/${customer.customerLogo}` : null}
            initials={customer?.customerCode?.substring(0, 2) || "CU"}
            name={customer?.customerName || ""}
            subtitle={customer?.customerCode || ""}
            status={customer?.status || ""}
            onMoreDetails={() => {
                onClose();
                router.push(`/customer/${currentId}`);
            }}
            moreDetailsId={currentId}
            sections={sections}
        />
    );
}
