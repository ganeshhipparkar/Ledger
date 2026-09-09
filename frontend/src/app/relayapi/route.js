import { NextResponse } from "next/server";
import { decryptResponse } from "../lib/crypto";

function getServiceBase(request) {
    const module = request.headers.get("module");
    if (module === "company") return "http://localhost:4000/company";
    if (module === "group") return "http://localhost:4000/group";
    if (module === "user") return "http://localhost:4000/user";
    if (module === "activity") return "http://localhost:4000/activity";
    if (module === "currency") return "http://localhost:4000/currency";
    if (module === "item-category") return "http://localhost:4000/item-category";
    if (module === "item") return "http://localhost:4000/item";
    if (module === "manufacturer") return "http://localhost:4000/manufacturer";
    if (module === "brand") return "http://localhost:4000/brand";
    if (module === "uom") return "http://localhost:4000/uom";
    if (module === "package") return "http://localhost:4000/package";
    if (module === "customer") return "http://localhost:4000/customer";
    if (module === "bank") return "http://localhost:4000/bank";
    if (module === "bank-book") return "http://localhost:4000/bank-book";
    if (module === "terms-conditions") return "http://localhost:4000/terms-conditions";
    if (module === 'tax-group') return "http://localhost:4000/tax-group";
    if (module === 'quotation') return "http://localhost:4000/quotation";
    if (module === "order") return "http://localhost:4000/order";

    if (module === "payment-transaction") return "http://localhost:4000/payment-transaction";
    if (module === "quotation") return "http://localhost:4000/quotation";
    return "http://localhost:4000";
}

function getAuthToken(request) {
    const impToken = request.cookies.get("impersonationToken")?.value;
    if (impToken) {
        return `Bearer ${impToken}`;
    }
    const cookieToken = request.cookies.get("accessToken")?.value;
    if (cookieToken) {
        return `Bearer ${cookieToken}`;
    }
    return null;
}

async function doFetch(url, options = {}) {
    const res = await fetch(url, options);
    const raw = await res.text();
    let payload;
    try {
        payload = JSON.parse(raw);
    } catch {
        payload = raw;
    }
    return { res, payload };
}

export async function GET(request) {
    try {
        const endpoint = request.headers.get("endpoint");
        const token = getAuthToken(request);
        const base = getServiceBase(request);

        const fetchHeaders = {};
        if (token) fetchHeaders["Authorization"] = token;

        const { res, payload } = await doFetch(`${base}/${endpoint}`, {
            method: "GET",
            headers: fetchHeaders,
        });

        return NextResponse.json(payload, { status: res.status });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: 0, message: "Server error" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const endpoint = request.headers.get("endpoint");
        const contentType = request.headers.get("content-type") || "";
        const token = getAuthToken(request);
        const base = getServiceBase(request);

        if (endpoint === "user-stop-impersonating") {
            let bodyObj = {};
            try {
                bodyObj = await request.json();
            } catch (e) { }

            try {
                await fetch(`${base}/user-stop-impersonating`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": token,
                    },
                    body: JSON.stringify(bodyObj),
                });
            } catch (err) {
                console.error("Failed to forward stop impersonating log to backend:", err);
            }

            const nextRes = NextResponse.json({ success: 1 });
            nextRes.cookies.set("impersonationToken", "", {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: 0,
                expires: new Date(0),
            });
            return nextRes;
        }

        let body;
        const fetchHeaders = {};
        if (token) fetchHeaders["Authorization"] = token;
        if (contentType.includes("application/json")) {
            try {
                const text = await request.text();
                if (text && text.trim().length > 0) {
                    body = text;
                    fetchHeaders["Content-Type"] = "application/json";
                }
            } catch (e) {
                body = undefined;
            }
        } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
            try {
                body = await request.formData();
            } catch (e) {
                body = undefined;
            }
        }

        const { res, payload } = await doFetch(`${base}/${endpoint}`, {
            method: "POST",
            headers: fetchHeaders,
            body,
        });

        const nextRes = NextResponse.json(payload, { status: res.status });

        if (endpoint === "user-login") {

        } else if (endpoint === "user-select-profile") {
            const decrypted = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (decrypted.success === 1) {
                const loginToken = res.headers.get("x-auth-token");
                if (loginToken) {
                    nextRes.cookies.set("accessToken", loginToken, {
                        httpOnly: true,
                        sameSite: "lax",
                        secure: process.env.NODE_ENV === "production",
                        path: "/",
                    });
                }
            }
        } else if (endpoint === "user-login-as") {
            const decrypted = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (decrypted.success === 1) {
                const impToken = res.headers.get("x-impersonation-token");
                if (impToken) {
                    nextRes.cookies.set("impersonationToken", impToken, {
                        httpOnly: true,
                        sameSite: "lax",
                        secure: process.env.NODE_ENV === "production",
                        path: "/",
                    });
                }
            }
        } else if (endpoint === "user-switch-profile") {
            const decrypted = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
            if (decrypted.success === 1) {
                const impToken = res.headers.get("x-impersonation-token");
                const authToken = res.headers.get("x-auth-token");
                if (impToken) {
                    nextRes.cookies.set("impersonationToken", impToken, {
                        httpOnly: true,
                        sameSite: "lax",
                        secure: process.env.NODE_ENV === "production",
                        path: "/",
                    });
                } else if (authToken) {
                    nextRes.cookies.set("accessToken", authToken, {
                        httpOnly: true,
                        sameSite: "lax",
                        secure: process.env.NODE_ENV === "production",
                        path: "/",
                    });
                }
            }
        } else if (endpoint === "user-logout") {
            nextRes.cookies.set("accessToken", "", {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: 0,
                expires: new Date(0),
            });
            nextRes.cookies.set("impersonationToken", "", {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: 0,
                expires: new Date(0),
            });
        }

        return nextRes;
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: 0, message: "Server error" }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const endpoint = request.headers.get("endpoint");
        const contentType = request.headers.get("content-type") || "";
        const token = getAuthToken(request);
        const base = getServiceBase(request);

        let body;
        const fetchHeaders = {};
        if (token) fetchHeaders["Authorization"] = token;
        if (contentType.includes("application/json")) {
            try {
                const text = await request.text();
                if (text && text.trim().length > 0) {
                    body = text;
                    fetchHeaders["Content-Type"] = "application/json";
                }
            } catch (e) {
                body = undefined;
            }
        } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
            try {
                body = await request.formData();
            } catch (e) {
                body = undefined;
            }
        }

        const { res, payload } = await doFetch(`${base}/${endpoint}`, {
            method: "PUT",
            headers: fetchHeaders,
            body,
        });

        return NextResponse.json(payload, { status: res.status });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: 0, message: "Server error" }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const endpoint = request.headers.get("endpoint");
        const token = getAuthToken(request);
        const base = getServiceBase(request);

        const fetchHeaders = {};
        if (token) fetchHeaders["Authorization"] = token;

        const { res, payload } = await doFetch(`${base}/${endpoint}`, {
            method: "DELETE",
            headers: fetchHeaders,
        });

        return NextResponse.json(payload, { status: res.status });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: 0, message: "Server error" }, { status: 500 });
    }
}