import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTierFromScore } from "@/lib/safetyScore";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        // 1. Fetch Skill
        const { data: skill, error: skillError } = await (supabaseAdmin
            .from("skills") as any)
            .select("*")
            .eq("id", id)
            .single();

        if (skillError) {
            return NextResponse.json({ error: "Skill not found" }, { status: 404 });
        }

        // 2. Fetch Latest Scan
        const { data: scan, error: scanError } = await (supabaseAdmin
            .from("scans") as any)
            .select("*")
            .eq("skill_id", id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        // It's possible there are no scans if creation failed, handle gracefully
        if (!scan) {
            return NextResponse.json({ skill, scan: null, artifacts: [] });
        }

        // 3. Fetch Artifacts for that scan
        const { data: artifacts } = await (supabaseAdmin
            .from("artifacts") as any)
            .select("*")
            .eq("scan_id", scan.id);

        // 4. Generate Signed URLs for artifacts (Valid for 1 hour)
        const artifactsWithUrls = await Promise.all((artifacts || []).map(async (art: any) => {
            const { data } = await supabaseAdmin.storage
                .from("skillguard")
                .createSignedUrl(art.storage_path, 3600);

            return {
                ...art,
                download_url: data?.signedUrl
            };
        }));

        // 5. Construct Report Summary
        const safetyScore = scan.deep_json?.safety_score || 0;
        const tier = getTierFromScore(safetyScore);

        // Find specific artifacts
        const policyArtifact = artifactsWithUrls.find((a: any) => a.artifact_type === "policy_json");
        const verificationArtifact = artifactsWithUrls.find((a: any) => a.artifact_type === "verification_md");

        // Trust Badge (Shields.io for now)
        const badgeColor =
            tier === "obsidian" || tier === "diamond" ? "brightgreen" :
                tier === "platinum" || tier === "gold" ? "green" :
                    tier === "silver" ? "yellow" :
                        tier === "bronze" || tier === "iron" ? "orange" : "red";

        const trustBadgeUrl = `https://img.shields.io/badge/Security_Tier-${tier.toUpperCase()}-${badgeColor}?style=for-the-badge&logo=shield`;

        const trustMeta = {
            schema_version: "1.0",
            skill_id: id,
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
                trust_badge_url: trustBadgeUrl,
                trust_meta: trustMeta,
                policy_url: policyArtifact?.download_url || null,
                verification_plan_url: verificationArtifact?.download_url || null
            }
        });

    } catch (err) {
        console.error("Get Skill Error:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
