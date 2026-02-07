import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin, supabase } from "@/lib/supabase";
import { fetchRepoZip } from "@/lib/github";
import { performStaticScan } from "@/lib/staticScanner";
import { performDeepAudit } from "@/lib/geminiAudit";
import { generateAndStoreArtifacts } from "@/lib/artifacts";

// Set max duration for Vercel (if Pro)
export const maxDuration = 60;

const scanSchema = z.object({
    url: z.string().url().regex(/github\.com\/[\w-]+\/[\w-]+/),
    forceRescan: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, forceRescan } = scanSchema.parse(body);

        // 1. Resolve Skill (Slug)
        const { owner, repo } = parseGitHubInfo(url);
        const slug = `${owner}/${repo}`.toLowerCase();
        const normalizedUrl = `https://github.com/${owner}/${repo}`;

        // 2. Check/Create Skill
        let skillId: string;
        const { data: existingSkill } = await (supabaseAdmin
            .from("skills")
            .select("id")
            .eq("slug", slug) as any)
            .maybeSingle();

        if (existingSkill) {
            skillId = existingSkill.id;
        } else {
            const { data: newSkill, error: createError } = await (supabaseAdmin
                .from("skills") as any)
                .insert({
                    name: repo,
                    slug: slug,
                    source_url: normalizedUrl,
                    source_type: "github",
                })
                .select("id")
                .single();

            if (createError) throw createError;
            skillId = newSkill.id;
        }

        // 3. Check Cache (if not forced)
        if (!forceRescan) {
            const { data: recentScan } = await (supabaseAdmin
                .from("scans")
                .select("id, status, created_at")
                .eq("skill_id", skillId)
                .eq("status", "done")
                .order("created_at", { ascending: false })
                .limit(1) as any)
                .maybeSingle();

            // If less than 24h old, return it
            if (recentScan) {
                const scanAge = new Date().getTime() - new Date(recentScan.created_at).getTime();
                // 24 hours = 86400000 ms
                if (scanAge < 86400000) {
                    return NextResponse.json({ skillId, scanId: recentScan.id, cached: true });
                }
            }
        }

        // 4. Create Scan Record (Running)
        const { data: scan, error: scanError } = await (supabaseAdmin
            .from("scans") as any)
            .insert({
                skill_id: skillId,
                status: "running",
                risk_level: null, // set later
                scan_pack_json: {}, // populate if debugging needed, or skip to save space
            })
            .select("id")
            .single();

        if (scanError) throw scanError;
        const scanId = scan.id;

        // 5. Run Pipelines (Await for now - simpler for MVP)
        // In a real production app, we'd fire this to a queue. 
        // Here we run it inline and hope we beat the timeout.

        // Return "running" state immediately so UI can poll
        // Note: If Vercel kills the lambda after response, this might fail. 
        // BUT for "Vibe Engineering" demos we often run locally or on generous timeouts.
        // Ideally we await it if comfortable with latency, but let's return early to enable "Loading UI".
        // WARNING: On Vercel Serverless, returning terminates execution unless using `waitUntil`.
        // Since we don't have waitUntil easily in Next.js App Router (it's internal), 
        // we MUST await unless we accept it might die.
        // DECISION: For Hackathon reliability, we AWAIT it. 
        // The user will see a spinner for 20-30s. Better than a silent failure.

        await runAnalysisPipeline(scanId, normalizedUrl);

        return NextResponse.json({ skillId, scanId, cached: false });

    } catch (err) {
        console.error("Scan Error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}

async function runAnalysisPipeline(scanId: string, url: string) {
    try {
        console.log(`[Pipeline] Starting for ${scanId}...`);

        // A. Ingest
        const pack = await fetchRepoZip(url);

        // B. Static
        const staticRes = performStaticScan(pack);

        // C. Deep Audit (1M Context)
        const deepRes = await performDeepAudit(pack, staticRes);

        // D. Artifacts
        await generateAndStoreArtifacts(scanId, deepRes);

        // E. Badge Logic
        let badge: "bronze" | "silver" | "pinned" | "none" = "none";
        if (deepRes.risk_level === "low" && staticRes.static_score < 50) badge = "silver";
        else if (deepRes.risk_level === "medium") badge = "bronze";

        // F. Update DB
        await (supabaseAdmin.from("scans") as any).update({
            status: "done",
            risk_level: deepRes.risk_level,
            verified_badge: badge,
            static_json: staticRes as any, // Cast to Json
            deep_json: deepRes as any
        }).eq("id", scanId);

        console.log(`[Pipeline] Success for ${scanId}`);
    } catch (err) {
        console.error(`[Pipeline] Failed for ${scanId}`, err);
        await (supabaseAdmin.from("scans") as any).update({
            status: "error",
            error_text: err instanceof Error ? err.message : String(err)
        }).eq("id", scanId);
        throw err; // Propagate so the route handler knows it failed if we are awaiting
    }
}

function parseGitHubInfo(url: string) {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return { owner: parts[0], repo: parts[1] };
}
