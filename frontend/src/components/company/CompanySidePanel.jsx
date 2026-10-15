"use client";
import { useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import SidePanel from "../common/SidePanel";
import { getInitials } from "@/lib/utils";

export default function CompanySidePanel({ companyId, onClose, onMoreDetails }) {
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!companyId) return;
        fetchCompany();
    }, [companyId]);

    const fetchCompany = async () => {
        setLoading(true);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `company-details/${companyId}`,
                    module: "company",
                },
            });
            const resJson = await res.json();
            const data = resJson?.encrypted ? decryptResponse(resJson.encrypted) : resJson;
            setCompany(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const websiteValue = company?.website ? (
        <a
            href={company.website}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
        >
            {company.website}
        </a>
    ) : (
        "N/A"
    );

    const cityStateCountry = company
        ? [company.city, company.state, company.country].filter(Boolean).join(", ") || "N/A"
        : "N/A";

    const sections = company
        ? [
            {
                title: "Basic Info",
                rows: [
                    { label: "Location", value: company.companyLocation || "N/A" },
                    { label: "Website", value: websiteValue },
                    { label: "Allow Manual Invoicing", value: company.allowManualInvoicing === "NO" ? "No" : "Yes" },
                ],
            },
            {
                title: "Contact",
                rows: [
                    { label: "Email", value: company.email || "N/A" },
                    {
                        label: "Phone",
                        value: `${company.dialCode ? `+${company.dialCode} ` : ""}${company.phone || "N/A"}`,
                    },
                ],
            },
            {
                title: "Address",
                rows: [
                    { label: "Address", value: company.AddressLineOne || "N/A" },
                    { label: "City / State", value: cityStateCountry },
                    { label: "Postal Code", value: company.postalCode || "N/A" },
                ],
            },
            {
                title: "Owner",
                rows: [
                    { label: "Name", value: company.ownerName || "N/A" },
                    { label: "Email", value: company.ownerEmail || "N/A" },
                    { label: "Phone", value: company.ownerPhone || "N/A" },
                ],
            },
        ]
        : [];

    const avatarUrl = company?.companyFile
        ? `http://localhost:4000/upload/company/${company.companyId}/${company.companyFile}`
        : null;

    return (
        <SidePanel
            onClose={onClose}
            loading={loading}
            errorType={!company && !loading ? "not-found" : null}
            title="Company Details"
            avatar={avatarUrl}
            initials={getInitials(company?.companyName)}
            name={company?.companyName || ""}
            subtitle={company?.companyCode || ""}
            status={company?.status || ""}
            onMoreDetails={onMoreDetails}
            moreDetailsId={companyId}
            sections={sections}
        />
    );
}