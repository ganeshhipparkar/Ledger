"use client";
import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import SidePanel from "../common/SidePanel";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import { formatDate } from "@/lib/utils";
import { loginContext } from "../hooks/LoginContext";

export default function BankSidePanel({ bankId, onClose }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [currentId, setCurrentId] = useState(bankId);
    const [bank, setBank] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorType, setErrorType] = useState(null);

    useEffect(() => {
        if (bankId) {
            setCurrentId(bankId);
        }
    }, [bankId]);

    useEffect(() => {
        if (!currentId) return;
        fetchBank(currentId);
    }, [currentId]);

    const fetchBank = async (idToFetch) => {
        setLoading(true);
        setErrorType(null);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `bank-details/${idToFetch}`,
                    module: "bank",
                },
            });
            if (res.status === 403) {
                setErrorType("forbidden");
                return;
            }
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.bankId) {
                setBank(data);
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

    const sections = bank
        ? [
              {
                  title: "Bank Info",
                  rows: [
                      { label: "Bank Code", value: bank.bankCode || "-" },
                      { label: "Bank Name", value: bank.bankName || "-" },
                      {
                          label: "Company",
                          value: (
                              <LinkedCompanyCell
                                  companyId={bank.companyId}
                                  companyName={bank.companyName || bank.company?.companyName}
                              />
                          ),
                      },
                      { label: "Remarks", value: bank.remarks || "-" },
                      { label: "Status", value: bank.status || "-" },
                  ],
              },
              {
                  title: "Audit",
                  rows: [
                      { label: "Added By", value: bank.addedByName || "-" },
                      { label: "Added Date", value: formatDate(bank.addedDate) },
                      { label: "Updated By", value: bank.updatedByName || "-" },
                      { label: "Updated Date", value: formatDate(bank.updatedDate) },
                  ],
              },
          ]
        : [];

    return (
        <SidePanel
            onClose={onClose}
            loading={loading}
            errorType={errorType}
            title="Bank Details"
            avatar={null}
            initials={bank?.bankCode?.substring(0, 2) || "BK"}
            name={bank?.bankName || ""}
            subtitle={bank?.bankCode || ""}
            status={bank?.status || ""}
            onMoreDetails={() => {
                onClose();
                router.push(`/bank/${currentId}`);
            }}
            moreDetailsId={currentId}
            sections={sections}
        />
    );
}
