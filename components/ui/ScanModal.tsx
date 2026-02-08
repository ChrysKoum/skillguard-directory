"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Terminal, AlertTriangle, X } from "lucide-react";

interface ScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: "idle" | "scanning" | "error" | "complete";
    logs: string[];
    errorMsg?: string;
}

export function ScanModal({ isOpen, onClose, status, logs, errorMsg }: ScanModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                onClick={status !== "scanning" ? onClose : undefined}
            />

            {/* Modal Card */}
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-10"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                        {status === "scanning" ? (
                            <>
                                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                                Deep Audit in Progress
                            </>
                        ) : status === "error" ? (
                            <span className="text-red-400 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Scan Failed
                            </span>
                        ) : (
                            "Scan Complete"
                        )}
                    </h3>

                    {status !== "scanning" && (
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    {status === "error" && errorMsg && (
                        <div className="mb-4 bg-red-950/50 border border-red-900 rounded-lg p-3 text-sm text-red-200">
                            {errorMsg}
                        </div>
                    )}

                    <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 font-mono text-xs text-green-400 h-64 overflow-y-auto">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2 text-slate-500 sticky top-0 bg-slate-950">
                            <Terminal className="w-3 h-3" />
                            <span>LIVE LOGS</span>
                        </div>
                        <div className="space-y-1">
                            {logs.map((l, i) => (
                                <div key={i}>{l}</div>
                            ))}
                            {status === "scanning" && <div className="animate-pulse">_</div>}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
