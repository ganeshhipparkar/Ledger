"use client";

export const STATUS_COLORS = {
    SUBMITTED: "bg-blue-100 text-blue-700 border-blue-200",
};

export function NoteStatusBadge({ status }) {
    const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
    const label = status ? status.charAt(0) + status.slice(1).toLowerCase() : "—";
    return (
        <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold ${cls}`}>
            {label}
        </span>
    );
}

export default NoteStatusBadge;
