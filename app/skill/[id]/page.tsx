import { supabase } from "@/lib/supabase";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { CertifiedBadge } from "@/components/ui/CertifiedBadge";
import { CapabilityChip } from "@/components/ui/CapabilityChip";
import { RescanButton } from "@/components/RescanButton";
import { Shield, Download, AlertTriangle, CheckCircle, FileCode, Activity } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 0;

async function getSkillData(id: string) {
    const { data: skill } = await (supabase.from("skills") as any).select("*").eq("id", id).single();
    if (!skill) return null;

    const { data: scan } = await (supabase
        .from("scans") as any)
        .select("*")
        .eq("skill_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    const { data: artifacts } = await (supabase
        .from("artifacts") as any)
        .select("*")
        .eq("scan_id", scan?.id);

    // Generate signed URLs
    const artifactsWithUrls = await Promise.all((artifacts || []).map(async (art: any) => {
        const { data } = await supabase.storage.from("skillguard").createSignedUrl(art.storage_path, 3600);
        return { ...art, download_url: data?.signedUrl };
    }));

    return { skill, scan, artifacts: artifactsWithUrls };
}

export default async function SkillReport({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getSkillData(id);

    if (!data) return notFound();

    const { skill, scan, artifacts } = data;
    const staticRes = scan?.static_json as any;
    const deepRes = scan?.deep_json as any;

    if (!scan || scan.status !== "done") {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col gap-4 text-slate-400">
                <Activity className="w-10 h-10 animate-pulse text-indigo-500" />
                <p>Analysis in progress or failed...</p>
                <Link href="/scan" className="text-indigo-400 hover:underline">Try again</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-slate-800 pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-white">{skill.name}</h1>
                        {scan.risk_level === 'low' ? <CertifiedBadge /> : <RiskBadge level={scan.risk_level} className="text-sm px-3 py-1" />}
                    </div>
                    <div className="flex items-center gap-4">
                        <a href={skill.source_url} target="_blank" className="text-slate-400 hover:text-indigo-400 font-mono text-sm">
                            {skill.source_url}
                        </a>
                        <RescanButton url={skill.source_url} />
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    {/* Token Usage Badge */}
                    {deepRes?.token_usage && (
                        <div className="flex flex-col items-end justify-center mr-4 text-xs text-slate-500 font-mono">
                            <span>{deepRes.token_usage.total.toLocaleString()} tokens</span>
                            <span className="text-[10px] opacity-60 uppercase">{scan.deep_model_used || "Gemini 3 Pro"}</span>
                        </div>
                    )}

                    {scan.warnings && scan.warnings.length > 0 && (
                        <div className="group relative flex items-center justify-center mr-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 cursor-help" />
                            <div className="absolute top-8 right-0 w-64 p-3 bg-slate-900 border border-yellow-500/30 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                <p className="font-bold text-yellow-500 mb-1">Scan Warnings:</p>
                                <ul className="list-disc pl-3 space-y-1">
                                    {(scan.warnings as string[]).map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        </div>
                    )}

                    {artifacts.map((art) => (
                        <a
                            key={art.id}
                            href={art.download_url}
                            target="_blank"
                            className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-300 px-4 py-2 rounded-lg text-sm transition-all"
                        >
                            <Download className="w-4 h-4" />
                            {art.type === 'policy_json' ? 'Policy.json' : 'Verification Plan'}
                        </a>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Static Info */}
                <div className="space-y-6">
                    {/* Score Card */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Safety Score</h3>
                        <div className="flex items-end gap-2">
                            <span className="text-5xl font-bold text-white">{100 - (staticRes?.static_score || 0)}</span>
                            <span className="text-slate-500 mb-1">/ 100</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-red-500 to-green-500"
                                style={{ width: `${100 - (staticRes?.static_score || 0)}%` }}
                            />
                        </div>
                    </div>

                    {/* Capabilities */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Detected Capabilities</h3>
                        <div className="flex flex-wrap gap-2">
                            {(staticRes?.capabilities || []).length > 0 ? (
                                staticRes.capabilities.map((cap: string) => <CapabilityChip key={cap} cap={cap} />)
                            ) : (
                                <span className="text-slate-600 text-sm italic">No capabilities detected</span>
                            )}
                        </div>
                    </div>

                    {/* Sensitive Paths */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Sensitive Files</h3>
                        <ul className="space-y-2 text-sm">
                            {(staticRes?.sensitive_paths || []).map((path: string) => (
                                <li key={path} className="flex items-center gap-2 text-orange-400">
                                    <FileCode className="w-4 h-4" />
                                    {path}
                                </li>
                            ))}
                            {(staticRes?.sensitive_paths || []).length === 0 && (
                                <span className="text-slate-600 text-sm italic">Clean filesystem scan</span>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Right Col: Deep Audit */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="bg-slate-950/50 p-6 border-b border-slate-800">
                            <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                <Shield className="w-5 h-5" />
                                <h2 className="font-semibold">Deep Audit Findings</h2>
                            </div>
                            <p className="text-slate-400 text-sm">{deepRes?.summary}</p>
                        </div>

                        <div className="divide-y divide-slate-800">
                            {(deepRes?.findings || []).map((finding: any, idx: number) => (
                                <div key={idx} className="p-6 hover:bg-slate-900/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h4 className="text-white font-medium flex items-center gap-2">
                                                {finding.title}
                                            </h4>
                                            <p className="text-slate-400 text-sm mt-1">{finding.why_it_matters}</p>
                                        </div>
                                        <RiskBadge level={finding.severity} />
                                    </div>

                                    {finding.evidence.length > 0 && (
                                        <div className="mt-4">
                                            <div className="flex items-center gap-2 text-xs text-indigo-400 mb-1 font-mono">
                                                <FileCode className="w-3 h-3" />
                                                <span>{finding.evidence[0].source}</span>
                                            </div>
                                            <div className="bg-slate-950 rounded border border-slate-800 p-3 font-mono text-xs text-slate-300 overflow-x-auto">
                                                {finding.evidence[0].snippet}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Attack Chain */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Attack Surface Chain</h3>
                        <div className="space-y-4">
                            {(deepRes?.attack_chain || []).map((step: string, i: number) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-bold border border-slate-700">
                                            {i + 1}
                                        </div>
                                        {i < (deepRes?.attack_chain || []).length - 1 && (
                                            <div className="w-px h-full bg-slate-800 my-1" />
                                        )}
                                    </div>
                                    <p className="text-slate-300 text-sm py-1">{step}</p>
                                </div>
                            ))}
                            {(deepRes?.attack_chain || []).length === 0 && (
                                <p className="text-slate-500 text-sm italic">No specific attack chain identified.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
