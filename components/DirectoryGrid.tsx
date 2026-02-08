"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ShieldAlert, CheckCircle2, Shield, Filter } from "lucide-react";
import { RiskBadge } from "./ui/RiskBadge";
import { TierBadge, getBadgeTierFromDb, type BadgeTier } from "./ui/TierBadge";

interface Scan {
    id: string;
    risk_level: string;
    verified_badge: string | null;
    created_at: string;
    skills: {
        id: string;
        name: string;
        slug: string;
    };
}

export function DirectoryGrid({ scans }: { scans: Scan[] }) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "safe" | "risky">("all");

    const filtered = scans.filter((s) => {
        const matchesSearch = s.skills.name.toLowerCase().includes(search.toLowerCase()) ||
            s.skills.slug.toLowerCase().includes(search.toLowerCase());

        if (filter === "safe") return matchesSearch && s.risk_level === "low";
        if (filter === "risky") return matchesSearch && (s.risk_level === "high" || s.risk_level === "medium");
        return matchesSearch;
    });

    return (
        <div className="w-full">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search skills..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${filter === "all" ? "bg-slate-800 border-indigo-500 text-white" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter("safe")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${filter === "safe" ? "bg-indigo-900/20 border-indigo-500 text-indigo-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"}`}
                    >
                        <Shield className="w-3 h-3" /> Safe
                    </button>
                    <button
                        onClick={() => setFilter("risky")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${filter === "risky" ? "bg-red-900/20 border-red-500 text-red-400" : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"}`}
                    >
                        <ShieldAlert className="w-3 h-3" /> Risky
                    </button>
                </div>
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                    <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-300">No Audits Found</h3>
                    <p className="text-slate-500">Try adjusting your filters or scan a new repo.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((scan) => (
                        <Link key={scan.id} href={`/skill/${scan.skills.id}`} className="group block">
                            <div className="h-full bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-slate-900 transition-all">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                                            {scan.skills.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">{scan.skills.slug}</p>
                                    </div>
                                    <div className="flex flex-col gap-1 items-end">
                                        <TierBadge tier={getBadgeTierFromDb(scan.verified_badge)} size="sm" />
                                        <RiskBadge level={scan.risk_level} className="text-[10px]" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/50 text-xs text-slate-400">
                                    <CheckCircle2 className="w-3 h-3 text-slate-600" />
                                    <span>Scanned {new Date(scan.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
