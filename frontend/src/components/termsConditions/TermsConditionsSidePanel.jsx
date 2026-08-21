"use client";
import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import SidePanel from "../common/SidePanel";
import LinkedCompanyCell from "../common/LinkedCompanyCell";
import { loginContext } from "../hooks/LoginContext";

export default function TermsConditionsSidePanel({ termsConditionsId, onClose }) {
    const router = useRouter();
    const { can } = useContext(loginContext);
    const [currentId, setCurrentId] = useState(termsConditionsId);
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorType, setErrorType] = useState(null);

    useEffect(() => {
        if (termsConditionsId) {
            setCurrentId(termsConditionsId);
        }
    }, [termsConditionsId]);

    useEffect(() => {
        if (!currentId) return;
        fetchDetails(currentId);
    }, [currentId]);

    const fetchDetails = async (idToFetch) => {
        setLoading(true);
        setErrorType(null);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `terms-conditions-details/${idToFetch}`,
                    module: "terms-conditions",
                },
            });
            if (res.status === 403) {
                setErrorType("forbidden");
                return;
            }
            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (data?.termsConditionsId) {
                setItem(data);
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

    const sections = item
        ? [
              {
                  title: "Details",
                  rows: [
                      { label: "Code", value: item.code || "-" },
                      { label: "Title", value: item.title || "-" },
                      {
                          label: "Company",
                          value: (
                              <LinkedCompanyCell
                                  companyId={item.companyId}
                                  companyName={item.companyName || item.company?.companyName}
                              />
                          ),
                      },
                      { label: "Content", value: (item.content ? <span className="line-clamp-3" title={item.content}>{item.content}</span> : "-") },
                  ],
              },
          ]
        : [];

    return (
        <SidePanel
            onClose={onClose}
            loading={loading}
            errorType={errorType}
            title="Terms & Conditions Preview"
            avatar={null}
            initials={item?.code?.substring(0, 2) || "TC"}
            name={item?.title || ""}
            subtitle={item?.code || ""}
            onMoreDetails={() => {
                onClose();
                router.push(`/terms-conditions/${currentId}`);
            }}
            moreDetailsId={currentId}
            sections={sections}
        />
    );
}
