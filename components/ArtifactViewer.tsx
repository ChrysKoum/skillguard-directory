"use client";

import { useState } from "react";
import { X, Copy, Check, FileCode, Download } from "lucide-react";

interface ArtifactViewerModalProps {
    artifacts: Array<{
        id: string;
        type: string;
        storage_path: string;
        download_url?: string;
    }>;
}

export function ArtifactViewer({ artifacts }: ArtifactViewerModalProps) {
    const [selectedArtifact, setSelectedArtifact] = useState<any>(null);
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const getArtifactLabel = (type: string) => {
        switch (type) {
            case "policy_json": return "Policy.json";
            case "report_json": return "Full Report.json";
            case "verification_md": return "Verification Plan";
            default: return type;
        }
    };

    const openArtifact = async (artifact: any) => {
        if (!artifact.download_url) return;

        setSelectedArtifact(artifact);
        setLoading(true);
        setCopied(false);

        try {
            const response = await fetch(artifact.download_url);
            const text = await response.text();
            setContent(text);
        } catch (err) {
            setContent("Failed to load artifact content.");
        } finally {
            setLoading(false);
        }
    };

    const closeModal = () => {
        setSelectedArtifact(null);
        setContent("");
        setCopied(false);
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <>
            {/* Artifact Buttons */}
            <div className="flex flex-wrap gap-2">
                {artifacts.map((art: any) => (
                    <button
                        key={art.id}
                        onClick={() => openArtifact(art)}
                        disabled={!art.download_url}
                        className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-300 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileCode className="w-4 h-4" />
                        {getArtifactLabel(art.type)}
                    </button>
                ))}
            </div>

            {/* Modal */}
            {selectedArtifact && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-700">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <FileCode className="w-5 h-5 text-indigo-400" />
                                {getArtifactLabel(selectedArtifact.type)}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={copyToClipboard}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" />
                                            Copy
                                        </>
                                    )}
                                </button>
                                <a
                                    href={selectedArtifact.download_url}
                                    download
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    Download
                                </a>
                                <button
                                    onClick={closeModal}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-4">
                            {loading ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                </div>
                            ) : (
                                <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words bg-slate-950 p-4 rounded-lg border border-slate-800">
                                    {content}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
