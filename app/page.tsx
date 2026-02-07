import { supabaseAdmin } from "@/lib/supabase";
import { RiskBadge } from "@/components/ui/RiskBadge";
import Link from "next/link";
import { Search, ShieldAlert, CheckCircle2 } from "lucide-react";

export const revalidate = 0; // Always fresh

async function getRecentScans() {
  const { data } = await supabaseAdmin
    .from("scans")
    .select(`
      id,
      risk_level,
      created_at,
      status,
      skills (
        name,
        slug
      )
    `)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(12);

  return data || [];
}

export default async function Home() {
  const recentScans = await getRecentScans();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Hero Section */}
      <section className="py-24 px-4 text-center bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium border border-indigo-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Gemini 3 Powered Security Audit
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Is that Agent <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Safe?</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            SkillGuard provides a trusted nutrition label for AI Agents.
            Deep code audit, capability extraction, and risk analysis in seconds.
          </p>

          <div className="mt-8 max-w-md mx-auto">
            <Link href="/scan">
              <button className="w-full relative inline-flex h-12 overflow-hidden rounded-lg p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50">
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#500724_50%,#E2E8F0_100%)]" />
                <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-lg bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl transition-all hover:bg-slate-900">
                  <Search className="w-4 h-4 mr-2" />
                  Scan a GitHub Repo
                </span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Directory Section */}
      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-white">Recent Audits</h2>
          <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">View all</Link>
        </div>

        {recentScans.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
            <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No Audits Yet</h3>
            <p className="text-slate-500">Be the first to scan an agent!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentScans.map((scan: any) => (
              <Link key={scan.id} href={`/skill/${scan.skills.id}`} className="group block">
                <div className="h-full bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-slate-900 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                        {scan.skills.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">{scan.skills.slug}</p>
                    </div>
                    <RiskBadge level={scan.risk_level} />
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/50 text-xs text-slate-400">
                    <CheckCircle2 className="w-3 h-3 text-slate-600" />
                    <span>Scanned {new Date(scan.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
