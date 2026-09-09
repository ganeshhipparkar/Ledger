"use client";
import { Lock, UserX } from "lucide-react";
import Loader from "../ui/Loader";
import { useSlideOverPanel } from "../hooks/useSlideOverPanel";
import { statusBadge, getInitials } from "@/lib/utils";

export default function SidePanel({
    isOpen: externalIsOpen,
    onClose,
    loading = false,
    errorType = null,
    title = "Details",
    avatar = null, // string URL or null
    initials = null, // string or null
    name = "",
    subtitle = "",
    status = "",
    onMoreDetails = null,
    moreDetailsId = null,
    sections = [],
    customContent = null,
}) {
    const { isOpen, handleClose } = useSlideOverPanel(onClose, 300);

    const displayInitials = initials || getInitials(name);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isOpen ? "opacity-100" : "opacity-0"
                    }`}
                onClick={handleClose}
            />

            {/* Side panel */}
            <div
                className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl overflow-y-auto flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4 bg-white sticky top-0 z-10">
                    <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
                    <button
                        onClick={handleClose}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                    >
                        ✕
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center flex-1 transition-opacity duration-200">
                        <Loader label={`Loading ${title.toLowerCase()}...`} />
                    </div>
                ) : errorType ? (
                    errorType === "forbidden" ? (
                        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-4 shadow-sm border border-amber-100">
                                <Lock className="h-7 w-7" />
                            </div>
                            <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 mb-2">
                                Error 403
                            </span>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Access Restricted</h3>
                            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                                You don't have permission to view this details.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 mb-4 shadow-sm border border-red-100">
                                <UserX className="h-7 w-7" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">Not Found</h3>
                            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                                Item may have been removed.
                            </p>
                        </div>
                    )
                ) : (
                    <div className="flex-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
                        {/* Header Block: Avatar/Initials + name + subtitle + status */}
                        <div className="flex items-center gap-4 px-6 py-5 border-b bg-gray-50">
                            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-50 border shadow-sm flex-shrink-0 relative transition-transform hover:scale-105 duration-200">
                                {avatar ? (
                                    <img
                                        src={avatar}
                                        alt="avatar"
                                        className="h-full w-full object-cover transition-opacity duration-300"
                                        onError={(e) => {
                                            e.target.style.display = "none";
                                            if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                        }}
                                    />
                                ) : null}
                                <span
                                    style={{ display: avatar ? "none" : "flex" }}
                                    className="h-full w-full items-center justify-center text-xl font-bold text-blue-400 absolute inset-0 uppercase"
                                >
                                    {displayInitials}
                                </span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 text-base">{name}</h3>
                                {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
                                {status ? (
                                    <span className={`mt-1 transition-all duration-200 ${statusBadge(status)}`}>
                                        {status}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        {/* Optional More Details Button */}
                        {onMoreDetails && (
                            <div className="px-6 py-3 border-b">
                                <button
                                    onClick={() => onMoreDetails(moreDetailsId)}
                                    className="w-full rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 active:scale-[0.99] text-gray-800 font-medium text-sm py-2.5 transition-all duration-150 shadow-sm hover:shadow text-center"
                                >
                                    More Details
                                </button>
                            </div>
                        )}

                        {/* Info Sections */}
                        {sections.map((section, secIdx) => (
                            <div
                                key={secIdx}
                                className={`px-6 py-4 ${secIdx < sections.length - 1 || customContent ? "border-b" : ""}`}
                            >
                                {section.title && (
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                                        {section.title}
                                    </h4>
                                )}
                                <div className="space-y-3">
                                    {section.rows?.map((row, rowIdx) => (
                                        <div key={rowIdx} className="grid grid-cols-2 gap-2">
                                            <p className="text-sm text-gray-500">{row.label}</p>
                                            <div className="text-sm font-medium text-gray-800 break-all">
                                                {row.value ?? "N/A"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Custom content if any (e.g. assigned users list) */}
                        {customContent}
                    </div>
                )}
            </div>
        </>
    );
}
