import { AuditFinding } from "./geminiAudit";
import { StaticScanResult } from "./staticScanner";

/**
 * Tier thresholds (score ranges)
 * Paper:    0-19
 * Iron:     20-39
 * Bronze:   40-54
 * Silver:   55-69
 * Gold:     70-84
 * Platinum: 85-94
 * Diamond:  95-99
 * Obsidian: 100
 */
export type TierName = "paper" | "iron" | "bronze" | "silver" | "gold" | "platinum" | "diamond" | "obsidian";

/**
 * Calculate safety score (0-100) based on findings severity.
 * Higher score = safer.
 */
export function calculateSafetyScore(
    findings: AuditFinding[],
    staticResult?: StaticScanResult
): number {
    let score = 100;

    // Deduct based on finding severity
    for (const finding of findings) {
        switch (finding.severity) {
            case "critical":
                score -= 40;
                break;
            case "high":
                score -= 20;
                break;
            case "medium":
                score -= 10;
                break;
            case "low":
                score -= 5;
                break;
        }
    }

    // Optional: Factor in static analysis risk flags
    if (staticResult) {
        for (const flag of staticResult.risk_flags) {
            switch (flag.severity) {
                case "critical":
                    score -= 15; // Additional penalty from static scan
                    break;
                case "high":
                    score -= 8;
                    break;
                case "medium":
                    score -= 3;
                    break;
                case "low":
                    score -= 1;
                    break;
            }
        }
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
}

/**
 * Get tier from safety score.
 */
export function getTierFromScore(score: number): TierName {
    if (score >= 100) return "obsidian";
    if (score >= 95) return "diamond";
    if (score >= 85) return "platinum";
    if (score >= 70) return "gold";
    if (score >= 55) return "silver";
    if (score >= 40) return "bronze";
    if (score >= 20) return "iron";
    return "paper";
}

/**
 * Get risk level from safety score.
 */
export function getRiskLevelFromScore(score: number): "low" | "medium" | "high" {
    if (score >= 70) return "low";
    if (score >= 40) return "medium";
    return "high";
}

/**
 * Get description for a tier.
 */
export function getTierDescription(tier: TierName): string {
    switch (tier) {
        case "obsidian": return "Pinnacle of security. Passes all strict checks with zero critical issues.";
        case "diamond": return "Exceptional security posture. Near-perfect score with minimal risks.";
        case "platinum": return "Superior security. Follows best practices with no high-risk findings.";
        case "gold": return "Strong security. Solid implementation but may have minor warnings.";
        case "silver": return "Standard security. Functional but requires review of medium risks.";
        case "bronze": return "Basic security. Contains risks that should be addressed before production.";
        case "iron": return "Weak security. Significant vulnerabilities detected.";
        case "paper": return "Insecure. Do not use without major refactoring.";
        default: return "Unknown security tier.";
    }
}
