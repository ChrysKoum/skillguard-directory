export function CapabilityChip({ cap }: { cap: string }) {
    return (
        <span className="inline-flex items-center px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700">
            {cap}
        </span>
    );
}
