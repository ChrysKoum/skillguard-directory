"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, ShieldAlert, CheckCircle2, Shield, Filter, Tag } from "lucide-react";
import { TierBadge, getBadgeTierFromDb, type BadgeTier, BADGE_TIERS } from "./ui/TierBadge";
import { SecondaryBadges } from "./ui/SecondaryBadges";

interface Scan {
    id: string;
    risk_level: string;
    verified_badge: string | null;
    created_at: string;
    skills: {
        id: string;
        name: string;
        slug: string;
        category: string;
        source_url: string;
    };
}

export function DirectoryGrid({ scans, showFilters = true }: { scans: Scan[], showFilters?: boolean }) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "safe" | "risky">("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [tierFilter, setTierFilter] = useState<string>("all");
    const [badgeFilter, setBadgeFilter] = useState<string>("all");
    const [visibleCount, setVisibleCount] = useState(20);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(20);
    }, [search, filter, categoryFilter, tierFilter, badgeFilter]);

    // Extract unique categories
    const categories = Array.from(new Set(scans.map(s => s.skills.category || "Uncategorized"))).sort();

    const filtered = showFilters ? scans.filter((s) => {
        const matchesSearch = s.skills.name.toLowerCase().includes(search.toLowerCase()) ||
            s.skills.slug.toLowerCase().includes(search.toLowerCase());

        const matchesCategory = categoryFilter === "all" || s.skills.category === categoryFilter;

        // Tier Filter
        const tier = getBadgeTierFromDb(s.verified_badge);
        const matchesTier = tierFilter === "all" || tier === tierFilter;

        // Badge Filter
        let matchesBadge = true;
        if (badgeFilter !== "all") {
            const [owner, repo] = s.skills.slug.split("/");
            switch (badgeFilter) {
                case "gemini_certified":
                    matchesBadge = ['platinum', 'diamond', 'obsidian'].includes(tier);
                    break;
                case "openai":
                    matchesBadge = owner === 'openai';
                    break;
                case "microsoft":
                    matchesBadge = owner === 'microsoft';
                    break;
                case "anthropic":
                    matchesBadge = owner === 'anthropics' || repo === 'claude-code';
                    break;
                case "vercel":
                    matchesBadge = owner === 'vercel' || owner === 'vercel-labs';
                    break;
                case "cursor":
                    matchesBadge = owner === 'cursor-ai';
                    break;
                case "antigravity":
                    matchesBadge = owner === 'sickn33' || owner === 'antigravity-official';
                    break;
                default:
                    matchesBadge = true;
            }
        }

        const matchesRisk = filter === "all" ||
            (filter === "safe" && s.risk_level === "low") ||
            (filter === "risky" && (s.risk_level === "high" || s.risk_level === "medium"));


        return matchesSearch && matchesCategory && matchesTier && matchesBadge && matchesRisk;
    }) : scans;

    return (
        <div className="w-full">
            {/* Controls */}
            {showFilters && (
                <div className="flex flex-col gap-4 mb-8">
                    {/* Search and Top Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
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

                    {/* Secondary Filters */}
                    <div className="flex flex-wrap gap-4">
                        {/* Category Filter */}
                        <div className="relative">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="appearance-none bg-slate-900 border border-slate-800 rounded-lg pl-4 pr-10 py-2 text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer hover:border-slate-700 transition-colors"
                            >
                                <option value="all">All Categories</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Tier Filter */}
                        <div className="relative">
                            <select
                                value={tierFilter}
                                onChange={(e) => setTierFilter(e.target.value)}
                                className="appearance-none bg-slate-900 border border-slate-800 rounded-lg pl-4 pr-10 py-2 text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer hover:border-slate-700 transition-colors"
                            >
                                <option value="all">All Tiers</option>
                                {Object.entries(BADGE_TIERS).map(([key, val]) => (
                                    <option key={key} value={key}>{val.label}</option>
                                ))}
                            </select>
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Badge/Origin Filter */}
                        <div className="relative">
                            <select
                                value={badgeFilter}
                                onChange={(e) => setBadgeFilter(e.target.value)}
                                className="appearance-none bg-slate-900 border border-slate-800 rounded-lg pl-4 pr-10 py-2 text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer hover:border-slate-700 transition-colors"
                            >
                                <option value="all">All Badges</option>
                                <option value="gemini_certified">Gemini 3 Certified</option>
                                <option value="openai">Official OpenAI</option>
                                <option value="microsoft">Microsoft</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="vercel">Vercel</option>
                                <option value="cursor">Cursor AI</option>
                                <option value="antigravity">Antigravity</option>
                            </select>
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                </div>
            )}

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
                    <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-300">No Audits Found</h3>
                    <p className="text-slate-500">Try adjusting your filters or scan a new repo.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.slice(0, visibleCount).map((scan) => {
                            const [owner, repo] = scan.skills.slug.split("/");
                            return (
                                <Link key={scan.id} href={`/skill/${scan.skills.id}`} className="group block">
                                    <div className="h-full bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-slate-900 transition-all">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                                        <Tag className="w-3 h-3" />
                                                        {scan.skills.category}
                                                    </span>
                                                </div>
                                                <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                                                    {scan.skills.name}
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">{scan.skills.slug}</p>

                                                <div className="mt-2">
                                                    <SecondaryBadges owner={owner} repo={repo} />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 items-end">
                                                <TierBadge tier={getBadgeTierFromDb(scan.verified_badge)} size="sm" />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/50 text-xs text-slate-400">
                                            <CheckCircle2 className="w-3 h-3 text-slate-600" />
                                            <span>Scanned {new Date(scan.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Load More Button */}
                    {visibleCount < filtered.length && (
                        <div className="flex justify-center mt-8">
                            <button
                                onClick={() => setVisibleCount(prev => prev + 20)}
                                className="px-6 py-3 bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-300 rounded-lg text-sm font-medium transition-all hover:bg-slate-800"
                            >
                                Load More ({filtered.length - visibleCount} remaining)
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
