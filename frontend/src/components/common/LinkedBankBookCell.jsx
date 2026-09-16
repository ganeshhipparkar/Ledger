"use client";

import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { loginContext } from "../hooks/LoginContext";
import BankBookSidePanel from "../bankBook/BankBookSidePanel";

export default function LinkedBankBookCell({
    bankBookId,
    bankBookName,
    className = "",
}) {
    const { can } = useContext(loginContext) || {};
    const [panelOpen, setPanelOpen] = useState(false);

    const displayName = bankBookName || "-";
    const canView = Boolean(can && can("bankBookView") && bankBookId);

    if (!canView) {
        return <span className={className || "text-gray-700 text-sm font-medium"}>{displayName}</span>;
    }

    return (
        <>
            <span
                className={
                    className ||
                    "text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                }
                onClick={(e) => {
                    e.stopPropagation();
                    setPanelOpen(true);
                }}
            >
                {displayName}
            </span>

            {panelOpen &&
                typeof document !== "undefined" &&
                createPortal(
                    <BankBookSidePanel
                        bankBookId={bankBookId}
                        onClose={() => setPanelOpen(false)}
                    />,
                    document.body
                )}
        </>
    );
}
