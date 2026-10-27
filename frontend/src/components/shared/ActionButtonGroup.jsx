import React from 'react';
import { ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function ActionBtn({ onClick, icon, label, variant = "blue", title, ...rest }) {
    const VARIANTS = {
        blue: "bg-blue-600 text-white hover:bg-blue-700",
        green: "bg-green-600 text-white hover:bg-green-700",
        amber: "bg-amber-500 text-white hover:bg-amber-600",
        outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    };
    return (
        <button type="button" onClick={onClick} title={title} {...rest} className={`flex items-center gap-1.5 rounded-sm px-4 py-2 text-sm font-semibold transition cursor-pointer ${VARIANTS[variant] ?? VARIANTS.outline}`}>
            {icon} {label}
        </button>
    );
}

export default function ActionButtonGroup({ allAvailable, plainCandidates = [], splitCandidateIds = [], dropdownOrder = [] }) {
    if (!allAvailable || allAvailable.length === 0) return null;

    const plainButtons = [];
    for (const c of plainCandidates) {
        const found = allAvailable.find(a => a.id === c);
        if (found && plainButtons.length < 2) plainButtons.push(found);
    }

    let splitMainAction = null;
    for (const c of splitCandidateIds) {
        const found = allAvailable.find(a => a.id === c);
        if (found) {
            splitMainAction = found;
            break;
        }
    }

    const shownIds = plainButtons.map(p => p.id);
    if (splitMainAction) shownIds.push(splitMainAction.id);

    const dropdownItems = [];
    for (const d of dropdownOrder) {
        const found = allAvailable.find(a => a.id === d);
        if (found && !shownIds.includes(found.id)) dropdownItems.push(found);
    }

    return (
        <>
            {plainButtons.map(action => (
                <ActionBtn key={action.id} onClick={action.onClick} icon={action.icon} label={action.label} variant={action.variant || "outline"} />
            ))}

            {(splitMainAction || dropdownItems.length > 0) && (
                (() => {
                    if (dropdownItems.length === 0 && splitMainAction) {
                        return <ActionBtn onClick={splitMainAction.onClick} icon={splitMainAction.icon} label={splitMainAction.label} variant="outline" />;
                    } else if (splitMainAction && dropdownItems.length > 0) {
                        return (
                            <div className="inline-flex items-stretch border border-gray-300 rounded-sm overflow-hidden bg-white shadow-sm transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-1">
                                <button
                                    onClick={splitMainAction.onClick}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors"
                                >
                                    {splitMainAction.icon}
                                    {splitMainAction.label}
                                </button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <div className="inline-flex items-center justify-center px-2 border-l border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors">
                                            <ChevronDown className="h-4 w-4" />
                                        </div>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border border-gray-100 p-1">
                                        {dropdownItems.map(action => (
                                            <DropdownMenuItem key={action.id} className={`cursor-pointer px-4 py-2 text-sm hover:bg-gray-100 ${action.textClass || 'text-gray-700'}`} onClick={(e) => { e.stopPropagation(); action.onClick(e); }}>
                                                <div className="flex items-center gap-2">
                                                    {action.icon}
                                                    {action.label}
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        );
                    } else if (!splitMainAction && dropdownItems.length > 0) {
                        return (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors">
                                        More <ChevronDown className="h-4 w-4" />
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border border-gray-100 p-1">
                                    {dropdownItems.map(action => (
                                        <DropdownMenuItem key={action.id} className={`cursor-pointer px-4 py-2 text-sm hover:bg-gray-100 ${action.textClass || 'text-gray-700'}`} onClick={(e) => { e.stopPropagation(); action.onClick(e); }}>
                                            <div className="flex items-center gap-2">
                                                {action.icon}
                                                {action.label}
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        );
                    }
                })()
            )}
        </>
    );
}
