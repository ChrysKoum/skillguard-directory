"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CheckCircle, AlertTriangle, Terminal, FileCode, Bug } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LogEntry {
    text: string;
    type: "info" | "file" | "error" | "success" | "warning";
    done: boolean;
}

interface ScanState {
    files: string[];
    currentFileIndex: number;
    issuesFound: string[];
    isAnalyzing: boolean;
}

export default function ScanPage() {
    const router = useRouter();
    const [input, setInput] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [error, setError] = useState("");
    const [skillId, setSkillId] = useState("");
    const [findingsCount, setFindingsCount] = useState(0);
    const [scanState, setScanState] = useState<ScanState>({
        files: [],
        currentFileIndex: 0,
        issuesFound: [],
        isAnalyzing: false
    });
    const logsEndRef = useRef<HTMLDivElement>(null);
    const fileAnimationRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // Cleanup file animation on unmount
    useEffect(() => {
        return () => {
            if (fileAnimationRef.current) {
                clearInterval(fileAnimationRef.current);
            }
        };
    }, []);

    const addLog = (text: string, type: LogEntry["type"] = "info", done = false) => {
        setLogs(prev => {
            // Mark previous logs as done (grey) unless they're errors
            const updated = prev.map(l => ({
                ...l,
                done: l.type === "error" ? l.done : true
            }));
            return [...updated, { text, type, done }];
        });
    };

    // Parse files from the "Deep Audit" message
    const parseFilesFromMessage = (msg: string): string[] => {
        // Example: "Deep Audit: Asking Gemini 3 Pro to review app/.env.example, skills/README.md, app/README.md + 57 others"
        const match = msg.match(/review\s+(.+?)(?:\s+\(|$)/);
        if (!match) return [];

        const filesStr = match[1];
        const files: string[] = [];

        // Extract named files
        const namedFiles = filesStr.match(/([^\s,]+\.[a-zA-Z0-9]+)/g);
        if (namedFiles) {
            files.push(...namedFiles.slice(0, 10)); // First 10 files
        }

        // Check for "+ X others"
        const othersMatch = filesStr.match(/\+\s*(\d+)\s*others/);
        if (othersMatch) {
            const count = parseInt(othersMatch[1], 10);
            // Add placeholder files for animation
            for (let i = 0; i < Math.min(count, 20); i++) {
                files.push(`additional-file-${i + 1}.ts`);
            }
        }

        return files;
    };

    // Start animated file scanning
    const startFileAnimation = (files: string[]) => {
        if (files.length === 0) return;

        setScanState(prev => ({
            ...prev,
            files,
            currentFileIndex: 0,
            isAnalyzing: true
        }));

        let index = 0;
        fileAnimationRef.current = setInterval(() => {
            index = (index + 1) % files.length;
            setScanState(prev => ({
                ...prev,
                currentFileIndex: index
            }));
        }, 400); // Cycle every 400ms
    };

    // Stop file animation
    const stopFileAnimation = () => {
        if (fileAnimationRef.current) {
            clearInterval(fileAnimationRef.current);
            fileAnimationRef.current = null;
        }
        setScanState(prev => ({ ...prev, isAnalyzing: false }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.includes("github.com")) {
            alert("Please enter a valid GitHub URL");
            return;
        }

        setIsScanning(true);
        setError("");
        setLogs([]);
        setFindingsCount(0);
        setSkillId("");
        setScanState({ files: [], currentFileIndex: 0, issuesFound: [], isAnalyzing: false });

        addLog("⚡ Initializing security scan...", "info");

        try {
            addLog("📡 Connecting to GitHub...", "info");
            const res = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: input }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Scan failed");

            const { scanId, skillId: sid, cached } = data;
            setSkillId(sid);

            if (cached) {
                addLog("✅ Cached result found!", "success", true);
                addLog("🔗 Redirecting to report...", "info", true);
                await new Promise(r => setTimeout(r, 1000));
                router.push(`/skill/${sid}`);
                return;
            }

            addLog("📥 Downloading repository...", "info");

            const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
            let attempts = 0;
            let lastMsg = "";
            let lastIssueCount = 0;
            let filesInitialized = false;

            while (attempts < 100) {
                await delay(1500);
                attempts++;

                const pollRes = await fetch(`/api/scan/${scanId}`);
                if (!pollRes.ok) continue;

                const scan = await pollRes.json();
                if (!scan) continue;

                // Check status FIRST
                if (scan.status === "done" || scan.status === "done_with_warnings") {
                    stopFileAnimation();
                    const findings = scan.deep_json?.findings?.length || 0;
                    setFindingsCount(findings);

                    // Show final issues
                    if (scan.deep_json?.findings) {
                        for (const finding of scan.deep_json.findings) {
                            const existingIssue = scanState.issuesFound.find(i => i === finding.title);
                            if (!existingIssue) {
                                addLog(`🐛 ${finding.severity.toUpperCase()}: ${finding.title}`, "error", true);
                            }
                        }
                    }

                    addLog(`📊 Analysis complete: ${findings} issue${findings !== 1 ? 's' : ''} found`, "success", true);
                    addLog("🔗 Opening report...", "info", true);

                    await delay(1500);
                    router.push(`/skill/${sid}`);
                    return;
                }

                if (scan.status === "error") {
                    stopFileAnimation();
                    throw new Error(scan.error_text || "Scan failed");
                }

                // Process progress messages
                const msg = scan.stage_status?.msg || scan.progress_msg;
                if (msg && msg !== lastMsg) {
                    lastMsg = msg;

                    // Check for file list message
                    if (msg.includes("Deep Audit:") && msg.includes("review") && !filesInitialized) {
                        filesInitialized = true;
                        const files = parseFilesFromMessage(msg);
                        if (files.length > 0) {
                            addLog(`🔍 Starting deep analysis of ${files.length} files...`, "info");
                            startFileAnimation(files);
                        }
                    }
                    // Check for issue count updates
                    else if (msg.includes("issue(s) so far")) {
                        const countMatch = msg.match(/(\d+)\s*issue/);
                        if (countMatch) {
                            const newCount = parseInt(countMatch[1], 10);
                            if (newCount > lastIssueCount) {
                                // New issue found!
                                for (let i = lastIssueCount; i < newCount; i++) {
                                    addLog(`🔴 Security issue #${i + 1} detected!`, "error");
                                    setScanState(prev => ({
                                        ...prev,
                                        issuesFound: [...prev.issuesFound, `Issue ${i + 1}`]
                                    }));
                                }
                                lastIssueCount = newCount;
                            }
                        }
                    }
                    // Other progress messages
                    else if (!msg.includes("Analyzing with") && !msg.includes("Analysis Complete")) {
                        addLog(`🔬 ${msg}`, "info");
                    }
                }
            }

            throw new Error("Timeout - check back later");

        } catch (err) {
            stopFileAnimation();
            setError(err instanceof Error ? err.message : "Unknown error");
            addLog(`❌ Error: ${err instanceof Error ? err.message : "Unknown"}`, "error", true);
        } finally {
            setIsScanning(false);
            stopFileAnimation();
        }
    };

    const getLogColor = (log: LogEntry) => {
        if (log.done && log.type !== "error") return "text-slate-500";
        switch (log.type) {
            case "error": return "text-red-400";
            case "success": return "text-green-400";
            case "warning": return "text-yellow-400";
            case "file": return "text-cyan-400";
            default: return "text-green-400";
        }
    };

    const getLogIcon = (log: LogEntry) => {
        switch (log.type) {
            case "error": return "🔴";
            case "success": return "✅";
            case "file": return "📄";
            default: return "›";
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center pt-16 px-4">
            {/* Header */}
            <div className="text-center space-y-2 mb-8">
                <h1 className="text-3xl font-bold text-white">Scan AI Agent</h1>
                <p className="text-slate-400">Enter a GitHub repository URL to analyze</p>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="w-full max-w-xl mb-8">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={isScanning}
                        placeholder="https://github.com/owner/repo"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 pr-28 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 font-mono text-sm"
                    />
                    <button
                        type="submit"
                        disabled={isScanning || !input}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isScanning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Search className="w-4 h-4" />
                        )}
                        {isScanning ? "Scanning..." : "Scan"}
                    </button>
                </div>
            </form>

            {/* Terminal Output */}
            <AnimatePresence>
                {(logs.length > 0 || scanState.isAnalyzing) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-xl"
                    >
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            {/* Terminal Header */}
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                                <Terminal className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-400 font-medium">SECURITY AUDIT</span>
                                {scanState.issuesFound.length > 0 && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
                                        <Bug className="w-3 h-3" />
                                        {scanState.issuesFound.length} issues
                                    </span>
                                )}
                                {isScanning && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin ml-auto" />}
                                {!isScanning && !error && findingsCount > 0 && (
                                    <CheckCircle className="w-3 h-3 text-green-400 ml-auto" />
                                )}
                                {error && <AlertTriangle className="w-3 h-3 text-red-400 ml-auto" />}
                            </div>

                            {/* Terminal Body */}
                            <div className="p-4 font-mono text-sm h-80 overflow-y-auto">
                                {logs.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`py-0.5 ${getLogColor(log)}`}
                                    >
                                        <span className="text-slate-600 mr-2">{getLogIcon(log)}</span>
                                        {log.text}
                                    </motion.div>
                                ))}

                                {/* Animated File Scanning Display */}
                                {scanState.isAnalyzing && scanState.files.length > 0 && (
                                    <motion.div
                                        key="file-scan"
                                        className="py-1 text-cyan-400 flex items-center gap-2"
                                        animate={{ opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 0.8, repeat: Infinity }}
                                    >
                                        <FileCode className="w-4 h-4" />
                                        <span>Scanning: </span>
                                        <motion.span
                                            key={scanState.currentFileIndex}
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-white font-medium"
                                        >
                                            {scanState.files[scanState.currentFileIndex]}
                                        </motion.span>
                                        <span className="text-slate-500 text-xs ml-2">
                                            ({scanState.currentFileIndex + 1}/{scanState.files.length})
                                        </span>
                                    </motion.div>
                                )}

                                {isScanning && !scanState.isAnalyzing && (
                                    <div className="text-green-400 animate-pulse py-0.5">
                                        <span className="text-slate-600 mr-2">›</span>_
                                    </div>
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </div>

                        {/* View Report Button */}
                        {!isScanning && skillId && !error && (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={() => router.push(`/skill/${skillId}`)}
                                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors"
                            >
                                View Full Report →
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
