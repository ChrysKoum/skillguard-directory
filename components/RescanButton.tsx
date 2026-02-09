"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

import { ScanModal } from "./ui/ScanModal";

interface LogEntry {
    text: string;
    type: "info" | "file" | "error" | "success" | "warning" | "model";
}

export function RescanButton({ url }: { url: string }) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<"idle" | "scanning" | "error" | "complete">("idle");
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [errorMsg, setErrorMsg] = useState("");

    const addLog = (text: string, type: LogEntry["type"] = "info") =>
        setLogs(prev => [...prev, { text, type }]);

    const handleRescan = async () => {
        if (!confirm("Start a new deep audit? This will consume Gemini tokens.")) return;

        setIsOpen(true);
        setStatus("scanning");
        setLogs([]);
        setErrorMsg("");
        addLog("⚡ Initializing rescan sequence...", "info");

        try {
            const res = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, forceRescan: true }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Scan failed to start");

            const { scanId, skillId } = data;
            addLog(`Scan ID: ${scanId}`, "info");

            // Start smart polling
            await pollStatus(skillId, scanId);

        } catch (error) {
            console.error(error);
            setStatus("error");
            setErrorMsg(error instanceof Error ? error.message : "Failed to start scan");
            addLog(`❌ Error: ${error instanceof Error ? error.message : "Unknown"}`, "error");
        }
    };

    const pollStatus = async (skillId: string, scanId: string) => {
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
        let attempts = 0;
        let lastMsg = "";
        let filesInitialized = false;
        let totalRepoFiles = 0;
        let criticalFiles = 0;
        let tokenCount = "?";

        while (attempts < 200) {
            await delay(1500);
            attempts++;

            try {
                // Poll specifically for this scan ID to get real-time progress
                const res = await fetch(`/api/scan/${scanId}`);
                if (!res.ok) continue;

                const scan = await res.json();
                if (!scan) continue;

                // 1. Check if done
                if (scan.status === "done" || scan.status === "done_with_warnings") {
                    addLog("✅ Analysis complete!", "success");
                    setStatus("complete");

                    setTimeout(() => {
                        setIsOpen(false);
                        router.refresh();
                    }, 1500);
                    return;
                }

                if (scan.status === "error") {
                    throw new Error(scan.error_text || "Scan failed");
                }

                // 2. Parse progress messages (ScanPage logic)
                const msg = scan.stage_status?.msg || scan.progress_msg || "";

                if (msg && msg !== lastMsg) {
                    lastMsg = msg;

                    // Extract metadata
                    const stageStatus = scan.stage_status || {};
                    if (stageStatus.totalRepoFiles) totalRepoFiles = stageStatus.totalRepoFiles;
                    if (stageStatus.criticalFiles) criticalFiles = stageStatus.criticalFiles;
                    if (stageStatus.tokenCount) tokenCount = stageStatus.tokenCount;

                    // Fetching repository
                    if (msg.includes("Fetching repository")) {
                        addLog("📥 Downloading repository...", "info");
                    }
                    // Analyzing files
                    else if (msg.match(/Analyzing \d+ files/)) {
                        const match = msg.match(/(\d+)\s*files/);
                        if (match) {
                            totalRepoFiles = parseInt(match[1]);
                            addLog(`📂 Found ${totalRepoFiles} files in repository`, "info");
                        }
                    }
                    // Deep Audit Selection
                    else if (msg.includes("Processing") && msg.includes("critical")) {
                        addLog("🔍 Selecting critical files for deep audit...", "info");
                    }
                    // Deep Audit Start
                    else if (msg.includes("Deep Audit:") && !filesInitialized) {
                        filesInitialized = true;

                        // Parse token count if missing from stage_status
                        if (!tokenCount || tokenCount === "?") {
                            const tokenMatch = msg.match(/\(([\d.]+)k?\s*tokens\)/);
                            tokenCount = tokenMatch ? tokenMatch[1] : "?";
                        }

                        const displayTotal = totalRepoFiles || criticalFiles;
                        addLog(`🤖 Using Gemini 3 Pro to analyze ${criticalFiles}/${displayTotal} critical files (${tokenCount}k tokens)`, "model");
                    }
                    // Streaming updates from Gemini
                    else if (msg.includes("Analyzing with")) {
                        // suppress duplicate model messages
                    }
                    // Issue detected
                    else if (msg.includes("issue(s) so far")) {
                        // suppress generic issue counter, wait for final report
                    }
                    // Fallback log
                    else {
                        addLog(msg, "info");
                    }
                }

            } catch (err) {
                console.warn("Poll warning", err);
            }
        }

        setStatus("error");
        setErrorMsg("Timeout. The scan is taking longer than expected.");
    };

    return (
        <>
            <button
                onClick={handleRescan}
                disabled={status === "scanning"}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-indigo-900 border border-slate-700 hover:border-indigo-500 rounded-lg text-xs font-medium text-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Force Re-scan"
            >
                {status === "scanning" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                )}
                {status === "scanning" ? "Scanning..." : "Rescan"}
            </button>

            <ScanModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                status={status}
                logs={logs}
                errorMsg={errorMsg}
            />
        </>
    );
}
