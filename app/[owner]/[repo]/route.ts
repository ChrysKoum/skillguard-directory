import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTierFromScore } from "@/lib/safetyScore";

interface RouteParams {
    params: Promise<{ owner: string; repo: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { owner, repo } = await params;
        const slug = `${owner}/${repo}`.toLowerCase();

        // 1. Look up skill by slug
        const { data: skill, error: skillError } = await (supabaseAdmin
            .from("skills") as any)
            .select("*")
            .eq("slug", slug)
            .single();

        if (skillError || !skill) {
            return NextResponse.json({ error: "Skill not found" }, { status: 404 });
        }

        // 2. Check if this is an API request (curl, etc.) vs browser
        const acceptHeader = req.headers.get("accept") || "";
        const isApiRequest = acceptHeader.includes("application/json") ||
            !acceptHeader.includes("text/html");

        // 3. For browser requests, redirect to skill page
        if (!isApiRequest) {
            return NextResponse.redirect(new URL(`/skill/${skill.id}`, req.url));
        }

        // 4. For API requests, return full report (same as /api/skill/[id])
        const { data: scan } = await (supabaseAdmin
            .from("scans") as any)
            .select("*")
            .eq("skill_id", skill.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (!scan) {
            return NextResponse.json({ skill, scan: null, artifacts: [], report_summary: null });
        }

        // Fetch artifacts
        const { data: artifacts } = await (supabaseAdmin
            .from("artifacts") as any)
            .select("*")
            .eq("scan_id", scan.id);

        const artifactsWithUrls = await Promise.all((artifacts || []).map(async (art: any) => {
            const { data } = await supabaseAdmin.storage
                .from("skillguard")
                .createSignedUrl(art.storage_path, 3600);
            return { ...art, download_url: data?.signedUrl };
        }));

        // Build report summary
        const safetyScore = scan.deep_json?.safety_score || 0;
        const tier = getTierFromScore(safetyScore);
        const policyArtifact = artifactsWithUrls.find((a: any) => a.artifact_type === "policy_json");
        const verificationArtifact = artifactsWithUrls.find((a: any) => a.artifact_type === "verification_md");

        const badgeColor =
            tier === "obsidian" || tier === "diamond" ? "brightgreen" :
                tier === "platinum" || tier === "gold" ? "green" :
                    tier === "silver" ? "yellow" :
                        tier === "bronze" || tier === "iron" ? "orange" : "red";

        const trustMeta = {
            schema_version: "1.0",
            skill_id: skill.id,
            safety_score: safetyScore,
            tier: tier,
            verified: tier === "platinum" || tier === "diamond" || tier === "obsidian",
            scan_time: scan.created_at,
            top_risks: (scan.deep_json?.findings || []).slice(0, 3).map((f: any) => f.title)
        };

        return NextResponse.json({
            skill,
            scan,
            artifacts: artifactsWithUrls,
            report_summary: {
                safety_score: safetyScore,
                risk_tier: tier,
                trust_badge_url: `https://img.shields.io/badge/Security_Tier-${tier.toUpperCase()}-${badgeColor}?style=for-the-badge&logo=shield`,
                trust_meta: trustMeta,
                policy_url: policyArtifact?.download_url || null,
                verification_plan_url: verificationArtifact?.download_url || null
            }
        });

    } catch (err) {
        console.error("Friendly URL Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
