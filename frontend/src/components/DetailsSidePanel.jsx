"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import { formatDate } from "@/lib/utils";
import LinkedCompanyCell from "./common/LinkedCompanyCell";
import SidePanel from "./common/SidePanel";
import { loginContext } from "./hooks/LoginContext";

function renderField(field, data, can, onLinkedRecordClick) {
    switch (field.type) {
        case "text":
            return data[field.key] ?? "-";

        case "text-fallback": {

            const primary = data[field.key];
            if (primary) return primary;
            if (field.fallbackPath) {
                const resolved = field.fallbackPath
                    .split(".")
                    .reduce((obj, k) => obj?.[k], data);
                return resolved || "-";
            }
            return "-";
        }

        case "date":
            return formatDate(data[field.key]);

        case "linked-company": {
            const companyId = data[field.companyIdKey];
            const companyName =
                data[field.companyNameKey] ||
                (field.companyFallbackPath
                    ? field.companyFallbackPath
                        .split(".")
                        .reduce((obj, k) => obj?.[k], data)
                    : undefined);
            return (
                <LinkedCompanyCell
                    companyId={companyId}
                    companyName={companyName}
                />
            );
        }

        case "linked-record": {
            const labelValue = data[field.labelKey];
            const idValue = data[field.idKey];
            if (!labelValue) return "-";
            const canView = field.permissionKey
                ? Boolean(can && can(field.permissionKey) && idValue)
                : false;
            return (
                <span
                    className={`font-medium ${canView
                        ? "text-blue-600 cursor-pointer hover:underline"
                        : "text-gray-800"
                        }`}
                    onClick={() =>
                        canView &&
                        onLinkedRecordClick &&
                        onLinkedRecordClick(idValue)
                    }
                >
                    {labelValue}
                </span>
            );
        }

        case "currency-display": {
            const code = data[field.currencyCodeKey];
            const symbol = data[field.currencySymbolKey];
            return code
                ? `${code}${symbol ? ` (${symbol})` : ""}`
                : "-";
        }

        case "attachments": {
            const list = data[field.key];
            if (!Array.isArray(list) || list.length === 0) return "-";
            return (
                <div className="flex flex-col gap-1.5 pt-1">
                    {list.map((att, idx) => {
                        const url = typeof att === "string" ? att : att?.attachmentUrl;
                        if (!url) return null;
                        const fileName = url.split("/").pop() || `Attachment ${idx + 1}`;
                        return (
                            <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 truncate max-w-xs font-medium"
                            >
                                📎 <span className="truncate">{fileName}</span>
                            </a>
                        );
                    })}
                </div>
            );
        }

        default:
            return data[field.key] ?? "-";
    }
}

export default function DetailsSidePanel({ config, id, onClose }) {
    const router = useRouter();
    const { can } = useContext(loginContext) || {};

    const [currentId, setCurrentId] = useState(id);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorType, setErrorType] = useState(null);

    useEffect(() => {
        if (id) setCurrentId(id);
    }, [id]);

    useEffect(() => {
        if (!currentId) return;
        fetchData(currentId);
    }, [currentId]);

    const fetchData = async (idToFetch) => {
        setLoading(true);
        setErrorType(null);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `${config.fetchEndpoint}/${idToFetch}`,
                    module: config.module,
                },
            });
            if (res.status === 403) {
                setErrorType("forbidden");
                return;
            }
            const payload = await res.json();
            const result = payload.encrypted
                ? decryptResponse(payload.encrypted)
                : payload;
            console.log(result, "resulet")
            if (result?.[config.idKey]) {
                setData(result);
            } else {
                setErrorType("not-found");
            }
        } catch (err) {
            console.error(`[DetailsSidePanel] fetch error for ${config.module}:`, err);
            setErrorType("not-found");
        } finally {
            setLoading(false);
        }
    };

    const handleLinkedRecordClick = (linkedId) => {
        if (!linkedId) return;
        setCurrentId(linkedId);
    };

    const sections = data
        ? config.sections.map((section) => ({
            title: section.title,
            rows: section.fields.map((field) => ({
                label: field.label,
                value: renderField(field, data, can, handleLinkedRecordClick),
            })),
        }))
        : [];

    const subtitleValue = data?.[config.subtitleKey] || "";
    const initials =
        subtitleValue.substring(0, 2).toUpperCase() || config.initialsPrefix;

    const detailsRoute = config.detailsRoute
        ? config.detailsRoute.replace("{id}", currentId)
        : null;

    return (
        <SidePanel
            onClose={onClose}
            loading={loading}
            errorType={errorType}
            title={config.title}
            avatar={null}
            initials={initials}
            name={data?.[config.nameKey] || ""}
            subtitle={subtitleValue}
            status={config.statusKey ? data?.[config.statusKey] || "" : ""}
            onMoreDetails={
                detailsRoute
                    ? () => {
                        onClose();
                        router.push(detailsRoute);
                    }
                    : null
            }
            moreDetailsId={currentId}
            sections={sections}
        />
    );
}
