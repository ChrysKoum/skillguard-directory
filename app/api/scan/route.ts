import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin, supabase } from "@/lib/supabase";
import { fetchRepoZip } from "@/lib/github";
import { performStaticScan } from "@/lib/staticScanner";
import { performDeepAudit } from "@/lib/geminiAudit";
import { generateAndStoreArtifacts } from "@/lib/artifacts";
import { buildSmartScanPack } from "@/lib/scanPack";

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

        // 5. Run Pipelines (Background Mode)
        // We do NOT await this. We return immediately so the UI can poll.
        // This solves the HTTP Timeout issue.
        const pipelinePromise = runAnalysisPipeline(scanId, normalizedUrl);

        // In Next.js/Vercel, we should use waitUntil if available to keep lambda alive
        // For local dev, just floating the promise is fine.
        // @ts-ignore
        if (typeof context !== 'undefined' && context.waitUntil) {
            // @ts-ignore
            context.waitUntil(pipelinePromise);
        }

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

        // Update DB: Ingesting
        await updateScanStatus(scanId, "ingesting", { static: "pending", deep: "pending" }, "Fetching repository...");

        // A. Ingest
        const pack = await fetchRepoZip(url);

        // Update DB: Static Scan
        await updateScanStatus(scanId, "analysis", { static: "scanning", deep: "pending" }, `Analyzing ${pack.files.length} files...`);

        // B. Static
        const staticRes = performStaticScan(pack);

        // C. Smart Deep Audit (Token Budgeting)
        await updateScanStatus(scanId, "analysis", { static: "done", deep: "pending" }, `Processing ${pack.files.length} files to select the most critical for deep audit...`);
        console.log(`[Pipeline] Building Smart Pack for ${scanId}...`);
        const smartPack = buildSmartScanPack(pack, staticRes);
        console.log(`[Pipeline] Smart Pack: ${smartPack.files.length} files (${smartPack.total_tokens} tokens). warnings: ${smartPack.warnings.length}`);

        // Update DB: Deep Audit Start
        const keyFiles = smartPack.files.slice(0, 3).map(f => f.path).join(", ");
        const remaining = smartPack.files.length - 3;
        await updateScanStatus(
            scanId,
            "analysis",
            { static: "done", deep: "scanning" },
            `Deep Audit: Asking Gemini 3 Pro to review ${keyFiles} ${remaining > 0 ? `+ ${remaining} others` : ""} (${(smartPack.total_tokens / 1000).toFixed(1)}k tokens)...`
        );

        // D. Deep Audit (Gemini 3 Pro -> Flash Fallback) with STREAMING feedback
        const deepRes = await performDeepAudit(smartPack, staticRes, "gemini-3-pro-preview", async (progress) => {
            // Update DB with real-time streaming progress
            await updateScanStatus(
                scanId,
                "analysis",
                { static: "done", deep: "scanning" },
                progress.message
            );
        });

        // Add warnings to deepRes summary if truncated
        if (smartPack.warnings.length > 0) {
            deepRes.summary += `\n\n**Note:** ${smartPack.warnings.join(" ")}`;
        }

        // E. Artifacts
        await generateAndStoreArtifacts(scanId, deepRes);

        // F. Badge Logic - Calculate tier based on findings
        const criticalCount = deepRes.findings.filter(f => f.severity === "critical").length;
        const highCount = deepRes.findings.filter(f => f.severity === "high").length;
        const findingsCount = deepRes.findings.length;

        // Calculate badge tier (Paper → Obsidian)
        let badge: string = "iron";
        if (criticalCount >= 2) badge = "paper";
        else if (criticalCount >= 1) badge = "iron";
        else if (highCount >= 3) badge = "paper";
        else if (highCount >= 2) badge = "iron";
        else if (highCount >= 1) badge = "bronze";
        else if (deepRes.risk_level === "high" || findingsCount >= 5) badge = "iron";
        else if (deepRes.risk_level === "medium" || findingsCount >= 3) badge = "bronze";
        else if (findingsCount === 2) badge = "silver";
        else if (findingsCount === 1) badge = staticRes.static_score < 30 ? "gold" : "silver";
        else if (findingsCount === 0) {
            if (staticRes.static_score < 10) badge = "obsidian";
            else if (staticRes.static_score < 20) badge = "diamond";
            else if (staticRes.static_score < 40) badge = "platinum";
            else badge = "gold";
        }

        // G. Update DB Final
        await (supabaseAdmin.from("scans") as any).update({
            status: deepRes.findings[0]?.title === "Deep Audit Unavailable" ? "done_with_warnings" : "done",
            risk_level: deepRes.risk_level,
            verified_badge: badge,
            static_json: staticRes as any,
            deep_json: deepRes as any,
            deep_model_used: (deepRes as any)._model_used || "unknown",
            stage_status: { static: "done", deep: "done", smart_pack: "built" },
            warnings: smartPack.warnings,
            progress_msg: "Analysis Complete."
        }).eq("id", scanId);

        console.log(`[Pipeline] Success for ${scanId}`);
    } catch (err) {
        console.error(`[Pipeline] Failed for ${scanId}`, err);
        await (supabaseAdmin.from("scans") as any).update({
            status: "error",
            error_text: err instanceof Error ? err.message : String(err),
            progress_msg: "Failed."
        }).eq("id", scanId);
        // We don't throw here because we are in background
    }
}

async function updateScanStatus(id: string, status: string, stage: any, msg: string) {
    console.log(`[Pipeline] Status update for ${id}: ${msg}`);
    // Update both stage_status.msg AND progress_msg for compatibility
    await (supabaseAdmin.from("scans") as any).update({
        status,
        stage_status: { ...stage, msg },
        progress_msg: msg
    }).eq("id", id);
}

function parseGitHubInfo(url: string) {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return { owner: parts[0], repo: parts[1] };
}
