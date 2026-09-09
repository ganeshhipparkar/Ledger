"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { FileText, Bold, Italic, UnderlineIcon, List, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { authHeaders } from "@/app/lib/auth";
import { decryptResponse } from "@/app/lib/crypto";
import MultiFilePicker from "../common/MultiFilePicker";

export default function TermsConditionsWidget({
    companyId,
    termsConditionsFile,
    termsConditionsId,
    termsConditionsText,
    onFileChange,        // (file | null) => void
    onTemplateChange,    // (templateId | null) => void
    onTextChange,        // (html string) => void
    existingFileName,    // string — shown in update form when a file already exists
}) {
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({ types: ["heading", "paragraph"] }),
        ],
        content: termsConditionsText || "",
        immediatelyRender: false,
        onUpdate({ editor }) {
            onTextChange?.(editor.getHTML());
        },
    });

    // Sync initial content when editing existing quotation
    useEffect(() => {
        if (editor && termsConditionsText && editor.isEmpty) {
            editor.commands.setContent(termsConditionsText);
        }
    }, [termsConditionsText, editor]);

    // Sync initial template selection
    useEffect(() => {
        if (termsConditionsId) {
            setSelectedTemplate(String(termsConditionsId));
        }
    }, [termsConditionsId]);

    // Fetch templates (scoped by companyId)
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const filters = companyId ? [{ key: "companyId", value: String(companyId), operator: "eq" }] : [];
                const res = await fetch("/relayapi", {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        endpoint: "terms-conditions-list",
                        module: "terms-conditions",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ page: 1, limit: 200, ...(filters.length ? { filters } : {}) }),
                });
                const payload = await res.json();
                const data = payload.encrypted ? decryptResponse(payload.encrypted) : payload;
                setTemplates(data?.data ?? []);
            } catch {
                setTemplates([]);
            }
        };
        fetchTemplates();
    }, [companyId]);

    const handleTemplateSelect = (e) => {
        const val = e.target.value;
        setSelectedTemplate(val);
        onTemplateChange?.(val ? Number(val) : null);

        // Load template content into editor
        if (val && editor) {
            const tpl = templates.find((t) => String(t.termsConditionsId) === String(val));
            const templateText = tpl?.content || tpl?.termsConditionsText || "";
            if (templateText) {
                editor.commands.setContent(templateText);
                onTextChange?.(templateText);
            }
        }
    };

    const ToolbarBtn = ({ onClick, active, title, children }) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`p-1.5 rounded transition text-sm font-medium cursor-pointer ${active ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
        >
            {children}
        </button>
    );

    return (
        <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                Terms and Conditions
            </h3>

            {/* File Upload Zone (using MultiFilePicker in single-file PDF mode) */}
            <div>
                <MultiFilePicker
                    accept="application/pdf"
                    multiple={false}
                    label="Upload Terms and Conditions"
                    selectedFiles={termsConditionsFile ? [termsConditionsFile] : []}
                    onFilesChange={(files) => onFileChange?.(files[0] || null)}
                    existingAttachments={
                        existingFileName && !termsConditionsFile
                            ? [{ id: "existing-tc", attachmentUrl: existingFileName }]
                            : []
                    }
                    onDeleteExisting={() => onFileChange?.(null)}
                />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">OR</span>
                <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Template Selector */}
            <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Select Template</p>
                <select
                    value={selectedTemplate || ""}
                    onChange={handleTemplateSelect}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                    <option value="">-- Select a template --</option>
                    {templates.map((t) => (
                        <option key={t.termsConditionsId} value={t.termsConditionsId}>
                            {t.title || t.termsConditionsName || t.termsConditionsTitle || t.code || `Template #${t.termsConditionsId}`}
                        </option>
                    ))}
                </select>
            </div>

            {/* TipTap Editor */}
            {editor && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <p className="text-xs font-medium text-gray-500 px-3 pt-3 pb-1">Edit / Append Template</p>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-2 py-1.5 bg-gray-50">
                        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
                            <Bold className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
                            <Italic className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
                            <UnderlineIcon className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <div className="w-px h-4 bg-gray-300 mx-1" />
                        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align Left">
                            <AlignLeft className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align Center">
                            <AlignCenter className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align Right">
                            <AlignRight className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                        <div className="w-px h-4 bg-gray-300 mx-1" />
                        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
                            <List className="h-3.5 w-3.5" />
                        </ToolbarBtn>
                    </div>
                    <EditorContent
                        editor={editor}
                        className="min-h-[180px] max-h-[340px] overflow-y-auto px-4 py-3 text-sm text-gray-800 prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:outline-none"
                    />
                    <div className="flex justify-end px-3 py-1.5 bg-gray-50 border-t border-gray-200">
                        <span className="text-xs text-gray-400">
                            Words: {editor.storage?.characterCount?.words?.() ?? editor.getText().split(/\s+/).filter(Boolean).length}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
