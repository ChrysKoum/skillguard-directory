import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type RiskLevel = "critical" | "high" | "medium" | "low" | "none" | null | string;

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
    const styles = {
        critical: "bg-red-950 text-red-400 border-red-800",
        high: "bg-orange-950 text-orange-400 border-orange-800",
        medium: "bg-yellow-950 text-yellow-400 border-yellow-800",
        low: "bg-green-950 text-green-400 border-green-800",
        none: "bg-gray-800 text-gray-400 border-gray-700",
    };

    const normalizedLevel = (level?.toLowerCase() || "none") as keyof typeof styles;
    const currentStyle = styles[normalizedLevel] || styles.none;

    return (
        <span
            className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                currentStyle,
                className
            )}
        >
            {normalizedLevel.toUpperCase()}
        </span>
    );
}
