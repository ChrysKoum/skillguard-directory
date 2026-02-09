"use client";

import { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Shield, Info } from "lucide-react";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Badge tiers from worst to best
export const BADGE_TIERS = {
    paper: {
        label: "Paper",
        description: "Critical vulnerabilities detected. Do not use without thorough review.",
        color: "bg-red-950 text-red-400 border-red-800",
        iconColor: "text-red-400",
        score: "0-19",
        certified: false,
    },
    iron: {
        label: "Iron",
        description: "High-risk issues found. Use with extreme caution.",
        color: "bg-orange-950 text-orange-400 border-orange-800",
        iconColor: "text-orange-400",
        score: "20-39",
        certified: false,
    },
    bronze: {
        label: "Bronze",
        description: "Several security concerns. Review recommended before use.",
        color: "bg-amber-950 text-amber-400 border-amber-800",
        iconColor: "text-amber-400",
        score: "40-54",
        certified: false,
    },
    silver: {
        label: "Silver",
        description: "Minor issues detected. Generally safe with some caveats.",
        color: "bg-slate-800 text-slate-300 border-slate-600",
        iconColor: "text-slate-300",
        score: "55-69",
        certified: false,
    },
    gold: {
        label: "Gold",
        description: "Very low risk. Safe for most use cases.",
        color: "bg-yellow-950 text-yellow-400 border-yellow-700",
        iconColor: "text-yellow-400",
        score: "70-84",
        certified: false,
    },
    platinum: {
        label: "Platinum",
        description: "Minimal concerns. Approved for general use.",
        color: "bg-cyan-950 text-cyan-300 border-cyan-700",
        iconColor: "text-cyan-300",
        score: "85-94",
        certified: true,
    },
    diamond: {
        label: "Diamond",
        description: "Excellent security. Highly recommended.",
        color: "bg-blue-950 text-blue-300 border-blue-600",
        iconColor: "text-blue-300",
        score: "95-99",
        certified: true,
    },
    obsidian: {
        label: "Obsidian",
        description: "Perfect score. No issues detected. Highest certification.",
        color: "bg-gradient-to-r from-purple-950 to-indigo-950 text-purple-300 border-purple-600",
        iconColor: "text-purple-300",
        score: "100",
        certified: true,
    },
};

export type TierKey = keyof typeof BADGE_TIERS;
export type BadgeTier = TierKey;

export function getBadgeTierFromDb(tier: string | null | undefined): TierKey {
    if (!tier) return "paper"; // Default to paper for unknown/null
    const normalized = tier.toLowerCase();
    return (BADGE_TIERS.hasOwnProperty(normalized) ? normalized : "paper") as TierKey;
}

/**
 * Get tier from safety score (0-100).
 * Synced with backend lib/safetyScore.ts
 */
export function getTierFromScore(score: number): TierKey {
    if (score >= 100) return "obsidian";
    if (score >= 95) return "diamond";
    if (score >= 85) return "platinum";
    if (score >= 70) return "gold";
    if (score >= 55) return "silver";
    if (score >= 40) return "bronze";
    if (score >= 20) return "iron";
    return "paper";
}

interface TierBadgeProps {
    tier: TierKey | string;
    showTooltip?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function TierBadge({ tier, showTooltip = true, size = "md", className }: TierBadgeProps) {
    const [isHovered, setIsHovered] = useState(false);

    const normalizedTier = (tier?.toLowerCase() || "iron") as TierKey;
    const badgeInfo = BADGE_TIERS[normalizedTier] || BADGE_TIERS.iron;

    const sizeClasses = {
        sm: "px-2 py-0.5 text-xs",
        md: "px-3 py-1 text-sm",
        lg: "px-4 py-1.5 text-base",
    };

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <span
                className={cn(
                    "inline-flex items-center gap-1.5 rounded-full font-semibold border",
                    badgeInfo.color,
                    sizeClasses[size],
                    className
                )}
            >
                <Shield className={cn("w-3.5 h-3.5", badgeInfo.iconColor)} />
                {badgeInfo.label}
                {showTooltip && <Info className="w-3 h-3 opacity-50" />}
            </span>

            {/* Tooltip */}
            {showTooltip && isHovered && (
                <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className={cn("w-4 h-4", badgeInfo.iconColor)} />
                        <span className="font-bold text-white">{badgeInfo.label} Tier</span>
                        <span className="text-xs text-slate-500 ml-auto">Score: {badgeInfo.score}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        {badgeInfo.description}
                    </p>
                    {badgeInfo.certified && (
                        <div className="mt-2 pt-2 border-t border-slate-700 flex items-center gap-1.5 text-xs text-emerald-400">
                            <span>✓</span> Gemini 3 Certified Safe
                        </div>
                    )}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 border-r border-b border-slate-700"></div>
                </div>
            )}
        </div>
    );
}

// Component for the "All Tiers" info card
export function TierInfoCard() {
    const tiers = Object.entries(BADGE_TIERS).reverse(); // Best to worst

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Security Tiers</h3>
            <div className="space-y-3">
                {tiers.map(([key, info]) => (
                    <div key={key} className="flex items-center gap-3">
                        <TierBadge tier={key} showTooltip={false} size="sm" />
                        <span className="text-xs text-slate-500 flex-1">{info.score}</span>
                        {info.certified && (
                            <span className="text-[10px] text-emerald-400">✓ Certified</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
