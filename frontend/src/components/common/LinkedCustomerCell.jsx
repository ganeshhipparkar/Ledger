"use client";

import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { loginContext } from "../hooks/LoginContext";
import CustomerSidePanel from "../customer/CustomerSidePanel";

export default function LinkedCustomerCell({
    customerId,
    customerName,
    className = "",
}) {
    const { can } = useContext(loginContext) || {};
    const [panelOpen, setPanelOpen] = useState(false);

    const displayName = customerName || "-";
    const canView = Boolean(can && can("customerView") && customerId);

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
                    <CustomerSidePanel
                        customerId={customerId}
                        onClose={() => setPanelOpen(false)}
                    />,
                    document.body
                )}
        </>
    );
}
