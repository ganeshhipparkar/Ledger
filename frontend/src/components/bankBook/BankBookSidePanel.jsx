"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import SidePanel from "../common/SidePanel";
import LinkedCompanyCell from "../common/LinkedCompanyCell";

export default function BankBookSidePanel({ bankBookId, onClose }) {
    const router = useRouter();
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

    const currencyStr = bankBook?.currencyCode || bankBook?.currency?.code 
        ? `${bankBook.currencyCode || bankBook.currency.code} ${bankBook.currencySymbol || bankBook.currency?.symbol ? `(${bankBook.currencySymbol || bankBook.currency.symbol})` : ""}`
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
                    { label: "Currency", value: currencyStr },
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
        ]
        : [];

    return (
        <SidePanel
            onClose={onClose}
            loading={loading}
            errorType={errorType}
            title="Bank Book Details"
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
