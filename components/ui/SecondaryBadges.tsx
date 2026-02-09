import { BadgeCheck, Zap, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecondaryBadgesProps {
    owner: string;
    repo: string;
    className?: string;
}

export function SecondaryBadges({ owner, repo, className }: SecondaryBadgesProps) {
    const badges = [];

    // Official Anthropic / Claude
    if (owner === "anthropics" || repo === "claude-code") {
        badges.push({
            label: "Official Claude",
            icon: <BadgeCheck className="w-3 h-3 text-orange-400" />,
            bg: "bg-orange-950/30 border-orange-500/30 text-orange-200"
        });
    }

    // Official Vercel
    if (owner === "vercel" || owner === "vercel-labs") {
        badges.push({
            label: "Vercel",
            icon: <div className="w-3 h-3 border-b-4 border-l-4 border-r-4 border-transparent border-b-white transform -translate-y-[2px]" />, // Triangle approximation
            bg: "bg-black border-slate-700 text-white"
        });
    }

    // Official OpenAI
    if (owner === "openai") {
        badges.push({
            label: "Official OpenAI",
            icon: <Zap className="w-3 h-3 text-green-400" />,
            bg: "bg-green-950/30 border-green-500/30 text-green-200"
        });
    }

    // Official Microsoft
    if (owner === "microsoft") {
        badges.push({
            label: "Microsoft",
            icon: <BadgeCheck className="w-3 h-3 text-blue-400" />,
            bg: "bg-blue-950/30 border-blue-500/30 text-blue-200"
        });
    }

    // Antigravity (Us)
    if (owner === "sickn33" || owner === "antigravity-official") {
        badges.push({
            label: "Antigravity",
            icon: <Terminal className="w-3 h-3 text-purple-400" />,
            bg: "bg-purple-950/30 border-purple-500/30 text-purple-200"
        });
    }

    // Cursor
    if (owner === "cursor-ai") {
        badges.push({
            label: "Cursor",
            icon: <Terminal className="w-3 h-3 text-slate-400" />,
            bg: "bg-slate-800 border-slate-600 text-slate-200"
        });
    }


    if (badges.length === 0) return null;

    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            {badges.map((b, i) => (
                <span key={i} className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border", b.bg)}>
                    {b.icon}
                    {b.label}
                </span>
            ))}
        </div>
    );
}
