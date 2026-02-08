"use client";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Shield, Award, Crown, Gem, Star, Medal, Swords, FileWarning } from "lucide-react";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Badge tiers from most vulnerable to most secure
export type BadgeTier =
    | "paper"      // Most vulnerable - many critical issues
    | "iron"       // Very risky - high issues
    | "bronze"     // Risky - medium issues
    | "silver"     // Acceptable - some low issues
    | "gold"       // Good - minimal issues
    | "platinum"   // Very good - no issues, minor concerns
    | "diamond"    // Excellent - clean scan
    | "obsidian";  // Perfect - certified secure

// Configuration for each badge tier
const BADGE_CONFIG: Record<BadgeTier, {
    label: string;
    icon: typeof Shield;
    colors: string;
    description: string;
}> = {
    paper: {
        label: "Paper",
        icon: FileWarning,
        colors: "bg-red-950 text-red-300 border-red-700",
        description: "Critical security issues detected"
    },
    iron: {
        label: "Iron",
        icon: Swords,
        colors: "bg-orange-950 text-orange-300 border-orange-700",
        description: "High security risks present"
    },
    bronze: {
        label: "Bronze",
        icon: Medal,
        colors: "bg-amber-950 text-amber-400 border-amber-700",
        description: "Medium security concerns"
    },
    silver: {
        label: "Silver",
        icon: Shield,
        colors: "bg-slate-800 text-slate-200 border-slate-500",
        description: "Low risk, acceptable security"
    },
    gold: {
        label: "Gold",
        icon: Star,
        colors: "bg-yellow-900/80 text-yellow-300 border-yellow-600",
        description: "Good security posture"
    },
    platinum: {
        label: "Platinum",
        icon: Award,
        colors: "bg-cyan-950 text-cyan-300 border-cyan-600",
        description: "Very good security"
    },
    diamond: {
        label: "Diamond",
        icon: Gem,
        colors: "bg-blue-950 text-blue-300 border-blue-500",
        description: "Excellent security"
    },
    obsidian: {
        label: "Obsidian",
        icon: Crown,
        colors: "bg-purple-950 text-purple-300 border-purple-500",
        description: "Perfect security certification"
    }
};

// Calculate badge tier based on scan results
export function calculateBadgeTier(
    riskLevel: "low" | "medium" | "high" | null,
    findingsCount: number,
    criticalCount: number = 0,
    highCount: number = 0,
    staticScore: number = 0
): BadgeTier {
    // Critical issues = Paper or Iron
    if (criticalCount >= 2) return "paper";
    if (criticalCount >= 1) return "iron";

    // High issues
    if (highCount >= 3) return "paper";
    if (highCount >= 2) return "iron";
    if (highCount >= 1) return "bronze";

    // Based on total findings and risk level
    if (riskLevel === "high" || findingsCount >= 5) return "iron";
    if (riskLevel === "medium" || findingsCount >= 3) return "bronze";

    // Lower findings
    if (findingsCount === 2) return "silver";
    if (findingsCount === 1) return staticScore < 30 ? "gold" : "silver";

    // No findings
    if (findingsCount === 0) {
        if (staticScore < 10) return "obsidian";
        if (staticScore < 20) return "diamond";
        if (staticScore < 40) return "platinum";
        return "gold";
    }

    return "silver";
}

interface TierBadgeProps {
    tier: BadgeTier;
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
    className?: string;
}

export function TierBadge({ tier, size = "md", showLabel = true, className }: TierBadgeProps) {
    const config = BADGE_CONFIG[tier] || BADGE_CONFIG.iron;
    const Icon = config.icon;

    const sizeStyles = {
        sm: "px-2 py-0.5 text-xs gap-1",
        md: "px-2.5 py-1 text-sm gap-1.5",
        lg: "px-3 py-1.5 text-base gap-2"
    };

    const iconSizes = {
        sm: "w-3 h-3",
        md: "w-4 h-4",
        lg: "w-5 h-5"
    };

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full font-medium border",
                config.colors,
                sizeStyles[size],
                className
            )}
            title={config.description}
        >
            <Icon className={iconSizes[size]} />
            {showLabel && <span>{config.label}</span>}
        </span>
    );
}

// Helper to get badge tier from database value (for backwards compatibility)
export function getBadgeTierFromDb(dbValue: string | null): BadgeTier {
    if (!dbValue || dbValue === "none") return "iron";
    if (dbValue === "paper") return "paper";
    if (dbValue === "iron") return "iron";
    if (dbValue === "bronze") return "bronze";
    if (dbValue === "silver") return "silver";
    if (dbValue === "gold") return "gold";
    if (dbValue === "platinum") return "platinum";
    if (dbValue === "diamond") return "diamond";
    if (dbValue === "obsidian") return "obsidian";
    if (dbValue === "pinned") return "obsidian"; // Legacy mapping
    return "iron";
}

// Get color classes for a tier (useful for other UI elements)
export function getTierColors(tier: BadgeTier): string {
    return BADGE_CONFIG[tier]?.colors || BADGE_CONFIG.iron.colors;
}
