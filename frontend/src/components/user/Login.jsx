"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loginContext } from "../hooks/LoginContext";
import { userLoginSchema } from "../Zod";
import { toast } from "react-toastify";
import { decryptResponse } from "@/app/lib/crypto";


async function callSelectProfile(userId, ucgId) {
    const res = await fetch("/relayapi", {
        method: "POST",
        headers: {
            endpoint: "user-select-profile",
            "Content-Type": "application/json",
            module: "user",
        },
        body: JSON.stringify({ userId, ucgId }),
    });
    const payload = await res.json();
    return payload.encrypted ? decryptResponse(payload.encrypted) : payload;
}

const GROUP_COLOURS = {
    superAdmin: { bg: "#f0f4ff", border: "#6366f1", badge: "#6366f1", text: "#3730a3" },
    companyAdmin: { bg: "#f0fdf4", border: "#22c55e", badge: "#22c55e", text: "#166534" },
    warehouseAdmin: { bg: "#fff7ed", border: "#f97316", badge: "#f97316", text: "#9a3412" },
    user: { bg: "#f0f9ff", border: "#0ea5e9", badge: "#0ea5e9", text: "#0c4a6e" },
};

function groupColour(groupName) {
    return GROUP_COLOURS[groupName] ?? {
        bg: "#f8fafc", border: "#94a3b8", badge: "#64748b", text: "#1e293b",
    };
}


function ProfileCard({ assignment, selected, onSelect }) {
    const colours = groupColour(assignment.groupName);
    return (
        <button
            type="button"
            id={`profile-card-${assignment.id}`}
            onClick={() => onSelect(assignment)}
            style={{
                background: selected ? colours.bg : "#fff",
                border: `1px solid ${selected ? colours.border : "#e2e8f0"}`,
                borderRadius: "8px",
                padding: "16px 20px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.18s ease",
                outline: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: selected ? `0 0 0 1px ${colours.border}` : "none",
                width: "100%",
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontWeight: 600, fontSize: "15px", color: "#1e293b" }}>
                    {assignment.companyName}
                </span>
                <span style={{ fontSize: "13px", color: "#64748b" }}>
                    {assignment.groupName}
                </span>
            </div>

            <div style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: selected ? colours.border : "#e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
            }}>
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        </button>
    );
}


export default function LoginPage() {
    const { login } = useContext(loginContext);
    const route = useRouter();

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [errors, setErrors] = useState({ email: "", password: "" });
    const [formData, setFormData] = useState({ email: "", password: "" });

    const [step, setStep] = useState("credentials"); // 'credentials' | 'select-profile'
    const [pendingAuth, setPendingAuth] = useState(null); // { userId, email, name, activeAssignments }
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [proceedLoading, setProceedLoading] = useState(false);

    useEffect(() => {
        const savedRaw = localStorage.getItem("rememberMeCredentials");
        if (savedRaw) {
            try {
                const parsed = JSON.parse(savedRaw);
                setFormData({ email: parsed.email || "", password: "" });
                setRememberMe(true);
            } catch {
                localStorage.removeItem("rememberMeCredentials");
            }
        }
    }, []);

    const handleChange = (e) => {
        const updated = { ...formData, [e.target.id]: e.target.value };
        setFormData(updated);
        setErrors({ ...errors, [e.target.id]: "" });
        if (rememberMe) saveRememberMeIdentifier(updated);
    };

    function saveRememberMeIdentifier(data) {
        localStorage.setItem("rememberMeCredentials", JSON.stringify({ email: data.email }));
    }

    const handleRememberMe = (e) => {
        const checked = e.target.checked;
        setRememberMe(checked);
        if (checked) saveRememberMeIdentifier(formData);
        else localStorage.removeItem("rememberMeCredentials");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = userLoginSchema.safeParse(formData);
        setLoading(true);
        setMessage("");
        setErrors({ email: "", password: "" });

        try {
            if (!result.success) {
                const fieldErrors = { email: "", password: "" };
                result.error.issues.forEach((err) => {
                    const field = err.path[0];
                    if (field && !fieldErrors[field]) fieldErrors[field] = err.message;
                });
                setErrors(fieldErrors);
                return;
            }

            if (rememberMe) saveRememberMeIdentifier(formData);

            const response = await fetch("/relayapi", {
                method: "POST",
                headers: {
                    endpoint: "user-login",
                    "Content-Type": "application/json",
                    module: "user",
                },
                body: JSON.stringify(formData),
            });

            const payload = await response.json();
            const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;

            if (!response.ok || data.success !== 1) {
                const msg = data.message || "Login failed";
                toast.error(msg, { position: "top-right" });
                setMessage(msg);
                return;
            }

            const { userId, email, name, activeAssignments = [] } = data;

            if (activeAssignments.length === 0) {
                const msg = "Your account has no active profiles. Please contact your administrator.";
                toast.error(msg, { position: "top-right" });
                setMessage(msg);
                return;
            }
            if (activeAssignments.length === 1) {
                await doSelectProfile(userId, activeAssignments[0], name);
                return;
            }

            setPendingAuth({ userId, email, name, activeAssignments });
            setSelectedAssignment(null);
            setStep("select-profile");

        } catch (error) {
            console.error(error);
            setMessage("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    async function doSelectProfile(userId, assignment, displayName) {
        try {
            const data = await callSelectProfile(userId, assignment.id);
            if (data.success === 1 && data.user?.userId) {
                login(data);
                sessionStorage.setItem("welcomeToastName", data.user?.name || displayName || "");
                window.location.href = "/";
            } else {
                const msg = data.message || "Profile selection failed";
                toast.error(msg, { position: "top-right" });
                setMessage(msg);
            }
        } catch {
            setMessage("Something went wrong during profile selection");
        }
    }

    const handleProceed = async () => {
        if (!selectedAssignment || !pendingAuth) return;
        setProceedLoading(true);
        await doSelectProfile(pendingAuth.userId, selectedAssignment, pendingAuth.name);
        setProceedLoading(false);
    };

    const handleBack = () => {
        setStep("credentials");
        setPendingAuth(null);
        setSelectedAssignment(null);
        setMessage("");
    };

    return (
        <div className="grid grid-cols-2 h-screen">

            <div className="relative bg-white flex flex-col justify-center px-24">
                <div className="absolute top-6 left-6">
                    <img src="/logo.png" className="h-16" alt="Logo" />
                </div>

                {step === "credentials" && (
                    <div className="max-w-md ms-24">
                        <h1 className="text-3xl font-semibold text-gray-900 mb-2">
                            Log in to {process.env.NEXT_PUBLIC_SYSTEM_NAME ?? 'Sales Portal'}
                        </h1>
                        <p className="text-gray-500 mb-10">Enter your credentials to continue</p>
                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div>
                                <label className="block text-sm text-gray-600 mb-2">
                                    Email <span className="text-red-500 text-[16px]">*</span>
                                </label>
                                <input
                                    id="email"
                                    type="text"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Enter email"
                                    className={`text-black w-full border rounded-lg px-4 py-3 outline-none focus:ring-2 ${errors.email
                                        ? "border-red-500 focus:ring-red-500"
                                        : "border-gray-200 focus:ring-blue-500"
                                        }`}
                                />
                                {errors.email && (
                                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                                )}
                            </div>
                            <div className="relative">
                                <label className="block text-sm text-gray-600 mb-2">
                                    Password <span className="text-red-500 text-[16px]">*</span>
                                </label>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter password"
                                    className={`text-black w-full border rounded-lg px-4 py-3 pr-20 outline-none focus:ring-2 ${errors.password
                                        ? "border-red-500 focus:ring-red-500"
                                        : "border-gray-200 focus:ring-blue-500"
                                        }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                >
                                    <img
                                        src={showPassword ? "/password/hidden.png" : "/password/eye.png"}
                                        alt=""
                                        className="w-5 h-5 object-contain opacity-60 hover:opacity-100 transition mt-5"
                                    />
                                </button>
                                {errors.password && (
                                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-black flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={handleRememberMe}
                                    />
                                    <span className="ps-2">Remember Me</span>
                                </label>
                                <a href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                    Forgot Password?
                                </a>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition disabled:bg-gray-400 mt-2"
                            >
                                {loading ? "Verifying…" : "Login"}
                            </button>
                            {message && (
                                <p className={`text-center font-medium ${message === "success" ? "text-green-500" : "text-red-500"}`}>
                                    {message}
                                </p>
                            )}
                        </form>
                    </div>
                )}

                {step === "select-profile" && pendingAuth && (
                    <div className="max-w-md w-full mx-auto">
                        <h1 className="text-xl font-normal text-gray-900 mb-2">
                            Welcome <span className="text-blue-600 font-medium">{pendingAuth.name}</span>,
                        </h1>
                        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                            Hello, <strong>{pendingAuth.name}</strong>. Select the profile you'd like to use for this session.                        </p>

                        <h2 className="text-base font-semibold text-gray-900 mb-3">
                            Select Company
                        </h2>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
                            {pendingAuth.activeAssignments.map((a) => (
                                <ProfileCard
                                    key={a.id}
                                    assignment={a}
                                    selected={selectedAssignment?.id === a.id}
                                    onSelect={async (a) => {
                                        if (proceedLoading) return;
                                        setSelectedAssignment(a);
                                        setProceedLoading(true);
                                        await doSelectProfile(pendingAuth.userId, a, pendingAuth.name);
                                        setProceedLoading(false);
                                    }}
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleBack}
                            className="w-full py-3 rounded-lg border border-blue-600 text-blue-600 font-medium hover:bg-blue-50 transition"
                        >
                            Log Out
                        </button>

                        {message && (
                            <p className="text-center font-medium text-red-500 mt-4">{message}</p>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-blue-200 flex justify-center items-center h-screen">
                {step === "credentials" && (
                    <img
                        src={process.env.NEXT_PUBLIC_LOGO_RIGHT}
                        className="max-h-full max-w-full object-contain"
                        alt="Login Illustration"
                    />
                )}
                {step === "select-profile" && pendingAuth && (
                    <img
                        src={process.env.NEXT_PUBLIC_SELECT_PROFILE_LOGO}
                        className="max-h-full max-w-full object-contain"
                        alt="Login Illustration"
                    />
                )}
            </div>
        </div>
    );
}
