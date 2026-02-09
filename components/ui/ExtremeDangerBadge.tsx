"use client";

import { motion } from "framer-motion";
import { AlertOctagon } from "lucide-react";

interface ExtremeDangerBadgeProps {
    evidence?: string[];
}

export function ExtremeDangerBadge({ evidence = [] }: ExtremeDangerBadgeProps) {
    return (
        <div className="group relative">
            <motion.div
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-900 to-red-700 border border-red-500 rounded-lg shadow-lg shadow-red-500/30"
                animate={{
                    boxShadow: [
                        "0 0 10px rgba(239, 68, 68, 0.3)",
                        "0 0 20px rgba(239, 68, 68, 0.5)",
                        "0 0 10px rgba(239, 68, 68, 0.3)"
                    ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
            >
                <AlertOctagon className="w-8 h-8 text-red-300" />
                <span className="text-xs font-bold text-red-100 tracking-wide">
                    EXTREME DANGER
                </span>
            </motion.div>

            {/* Tooltip with evidence */}
            {evidence.length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-80 p-3 bg-slate-900 border border-red-500/50 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                    <p className="font-bold text-red-400 mb-2 flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3" />
                        Prompt Injection Detected
                    </p>
                    <p className="text-slate-400 mb-2">
                        This skill contains patterns designed to manipulate or bypass security analysis:
                    </p>
                    <ul className="list-disc pl-3 space-y-1 text-red-300/90">
                        {evidence.slice(0, 5).map((e, i) => (
                            <li key={i}>{e}</li>
                        ))}
                        {evidence.length > 5 && (
                            <li className="text-slate-500">+{evidence.length - 5} more...</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
