"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, AlertTriangle, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ScanPage() {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [status, setStatus] = useState<"idle" | "scanning" | "error" | "complete">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.includes("github.com")) {
            setStatus("error");
            setErrorMsg("Please enter a valid GitHub URL");
            return;
        }

        setStatus("scanning");
        setLogs([]);
        addLog("Initializing scan sequence...");

        try {
            const res = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Scan failed to start");

            const { scanId, skillId, cached } = data;

            if (cached) {
                addLog("Found recent cache. Redirecting...");
                router.push(`/skill/${skillId}`);
                return;
            }

            addLog(`Scan ID: ${scanId}`);
            addLog("Ingesting repository...");

            // Poll for completion
            // In a real app we'd use SWR or React Query, keeping it simple here
            pollStatus(skillId, scanId);

        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Unknown error");
        }
    };

    const pollStatus = async (skillId: string, scanId: string) => {
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
        let attempts = 0;

        // Poll for up to 60 seconds (simulating wait)
        while (attempts < 20) {
            await delay(3000); // 3s interval
            attempts++;

            addLog(`Checking status... (${attempts})`);

            try {
                const res = await fetch(`/api/skill/${skillId}`);
                const data = await res.json();

                if (data.scan) {
                    if (data.scan.status === "done") {
                        addLog("Scan Complete! Finalizing report...");
                        setStatus("complete");
                        router.push(`/skill/${skillId}`);
                        return;
                    }
                    if (data.scan.status === "error") {
                        throw new Error(data.scan.error_text || "Scan failed mid-process");
                    }
                }
            } catch (err) {
                // ignore transient network errors
                console.warn("Poll warning", err);
            }
        }

        setStatus("error");
        setErrorMsg("Timeout: Scan is taking longer than expected. Check back later.");
    };

    return (
        <div className="min-h-screen py-24 px-4 bg-slate-950 flex flex-col items-center justify-center">
            <div className="w-full max-w-lg space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">Scan New Agent</h1>
                    <p className="text-slate-400">Enter a public GitHub repository to audit.</p>
                </div>

                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={status === "scanning"}
                        placeholder="https://github.com/owner/repo"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={status === "scanning" || !url}
                        className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-lg font-medium transition-colors disabled:opacity-0 disabled:pointer-events-none"
                    >
                        <Search className="w-5 h-5" />
                    </button>

                    {status === "scanning" && (
                        <div className="absolute right-4 top-4">
                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                        </div>
                    )}
                </form>

                <AnimatePresence>
                    {status === "error" && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-950/50 border border-red-900 rounded-lg p-4 flex items-center gap-3 text-red-200"
                        >
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <span>{errorMsg}</span>
                        </motion.div>
                    )}

                    {status === "scanning" && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="bg-slate-900 rounded-lg border border-slate-800 p-4 font-mono text-xs text-green-400 h-48 overflow-y-auto"
                        >
                            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2 text-slate-500">
                                <Terminal className="w-3 h-3" />
                                <span>LOG OUTPUT</span>
                            </div>
                            <div className="space-y-1">
                                {logs.map((l, i) => (
                                    <div key={i}>{l}</div>
                                ))}
                                <div className="animate-pulse">_</div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
