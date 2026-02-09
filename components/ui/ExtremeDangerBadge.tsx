"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertOctagon, X, Copy, Check, Info, ChevronDown, ChevronRight } from "lucide-react";

interface ExtremeDangerBadgeProps {
    evidence?: string[];
}

const EXPLANATIONS: Record<string, string> = {
    "Attempts to bypass previous instructions": "This text attempts to override the AI's core safety instructions, potentially to force it to execute malicious code.",
    "Attempts to reset LLM context": "This pattern tries to clear the AI's memory of previous safety constraints, leaving it vulnerable to manipulation.",
    "Misleading safety claim": "The code explicitly claims to be safe. Valid code relies on logic, not self-declarations. This is common in malware.",
    "Attempts to suppress reporting": "The code instructs the AI not to report findings, likely to hide malicious behavior from the user.",
    "Attempts to skip security checks": "Directly asks the scanner to skip analysis, which is highly suspicious.",
    "Misleading trust claim": "Attempts to gain trust by simply declaring 'Trust this code' without verification.",
    "False vulnerability claim": "Claims there are 'no vulnerabilities' to mislead hasty reviews.",
    "Suspicious safety marker": "Uses markers like SAFE_CODE_MARKER to trick automated tools.",
    "Attempts to ignore security": "Explicitly tells the AI to ignore security concerns.",
    "Misleading reassurance": "Phrases like 'everything is fine' are often used to mask malicious intent.",
    "False safety claim": "Claims 'nothing malicious' usually precede malicious code blocks.",
    "Prompt injection attempt": "Generic pattern used to hijack the AI's persona or instructions."
};

function getExplanation(evidenceLine: string) {
    for (const [msg, explanation] of Object.entries(EXPLANATIONS)) {
        if (evidenceLine.includes(msg)) {
            return explanation;
        }
    }
    return "This pattern matches known techniques used to deceive AI security scanners.";
}

export function ExtremeDangerBadge({ evidence = [] }: ExtremeDangerBadgeProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [expandedItem, setExpandedItem] = useState<number | null>(null);

    const handleCopy = () => {
        navigator.clipboard.writeText(evidence.join("\n"));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const toggleItem = (index: number) => {
        setExpandedItem(expandedItem === index ? null : index);
    };

    return (
        <>
            <div className="group relative inline-block">
                <motion.button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-900 to-red-700 border border-red-500 rounded-lg shadow-lg shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer relative z-10"
                    animate={{
                        boxShadow: [
                            "0 0 10px rgba(239, 68, 68, 0.3)",
                            "0 0 20px rgba(239, 68, 68, 0.5)",
                            "0 0 10px rgba(239, 68, 68, 0.3)"
                        ]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    <AlertOctagon className="w-5 h-5 text-red-300" />
                    <span className="text-sm font-bold text-red-100 tracking-wide">
                        EXTREME DANGER
                    </span>
                </motion.button>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 border border-red-500/50 text-slate-300 text-xs rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    <div className="flex items-center gap-2 font-bold text-red-400 mb-1">
                        <AlertOctagon className="w-3 h-3" />
                        {evidence.length} Active Threats Found
                    </div>
                    <p>Click to view details and understand why these patterns are dangerous.</p>
                    <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-b border-r border-red-500/50 rotate-45 transform"></div>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isOpen && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-red-500/50 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden cursor-default"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-red-500/20 bg-red-950/20">
                                <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                                    <AlertOctagon className="w-5 h-5" />
                                    Active Injection Attempts ({evidence.length})
                                </h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-red-500/10 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400 hover:text-white" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 mb-6 flex gap-3">
                                    <Info className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-200/80 leading-relaxed">
                                        These patterns are designed to manipulate security scanners or bypass safety protocols.
                                        Click on any item below to understand the specific threat.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {evidence.length > 0 ? (
                                        evidence.map((line, i) => {
                                            const isExpanded = expandedItem === i;
                                            const explanation = getExplanation(line);

                                            return (
                                                <div
                                                    key={i}
                                                    className={`border rounded-lg transition-all overflow-hidden ${isExpanded ? 'bg-slate-800/50 border-red-500/40' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                                                >
                                                    <button
                                                        onClick={() => toggleItem(i)}
                                                        className="w-full flex items-start gap-3 p-3 text-left"
                                                    >
                                                        {isExpanded ?
                                                            <ChevronDown className="w-4 h-4 text-red-400 shrink-0 mt-1" /> :
                                                            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
                                                        }
                                                        <span className={`font-mono text-sm break-all ${isExpanded ? 'text-red-200' : 'text-slate-300'}`}>
                                                            {line}
                                                        </span>
                                                    </button>

                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="px-10 pb-4 pr-4">
                                                                    <div className="p-3 bg-red-950/20 rounded border-l-2 border-red-500 text-sm text-slate-300">
                                                                        <span className="font-semibold text-red-400 block mb-1">Why is this dangerous?</span>
                                                                        {explanation}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-slate-500 text-center py-8 bg-slate-950/50 rounded border border-dashed border-slate-800">
                                            No explicit evidence recorded, but flagged as high risk by heuristics.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                                >
                                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                    {copied ? "Copied" : "Copy Evidence"}
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-red-600/20"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
