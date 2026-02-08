"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

import { ScanModal } from "./ui/ScanModal";

export function RescanButton({ url }: { url: string }) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<"idle" | "scanning" | "error" | "complete">("idle");
    const [logs, setLogs] = useState<string[]>([]);
    const [errorMsg, setErrorMsg] = useState("");

    const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`]);

    const handleRescan = async () => {
        if (!confirm("Start a new deep audit? This will consume Gemini tokens.")) return;

        setIsOpen(true);
        setStatus("scanning");
        setLogs([]);
        setErrorMsg("");
        addLog("Initializing rescan sequence...");

        try {
            const res = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, forceRescan: true }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Scan failed to start");

            const { scanId, skillId } = data;
            addLog(`Scan ID: ${scanId}`);
            addLog("Ingesting repository...");

            // Poll for completion
            await pollStatus(skillId, scanId);

        } catch (error) {
            console.error(error);
            setStatus("error");
            setErrorMsg(error instanceof Error ? error.message : "Failed to start scan");
        }
    };

    const pollStatus = async (skillId: string, scanId: string) => {
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
        let attempts = 0;

        while (attempts < 100) {
            await delay(3000);
            attempts++;

            try {
                const res = await fetch(`/api/skill/${skillId}`);
                if (!res.ok) continue;

                const data = await res.json();
                const scan = data.scan;

                // Check if ANY scan is done (fixes race condition)
                if (scan) {
                    if (scan.status === "done" || scan.status === "done_with_warnings") {
                        addLog("✓ Scan Complete!");
                        setStatus("complete");
                        await delay(1000);
                        setIsOpen(false);
                        router.refresh();
                        return;
                    }
                    if (scan.status === "error") {
                        throw new Error(scan.error_text || "Scan failed");
                    }

                    // Update progress log
                    if (scan.stage_status?.msg && !logs.includes(`> ${scan.stage_status.msg}`)) {
                        addLog(scan.stage_status.msg);
                    }
                }
            } catch (err) {
                console.warn("Poll warning", err);
            }
        }

        setStatus("error");
        setErrorMsg("Timeout. Check back later.");
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
