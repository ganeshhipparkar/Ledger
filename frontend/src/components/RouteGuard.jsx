"use client";
import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginContext } from "./hooks/LoginContext";

export default function RouteGuard({ permission, isSuperAdminOnly = false, children }) {
    const { isLogin, can, authReady } = useContext(loginContext);
    const router = useRouter();

    const [authState, setAuthState] = useState("loading"); // "loading" | "ok" | "denied"

    useEffect(() => {
        checkAccess();
    }, [authReady, isLogin]);

    function checkAccess() {
        if (!authReady && !isLogin) return;

        if (authReady && !isLogin) {
            router.replace("/login");
            setAuthState("denied");
            return;
        }

        if (!isLogin) return;

        // superAdmin-only pages
        if (isSuperAdminOnly) {
            const primaryCode =
                isLogin?.primaryProfile?.groupCode || isLogin?.groupCode || "";
            const codes = Array.isArray(primaryCode) ? primaryCode : [primaryCode];
            if (!codes.includes("admin")) {
                router.replace("/forbidden");
                setAuthState("denied");
                return;
            }
        }

        // Permission-gated pages
        if (permission && !can(permission)) {
            router.replace("/forbidden");
            setAuthState("denied");
            return;
        }

        setAuthState("ok");
    }

    if (authState === "denied") return null;

    return children;
}
