"use client";
import { useEffect, useState } from "react";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import SidePanel from "../common/SidePanel";


export default function UserSidePanel({ userId, onClose, onMoreDetails }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorType, setErrorType] = useState(null);

    useEffect(() => {
        if (!userId) return;
        fetchUser();
    }, [userId]);

    const fetchUser = async () => {
        setLoading(true);
        setErrorType(null);
        try {
            const res = await fetch("/relayapi", {
                method: "GET",
                headers: {
                    ...authHeaders(),
                    endpoint: `user-details/${userId}`,
                    module: "user",
                },
            });

            if (res.status === 403 || res.status === 401) {
                setErrorType("forbidden");
                setUser(null);
                return;
            }

            const payload = await res.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            const isForbidden =
                data?.statusCode === 403 ||
                data?.statusCode === 401 ||
                data?.error === "Forbidden" ||
                data?.error === "Unauthorized" ||
                (typeof data?.message === "string" &&
                    (data.message.toLowerCase().includes("permission") ||
                        data.message.toLowerCase().includes("access denied") ||
                        data.message.toLowerCase().includes("forbidden") ||
                        data.message.toLowerCase().includes("unauthorized") ||
                        data.message.toLowerCase().includes("no profile assigned")));

            if (isForbidden) {
                setErrorType("forbidden");
                setUser(null);
            } else if (!res.ok || (data && (data.success === 0 || !data.userId))) {
                setErrorType("not-found");
                setUser(null);
            } else {
                setUser(data);
            }
        } catch (err) {
            console.error(err);
            setErrorType("not-found");
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const primary = user?.primaryProfile || user?.activeAssignment || null;

    const sections = user
        ? [
            {
                title: "Basic Info",
                rows: [
                    { label: "UserName", value: user.name || "N/A" },
                    { label: "Age", value: user.age ?? "N/A" },
                ],
            },
            {
                title: "Contact",
                rows: [
                    { label: "Email", value: user.email || "N/A" },
                    {
                        label: "Phone",
                        value: `${user.dialCode ? `+${user.dialCode} ` : ""}${user.phone || "N/A"}`,
                    },
                ],
            },
            {
                title: "Role & Company",
                rows: [
                    {
                        label: "Role",
                        value: primary?.groupName
                            ? primary.groupName.replace(/([A-Z])/g, " $1").trim()
                            : "N/A",
                    },
                    { label: "Company", value: primary?.companyName || "N/A" },
                ],
            },
        ]
        : [];

    const avatarUrl = user?.userFile
        ? `http://localhost:4000/upload/user/${user.userId}/${user.userFile}`

        : null;

    return (
        <SidePanel
            onClose={onClose}
            loading={loading}
            errorType={!user && !loading ? errorType || "not-found" : null}
            title="User Details"
            avatar={avatarUrl}
            initials={user?.name?.charAt(0) ?? "U"}
            name={user?.name || ""}
            subtitle={user?.email || ""}
            status={user?.status || ""}
            onMoreDetails={onMoreDetails}
            moreDetailsId={userId}
            sections={sections}
        />
    );
}