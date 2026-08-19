"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import SidePanel from "../common/SidePanel";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import { formatDate } from "@/lib/utils";
import { loginContext } from "../hooks/LoginContext";

export default function BankBookSidePanel({ bankBookId, onClose }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [currentId, setCurrentId] = useState(bankBookId);
    const [bankBook, setBankBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorType, setErrorType] = useState(null);

    useEffect(() => {
        if (bankBookId) {
            setCurrentId(bankBookId);
        }
    }, [bankBookId]);

    useEffect(() => {
        if (!currentId) return;
        fetchBankBook(currentId);
    }, [currentId]);

    const fetchBankBook = async (idToFetch) => {
        setLoading(true);
        setErrorType(null);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `bank-book-details/${idToFetch}`,
                    module: "bank-book",
                },
            });
            if (res.status === 403) {
                setErrorType("forbidden");
                return;
            }
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.bankBookId) {
                setBankBook(data);
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

    const currencyDisplay = bankBook?.currencyCode
        ? `${bankBook.currencyCode}${bankBook.currencySymbol ? ` (${bankBook.currencySymbol})` : ""}`
        : "-";

    const sections = bankBook
        ? [
            {
                title: "Bank Book Information",
                rows: [
                    { label: "Bank Book Code", value: bankBook.bankBookCode || "-" },
                    { label: "Bank Book Name", value: bankBook.bankBookName || "-" },
                    { label: "Beneficiary Name", value: bankBook.beneficiaryName || "-" },
                    { label: "Bank Name", value: bankBook.bankName || bankBook.bank?.bankName || "-" },
                    {
                        label: "Company",
                        value: (
                            <LinkedCompanyCell
                                companyId={bankBook.companyId}
                                companyName={bankBook.companyName || bankBook.company?.companyName}
                            />
                        ),
                    },
                    { label: "Currency", value: currencyDisplay },
                ],
            },
            {
                title: "Account Details",
                rows: [
                    { label: "Account Number", value: bankBook.accountNumber || "-" },
                    { label: "Branch Name", value: bankBook.branchName || "-" },
                    { label: "Status", value: bankBook.status || "-" },
                    { label: "Remarks", value: bankBook.remarks || "-" },
                ],
            },
            {
                title: "Audit Information",
                rows: [
                    { label: "Added By", value: bankBook.addedByName || "-" },
                    { label: "Added Date", value: formatDate(bankBook.addedDate) },
                    { label: "Updated By", value: bankBook.updatedByName || "-" },
                    { label: "Updated Date", value: formatDate(bankBook.updatedDate) },
                ],
            },
        ]
        : [];

    return (
        <SidePanel
            onClose={onClose}
            loading={loading}
            errorType={errorType}
            title="Bank Book Details"
            avatar={null}
            initials={bankBook?.bankBookCode?.substring(0, 2) || "BB"}
            name={bankBook?.bankBookName || ""}
            subtitle={bankBook?.bankBookCode || ""}
            status={bankBook?.status || ""}
            onMoreDetails={() => {
                onClose();
                router.push(`/bank-book/${currentId}`);
            }}
            moreDetailsId={currentId}
            sections={sections}
        />
    );
}
