"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CheckCircle, AlertTriangle, Terminal, FileCode, Bug, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LogEntry {
    text: string;
    type: "info" | "file" | "error" | "success" | "warning" | "model";
    isStatic?: boolean;
}

export default function ScanPage() {
    const router = useRouter();
    const [input, setInput] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [error, setError] = useState("");
    const [skillId, setSkillId] = useState("");
    const [findingsCount, setFindingsCount] = useState(0);
    const [scanComplete, setScanComplete] = useState(false);

    const [liveStatus, setLiveStatus] = useState("");
    const [currentFile, setCurrentFile] = useState("");
    const [filesScanned, setFilesScanned] = useState(0);
    const [totalFiles, setTotalFiles] = useState(0);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const fileAnimationRef = useRef<NodeJS.Timeout | null>(null);
    const filesListRef = useRef<string[]>([]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs, liveStatus]);

    useEffect(() => {
        return () => {
            if (fileAnimationRef.current) clearInterval(fileAnimationRef.current);
        };
    }, []);

    const addLog = (text: string, type: LogEntry["type"] = "info", isStatic = false) => {
        console.log(`[UI LOG] ${text}`);
        setLogs(prev => [...prev, { text, type, isStatic }]);
    };

    const parseFilesFromMessage = (msg: string): string[] => {
        const match = msg.match(/review\s+(.+?)(?:\s+\(|$)/);
        if (!match) return [];
        const filesStr = match[1];
        const files: string[] = [];
        const namedFiles = filesStr.match(/([^\s,]+\.[a-zA-Z0-9]+)/g);
        if (namedFiles) files.push(...namedFiles);
        const othersMatch = filesStr.match(/\+\s*(\d+)\s*others/);
        if (othersMatch) {
            const count = parseInt(othersMatch[1], 10);
            for (let i = 0; i < count; i++) files.push(`file-${i + 1}`);
        }
        return files;
    };

    const startFileAnimation = (files: string[]) => {
        filesListRef.current = files;
        setTotalFiles(files.length);
        setFilesScanned(0);
        let index = 0;
        fileAnimationRef.current = setInterval(() => {
            setCurrentFile(files[index]);
            setFilesScanned(index + 1);
            index = (index + 1) % files.length;
        }, 300);
    };

    const stopFileAnimation = () => {
        if (fileAnimationRef.current) {
            clearInterval(fileAnimationRef.current);
            fileAnimationRef.current = null;
        }
        setCurrentFile("");
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
        setScanComplete(false);
        setLiveStatus("");
        setCurrentFile("");

        addLog("⚡ Initializing security scan...", "info");
        addLog("📡 Connecting to GitHub...", "info");

        try {
            const res = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: input }),
            });

            const data = await res.json();
            console.log("[UI] Scan started:", data);

            if (!res.ok) throw new Error(data.error || "Scan failed");

            const { scanId, skillId: sid, cached } = data;
            setSkillId(sid);

            if (cached) {
                addLog("✅ Cached result found!", "success", true);
                setScanComplete(true);
                setIsScanning(false);
                return;
            }

            addLog("📥 Downloading repository...", "info");
            setLiveStatus("Downloading repository...");

            const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
            let attempts = 0;
            let lastMsg = "";
            let lastIssueCount = 0;
            let filesInitialized = false;
            let totalRepoFiles = 0;  // Track total files in repo
            let criticalFiles = 0;   // Track critical files for deep audit
            let tokenCount = "?";    // Track token count
            let shownSourceInfo = false;  // Track if we've shown source info

            while (attempts < 200) {
                await delay(1500);
                attempts++;

                try {
                    const pollRes = await fetch(`/api/scan/${scanId}`);
                    if (!pollRes.ok) {
                        console.log(`[UI] Poll ${attempts} failed: ${pollRes.status}`);
                        continue;
                    }

                    const scan = await pollRes.json();
                    if (!scan) continue;

                    const msg = scan.stage_status?.msg || scan.progress_msg || "";
                    console.log(`[UI] Poll #${attempts}: status=${scan.status}, msg="${msg}"`);

                    // DONE!
                    if (scan.status === "done" || scan.status === "done_with_warnings") {
                        stopFileAnimation();
                        setLiveStatus("");

                        const findings = scan.deep_json?.findings || [];
                        setFindingsCount(findings.length);

                        for (const finding of findings) {
                            addLog(`🔴 ${(finding.severity || "MEDIUM").toUpperCase()}: ${finding.title}`, "error", true);
                        }

                        addLog(`✅ Analysis complete: ${findings.length} issue${findings.length !== 1 ? 's' : ''} found`, "success", true);
                        setScanComplete(true);
                        setIsScanning(false);
                        return;
                    }

                    if (scan.status === "error") {
                        stopFileAnimation();
                        throw new Error(scan.error_text || "Scan failed");
                    }

                    // Process message
                    if (msg && msg !== lastMsg) {
                        lastMsg = msg;
                        console.log(`[UI] Processing new message: "${msg}"`);
                        console.log(`[UI] filesInitialized=${filesInitialized}`);

                        // Extract file counts from stage_status (stored by backend)
                        const stageStatus = scan.stage_status || {};
                        if (stageStatus.totalRepoFiles && !totalRepoFiles) {
                            totalRepoFiles = stageStatus.totalRepoFiles;
                            console.log(`[UI] Got totalRepoFiles from stage_status: ${totalRepoFiles}`);
                        }
                        if (stageStatus.criticalFiles) {
                            criticalFiles = stageStatus.criticalFiles;
                            console.log(`[UI] Got criticalFiles from stage_status: ${criticalFiles}`);
                        }
                        if (stageStatus.tokenCount) {
                            tokenCount = stageStatus.tokenCount;
                            console.log(`[UI] Got tokenCount from stage_status: ${tokenCount}`);
                        }

                        // Show source info once (official source + subdirectory)
                        if (!shownSourceInfo && stageStatus.owner) {
                            shownSourceInfo = true;

                            // Show official source if detected
                            if (stageStatus.officialSource) {
                                addLog(`🏢 Official ${stageStatus.officialSource} source`, "success");
                            }

                            // Show subdirectory if scanning a specific path
                            if (stageStatus.subpath) {
                                addLog(`📁 Subdirectory: /${stageStatus.subpath}`, "info");
                            }
                        }

                        // Fetching repository
                        if (msg.includes("Fetching repository")) {
                            console.log("[UI] -> Matched: Fetching repository");
                            setLiveStatus("📥 Downloading repository...");
                        }
                        // Analyzing X files - store the total
                        else if (msg.match(/Analyzing \d+ files/)) {
                            console.log("[UI] -> Matched: Analyzing X files");
                            const match = msg.match(/(\d+)\s*files/);
                            if (match) {
                                totalRepoFiles = parseInt(match[1]);
                                console.log(`[UI] -> Total repo files: ${totalRepoFiles}`);
                                addLog(`📂 Found ${totalRepoFiles} files in repository`, "info");
                                setLiveStatus(`📂 Analyzing ${totalRepoFiles} files...`);
                            }
                        }
                        // Processing for deep audit
                        else if (msg.includes("Processing") && msg.includes("critical")) {
                            console.log("[UI] -> Matched: Processing critical");
                            addLog("🔍 Selecting critical files for deep audit...", "info");
                            setLiveStatus("🔍 Selecting critical files...");
                        }
                        // Deep Audit asking Gemini (with file list) - USE stage_status values, fallback to parsing
                        else if (msg.includes("Deep Audit:") && msg.includes("review") && !filesInitialized) {
                            console.log("[UI] -> Matched: Deep Audit with review (has files)");
                            filesInitialized = true;

                            // PREFER stage_status values (already extracted above), fallback to parsing from message
                            if (!tokenCount || tokenCount === "?") {
                                const tokenMatch = msg.match(/\(([\d.]+)k?\s*tokens\)/);
                                tokenCount = tokenMatch ? tokenMatch[1] : "?";
                            }
                            console.log(`[UI] -> Using tokenCount: ${tokenCount}k`);

                            if (!criticalFiles) {
                                const othersMatch = msg.match(/\+ (\d+) others/);
                                const namedFilesMatch = msg.match(/review\s+([^(]+?)(?:\s+\+|\s+\()/);
                                const namedCount = namedFilesMatch ? namedFilesMatch[1].split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0).length : 0;
                                criticalFiles = namedCount + (othersMatch ? parseInt(othersMatch[1]) : 0);
                            }
                            console.log(`[UI] -> Using criticalFiles: ${criticalFiles}`);

                            // Use values for display
                            const displayTotal = totalRepoFiles || criticalFiles;
                            addLog(`🤖 Using Gemini 3 Pro to analyze ${criticalFiles}/${displayTotal} critical files (${tokenCount}k tokens)`, "model", true);
                            setLiveStatus(`🤖 Gemini analyzing ${criticalFiles} files...`);

                            // Parse files for animation
                            const files = parseFilesFromMessage(msg);
                            if (files.length > 0) startFileAnimation(files);
                        }
                        // Analyzing with model (fallback if we missed the "review" message)
                        else if (msg.includes("Analyzing with") && !filesInitialized) {
                            console.log("[UI] -> Matched: Analyzing with (FALLBACK - missed review)");
                            filesInitialized = true;
                            const modelMatch = msg.match(/gemini[^\s]*/i);
                            console.log(`[UI] -> Model match: ${modelMatch?.[0]}, totalRepoFiles=${totalRepoFiles}, criticalFiles=${criticalFiles}, tokenCount=${tokenCount}`);

                            // If we have file counts from stage_status, show them properly
                            if (totalRepoFiles && !logs.some(l => l.text.includes("Found") && l.text.includes("files"))) {
                                addLog(`📂 Found ${totalRepoFiles} files in repository`, "info");
                            }

                            // Show the Gemini message with actual counts from stage_status
                            const displayCritical = criticalFiles || totalRepoFiles || "?";
                            const displayTotal = totalRepoFiles || criticalFiles || "?";
                            const displayTokens = tokenCount || "?";
                            addLog(`🤖 Using Gemini 3 Pro to analyze ${displayCritical}/${displayTotal} critical files (${displayTokens}k tokens)`, "model", true);
                            setLiveStatus(`🤖 ${modelMatch ? modelMatch[0] : "Gemini"} analyzing...`);

                            // We can still animate with placeholder files
                            const placeholderFiles = Array.from({ length: criticalFiles || 20 }, (_, i) => `file-${i + 1}.py`);
                            startFileAnimation(placeholderFiles);
                        }
                        // Already initialized, just update status
                        else if (msg.includes("Analyzing with") && filesInitialized) {
                            console.log("[UI] -> Matched: Analyzing with (already initialized)");
                            const modelMatch = msg.match(/gemini[^\s]*/i);
                            setLiveStatus(`🤖 ${modelMatch ? modelMatch[0] : "Gemini"} analyzing...`);
                        }
                        // Issue found during stream
                        else if (msg.includes("issue(s) so far")) {
                            console.log("[UI] -> Matched: Issue count update");
                            const countMatch = msg.match(/(\d+)\s*issue/);
                            if (countMatch) {
                                const newCount = parseInt(countMatch[1], 10);
                                console.log(`[UI] -> newCount=${newCount}, lastIssueCount=${lastIssueCount}`);
                                if (newCount > lastIssueCount) {
                                    for (let i = lastIssueCount; i < newCount; i++) {
                                        addLog(`🔴 Issue #${i + 1} detected!`, "error", true);
                                    }
                                    lastIssueCount = newCount;
                                    setFindingsCount(newCount);
                                }
                            }
                        }
                        // Final potential issues
                        else if (msg.includes("Found") && msg.includes("potential")) {
                            console.log("[UI] -> Matched: Found potential issues");
                            setLiveStatus("✅ Finalizing results...");
                        }
                        // Analysis Complete
                        else if (msg === "Analysis Complete.") {
                            console.log("[UI] -> Matched: Analysis Complete");
                            setLiveStatus("✅ Done! Preparing report...");
                        }
                        // Fallback - show message as-is
                        else {
                            console.log("[UI] -> FALLBACK: No specific match");
                            setLiveStatus(`🔄 ${msg}`);
                        }
                    }
                } catch (pollError) {
                    console.error(`[UI] Poll error:`, pollError);
                }
            }

            throw new Error("Timeout - the scan is taking longer than expected");

        } catch (err) {
            stopFileAnimation();
            setError(err instanceof Error ? err.message : "Unknown error");
            addLog(`❌ Error: ${err instanceof Error ? err.message : "Unknown"}`, "error", true);
            setIsScanning(false);
        }
    };

    const getLogColor = (log: LogEntry) => {
        switch (log.type) {
            case "error": return "text-red-400";
            case "success": return "text-green-400";
            case "warning": return "text-yellow-400";
            case "model": return "text-purple-400";
            default: return "text-slate-400";
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center pt-16 px-4">
            <div className="text-center space-y-2 mb-8">
                <h1 className="text-3xl font-bold text-white">Scan AI Agent</h1>
                <p className="text-slate-400">Enter a GitHub repository URL to analyze</p>
            </div>

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
                        {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        {isScanning ? "Scanning..." : "Scan"}
                    </button>
                </div>
            </form>

            <AnimatePresence>
                {(logs.length > 0 || liveStatus) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-xl"
                    >
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                                <Terminal className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-400 font-medium">SECURITY AUDIT</span>
                                {findingsCount > 0 && (
                                    <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
                                        <Bug className="w-3 h-3" /> {findingsCount} issues
                                    </span>
                                )}
                                {isScanning && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin ml-auto" />}
                                {scanComplete && <CheckCircle className="w-3 h-3 text-green-400 ml-auto" />}
                                {error && <AlertTriangle className="w-3 h-3 text-red-400 ml-auto" />}
                            </div>

                            <div className="p-4 font-mono text-sm h-80 overflow-y-auto">
                                {logs.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`py-0.5 ${getLogColor(log)}`}
                                    >
                                        <span className="text-slate-600 mr-2">›</span>
                                        {log.text}
                                    </motion.div>
                                ))}

                                {liveStatus && !currentFile && (
                                    <div className="py-0.5 text-cyan-400 animate-pulse">
                                        <span className="text-slate-600 mr-2">›</span>
                                        {liveStatus}
                                    </div>
                                )}

                                {currentFile && (
                                    <motion.div className="py-0.5 text-cyan-400 flex items-center gap-2">
                                        <span className="text-slate-600">›</span>
                                        <FileCode className="w-3 h-3 animate-pulse" />
                                        <span>Scanning:</span>
                                        <motion.span
                                            key={currentFile}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-white"
                                        >
                                            {currentFile}
                                        </motion.span>
                                        <span className="text-slate-500 text-xs">({filesScanned}/{totalFiles})</span>
                                    </motion.div>
                                )}

                                {isScanning && !currentFile && !liveStatus && (
                                    <div className="text-green-400 animate-pulse py-0.5">
                                        <span className="text-slate-600 mr-2">›</span>_
                                    </div>
                                )}

                                <div ref={logsEndRef} />
                            </div>
                        </div>

                        {scanComplete && skillId && !error && (
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => router.push(`/skill/${skillId}`)}
                                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" />
                                View Full Report ({findingsCount} issue{findingsCount !== 1 ? 's' : ''})
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
