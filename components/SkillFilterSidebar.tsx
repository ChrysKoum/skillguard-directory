"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Filter } from "lucide-react";

const TIERS = ["obsidian", "diamond", "platinum", "gold", "silver", "bronze", "iron", "paper"];
const CATEGORIES = [
    "Coding Agents & IDEs",
    "DevOps & Cloud",
    "Security & Passwords",
    "AI & LLMs",
    "Web & Frontend Development",
    "Productivity & Tasks",
    "Data & Analytics",
    "Uncategorized"
];

export function SkillFilterSidebar() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const currentTier = searchParams.get("tier") || "all";
    const currentCategory = searchParams.get("category") || "all";
    const currentBadge = searchParams.get("badge") || "all";

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value === "all") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="w-full md:w-64 flex-shrink-0 space-y-8">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-4">
                <Filter className="w-4 h-4" />
                FILTERS
            </div>

            {/* Badges / Risk */}
            <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">Risk & Badges</h3>
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="radio"
                            name="badge"
                            checked={currentBadge === "all"}
                            onChange={() => updateFilter("badge", "all")}
                            className="text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-600"
                        />
                        <span className="text-slate-400 group-hover:text-white transition-colors text-sm">All Skills</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="radio"
                            name="badge"
                            checked={currentBadge === "official"}
                            onChange={() => updateFilter("badge", "official")}
                            className="text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-600"
                        />
                        <span className="text-slate-400 group-hover:text-white transition-colors text-sm">Official Sources</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="radio"
                            name="badge"
                            checked={currentBadge === "gemini_certified"}
                            onChange={() => updateFilter("badge", "gemini_certified")}
                            className="text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-600"
                        />
                        <span className="text-slate-400 group-hover:text-white transition-colors text-sm">Vertex Certified</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="radio"
                            name="badge"
                            checked={currentBadge === "extreme_danger"}
                            onChange={() => updateFilter("badge", "extreme_danger")}
                            className="text-red-600 focus:ring-red-500 bg-slate-800 border-slate-600"
                        />
                        <span className="text-red-400 group-hover:text-red-300 transition-colors text-sm font-bold flex items-center gap-1">
                            ⚠️ Extreme Danger
                        </span>
                    </label>
                </div>
            </div>

            {/* Safety Tiers */}
            <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">Safety Tier</h3>
                <select
                    value={currentTier}
                    onChange={(e) => updateFilter("tier", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                >
                    <option value="all">Any Tier</option>
                    {TIERS.map(tier => (
                        <option key={tier} value={tier}>
                            {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Categories */}
            <div>
                <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">Category</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="radio"
                            name="category"
                            checked={currentCategory === "all"}
                            onChange={() => updateFilter("category", "all")}
                            className="text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-600"
                        />
                        <span className="text-slate-400 group-hover:text-white transition-colors text-sm">All Categories</span>
                    </label>
                    {CATEGORIES.map(cat => (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="radio"
                                name="category"
                                checked={currentCategory === cat}
                                onChange={() => updateFilter("category", cat)}
                                className="text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-600"
                            />
                            <span className="text-slate-400 group-hover:text-white transition-colors text-sm truncate" title={cat}>
                                {cat}
                            </span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}
