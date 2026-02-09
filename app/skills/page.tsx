import { supabaseAdmin } from "@/lib/supabase";
import { SkillFilterSidebar } from "@/components/SkillFilterSidebar";
import { DirectoryGrid } from "@/components/DirectoryGrid";
import { Shield, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTierFromScore } from "@/lib/safetyScore";

export const revalidate = 0;

interface SkillsPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SkillsPage({ searchParams }: SkillsPageProps) {
    const params = await searchParams;
    const tierFilter = typeof params.tier === "string" ? params.tier : "all";
    const categoryFilter = typeof params.category === "string" ? params.category : "all";
    const badgeFilter = typeof params.badge === "string" ? params.badge : "all";

    // 1. Fetch All Scans with Skills (we'll filter in JS for flexibility due to complex JSON structure)
    // In a real app at scale, we'd use more complex SQL or RPC functions
    const { data: rawScans, error } = await (supabaseAdmin
        .from("scans") as any)
        .select(`
            *,
            skills (
                id,
                name,
                slug,
                category,
                source_url
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching skills:", error);
        return <div className="p-8 text-red-400">Error loading skills. Please try again.</div>;
    }

    // 2. Client-side filtering simulation (since we have mixed JSON/relational data)
    let filteredScans = rawScans || [];

    // Filter by Tier (using unified scoring)
    if (tierFilter !== "all") {
        filteredScans = filteredScans.filter((s: any) => {
            const score = s.deep_json?.safety_score || 0;
            const tier = getTierFromScore(score);
            return tier === tierFilter;
        });
    }

    // Filter by Category
    if (categoryFilter !== "all") {
        filteredScans = filteredScans.filter((s: any) =>
            s.skills?.category === categoryFilter
        );
    }

    // Filter by Badge/Risk
    if (badgeFilter !== "all") {
        filteredScans = filteredScans.filter((s: any) => {
            const score = s.deep_json?.safety_score || 0;
            const tier = getTierFromScore(score);

            if (badgeFilter === "gemini_certified") {
                return ['platinum', 'diamond', 'obsidian'].includes(tier);
            }
            if (badgeFilter === "official") {
                const stageStatus = s.stage_status || {};
                return !!stageStatus.officialSource;
            }
            if (badgeFilter === "extreme_danger") {
                const staticJson = s.static_json || {};
                const stageStatus = s.stage_status || {};
                return staticJson.has_injection_attempt || stageStatus.has_injection_attempt;
            }
            return true;
        });
    }

    // Deduplicate by skill_id (keep latest scan)
    const uniqueScans = new Map();
    for (const scan of filteredScans) {
        if (!uniqueScans.has(scan.skill_id)) {
            uniqueScans.set(scan.skill_id, scan);
        }
    }
    const finalScans = Array.from(uniqueScans.values());

    return (
        <div className="min-h-screen bg-slate-950 text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-slate-800 pb-8">
                    <div>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">
                            Skill Directory
                        </h1>
                        <p className="text-slate-400 max-w-2xl">
                            Explore {finalScans.length} analyzed AI skills. Filter by safety tier, risk level, and category.
                        </p>
                    </div>
                    <Link
                        href="/scan"
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Shield className="w-4 h-4" />
                        Scan New Skill
                    </Link>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Sidebar */}
                    <div className="md:w-64 flex-shrink-0">
                        <div className="sticky top-24">
                            <SkillFilterSidebar />
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="flex-1">
                        <DirectoryGrid scans={finalScans} showFilters={false} />

                        {finalScans.length === 0 && (
                            <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                                <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-white mb-2">No skills found</h3>
                                <p className="text-slate-400">Try adjusting your filters or scan a new skill.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
