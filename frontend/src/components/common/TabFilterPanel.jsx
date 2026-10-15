"use client";
import React from "react";
import { createPortal } from "react-dom";

export default function TabFilterPanel({
    isOpen,
    onClose,
    fieldsConfig = [],
    filters = {},
    onChange,
    onReset,
}) {
    if (typeof document === "undefined") return null;

    const content = (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/10 transition-opacity"
                    onClick={onClose}
                />
            )}

            <div
                className={`fixed top-0 right-0 h-full w-[300px] bg-white border-l border-gray-200 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex items-center justify-between px-5 py-4 bg-blue-600">
                    <h2 className="text-white font-semibold text-base">
                        Filters
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white hover:text-blue-200 text-xl cursor-pointer transition-colors"
                        aria-label="Close filters"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-5 overflow-y-auto h-[calc(100%-64px)]">
                    {fieldsConfig.map((field) => {
                        const isSelect = Array.isArray(field.options) && field.options.length > 0;
                        const value = filters[field.id] ?? "";

                        return (
                            <div key={field.id}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {field.label}
                                </label>

                                {isSelect ? (
                                    <select
                                        value={value}
                                        onChange={(e) => onChange?.(field.id, e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-black bg-white cursor-pointer"
                                    >
                                        {field.options.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => onChange?.(field.id, e.target.value)}
                                        placeholder={`Please enter ${field.label}`}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 text-black"
                                    />
                                )}
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={onReset}
                        className="mt-2 w-full border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 cursor-pointer transition-colors font-medium"
                    >
                        Reset Filters
                    </button>
                </div>
            </div>
        </>
    );

    return createPortal(content, document.body);
}
