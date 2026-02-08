import { BadgeCheck, Sparkles } from "lucide-react";

export function CertifiedBadge() {
    return (
        <div className="relative group cursor-default">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative inline-flex items-center gap-2 px-4 py-1.5 bg-slate-900 ring-1 ring-slate-700/50 rounded-full leading-none">
                <span className="flex items-center justify-center p-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                    <BadgeCheck className="w-3.5 h-3.5" />
                </span>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 uppercase tracking-wider">
                        Gemini 3
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                        Certified Safe
                    </span>
                </div>
                <Sparkles className="w-3 h-3 text-indigo-400 opacity-50 ml-1 group-hover:animate-pulse" />
            </div>
        </div>
    );
}
