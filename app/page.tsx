import { supabaseAdmin } from "@/lib/supabase";
import { DirectoryGrid } from "@/components/DirectoryGrid";
import Link from "next/link";
import { Search } from "lucide-react";

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
        id,
        name,
        slug
      )
    `)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(50); // Increased limit for directory feel

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
      <section id="directory" className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-white">Agent Directory</h2>
        </div>

        <DirectoryGrid scans={recentScans as any} />
      </section>
    </div>
  );
}
