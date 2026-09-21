"use client";

export function getUserInfo() {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem("userInfo");
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function isSuperAdmin(userInfo) {
    if (!userInfo) return false;
    const groupCode = userInfo?.primaryProfile?.groupCode || userInfo?.groupCode;
    if (!groupCode) return false;
    const codes = Array.isArray(groupCode) ? groupCode : [groupCode];
    return codes.includes("admin");
}

export function isCompanyAdmin(userInfo) {
    if (!userInfo) return false;
    const groupCode = userInfo?.primaryProfile?.groupCode || userInfo?.groupCode;
    if (!groupCode) return false;
    const codes = Array.isArray(groupCode) ? groupCode : [groupCode];
    return codes.includes("CA");
}

export function canUpdateUsers(userInfo) {
    return isSuperAdmin(userInfo) || isCompanyAdmin(userInfo);
}

export function canSeeAllCompaniesAndGroups(userInfo) {
    return isSuperAdmin(userInfo);
}

export function authHeaders(extra = {}) {
    return {
        "Content-Type": "application/json",
        ...extra,
    };
}
