import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin, supabase } from "@/lib/supabase";
import { fetchRepoZip } from "@/lib/github";
import { performStaticScan } from "@/lib/staticScanner";
import { performDeepAudit } from "@/lib/geminiAudit";
import { generateAndStoreArtifacts } from "@/lib/artifacts";
import { buildSmartScanPack } from "@/lib/scanPack";
import { calculateSafetyScore, getTierFromScore, getTierDescription } from "@/lib/safetyScore";

// Set max duration for Vercel (if Pro)
export const maxDuration = 60;

const scanSchema = z.object({
    url: z.string().url().regex(/github\.com\/[\w-]+\/[\w-]+/),
    forceRescan: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
    try {
        // 0. Rate Limiting (Global)
        const limitStr = process.env.SCAN_LIMIT_PER_HOUR;
        if (limitStr) {
            const limit = parseInt(limitStr, 10);
            if (!isNaN(limit) && limit > 0) {
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
                const { count, error: countError } = await supabaseAdmin
                    .from("scans")
                    .select("*", { count: "exact", head: true })
                    .gte("created_at", oneHourAgo);

                if (countError) {
                    console.error("Rate limit check failed", countError);
                } else if (count !== null && count >= limit) {
                    return NextResponse.json(
                        { error: `Global scan limit reached (${limit}/hour). Please try again later.` },
                        { status: 429 }
                    );
                }
            }
        }

        const body = await req.json();
        const { url, forceRescan } = scanSchema.parse(body);

        // 1. Resolve Skill (Slug)
        const { owner, repo, subpath } = parseGitHubInfo(url);
        // If subpath exists, append it to slug: owner/repo/path/to/skill
        const slug = subpath
            ? `${owner}/${repo}/${subpath}`.toLowerCase()
            : `${owner}/${repo}`.toLowerCase();

        const normalizedUrl = subpath
            ? `https://github.com/${owner}/${repo}/tree/main/${subpath}`
            : `https://github.com/${owner}/${repo}`;

        // ... rest of the code ...

        function parseGitHubInfo(url: string) {
            const u = new URL(url);
            const parts = u.pathname.split("/").filter(Boolean);
            // Handle /tree/main/path format
            if (parts.length >= 4 && parts[2] === "tree") {
                return {
                    owner: parts[0],
                    repo: parts[1],
                    subpath: parts.slice(4).join("/")
                };
            }
            return { owner: parts[0], repo: parts[1], subpath: "" };
        }

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
            // Use subdirectory name if scanning a subpath, otherwise use repo name
            const skillName = subpath
                ? subpath.split('/').pop() || repo  // Use last part of path
                : repo;

            const { data: newSkill, error: createError } = await (supabaseAdmin
                .from("skills") as any)
                .insert({
                    name: skillName,
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

        // Detect if official source
        const OFFICIAL_SOURCES: Record<string, string> = {
            "anthropics": "Anthropic",
            "openai": "OpenAI",
            "microsoft": "Microsoft",
            "google": "Google",
            "vercel": "Vercel",
            "cursor-ai": "Cursor AI"
        };
        const officialSource = OFFICIAL_SOURCES[owner.toLowerCase()] || null;

        // 4. Create Scan Record (Running)
        const { data: scan, error: scanError } = await (supabaseAdmin
            .from("scans") as any)
            .insert({
                skill_id: skillId,
                status: "running",
                risk_level: null,
                progress_msg: "Initializing scan...",
                stage_status: {
                    static: "pending",
                    deep: "pending",
                    msg: "Initializing scan...",
                    owner,
                    subpath: subpath || null,
                    officialSource
                },
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
        await updateScanStatus(scanId, "running", { static: "pending", deep: "pending" }, "Fetching repository...");

        // A. Ingest
        const pack = await fetchRepoZip(url);

        // Update DB: Static Scan - include totalRepoFiles
        await updateScanStatus(scanId, "running", {
            static: "scanning",
            deep: "pending",
            totalRepoFiles: pack.files.length
        }, `Analyzing ${pack.files.length} files...`);

        // B. Static
        const staticRes = performStaticScan(pack);

        // C. Smart Deep Audit (Token Budgeting)
        await updateScanStatus(scanId, "running", {
            static: "done",
            deep: "pending",
            totalRepoFiles: pack.files.length
        }, `Processing ${pack.files.length} files to select the most critical for deep audit...`);
        console.log(`[Pipeline] Building Smart Pack for ${scanId}...`);
        const smartPack = buildSmartScanPack(pack, staticRes);
        console.log(`[Pipeline] Smart Pack: ${smartPack.files.length} files (${smartPack.total_tokens} tokens). warnings: ${smartPack.warnings.length}`);

        // Update DB: Deep Audit Start - include ALL file info for frontend
        const keyFiles = smartPack.files.slice(0, 3).map(f => f.path).join(", ");
        const remaining = smartPack.files.length - 3;
        const tokenCountK = (smartPack.total_tokens / 1000).toFixed(1);
        await updateScanStatus(
            scanId,
            "running",
            {
                static: "done",
                deep: "scanning",
                totalRepoFiles: pack.files.length,
                criticalFiles: smartPack.files.length,
                tokenCount: tokenCountK
            },
            `Deep Audit: Requesting Gemini AI review of ${keyFiles} ${remaining > 0 ? `+ ${remaining} others` : ""} (${tokenCountK}k tokens)...`
        );

        // D. Deep Audit with STREAMING feedback
        // Store file info for the streaming callback to preserve
        const fileInfo = {
            totalRepoFiles: pack.files.length,
            criticalFiles: smartPack.files.length,
            tokenCount: tokenCountK
        };

        const deepRes = await performDeepAudit(smartPack, staticRes, "gemini-3-pro-preview", async (progress) => {
            // Update DB with real-time streaming progress - PRESERVE file counts!
            await updateScanStatus(
                scanId,
                "running",
                {
                    static: "done",
                    deep: "scanning",
                    ...fileInfo  // Always include file counts
                },
                progress.message
            );
        });

        // Add warnings to deepRes summary if truncated
        if (smartPack.warnings.length > 0) {
            deepRes.summary += `\n\n**Note:** ${smartPack.warnings.join(" ")}`;
        }

        // E. Calculate Safety Score and Tier (Unified System)
        const safetyScore = calculateSafetyScore(deepRes.findings, staticRes);
        const badge = getTierFromScore(safetyScore);
        const tierDescription = getTierDescription(badge);

        // F. Artifacts
        const reportData = {
            scan_id: scanId,
            target_url: url,
            timestamp: new Date().toISOString(),
            risk_assessment: {
                level: deepRes.risk_level,
                score: safetyScore, // Use unified score
                tier: badge,
                tier_description: tierDescription
            },
            findings: deepRes.findings,
            verification_plan: deepRes.verification_plan,
            policy_suggestions: deepRes.policy_suggestions,
            static_analysis: staticRes,
            excluded_files: smartPack.warnings, // Contains info about truncated/excluded files
            token_usage: deepRes.token_usage,
            model_used: (deepRes as any)._model_used || "unknown"
        };
        await generateAndStoreArtifacts(scanId, deepRes, reportData);

        // G. Update DB Final
        // Inject safety_score into deepRes for frontend consumption
        (deepRes as any).safety_score = safetyScore;

        // G. Update DB Final
        console.log(`[Pipeline] Final update for ${scanId}: badge=${badge}, safetyScore=${safetyScore}, findings=${deepRes.findings.length}`);
        const { error: updateError } = await (supabaseAdmin.from("scans") as any).update({
            status: deepRes.findings[0]?.title === "Deep Audit Unavailable" ? "done_with_warnings" : "done",
            risk_level: deepRes.risk_level,
            verified_badge: badge,
            static_json: staticRes as any,
            deep_json: deepRes as any,
            deep_model_used: (deepRes as any)._model_used || "unknown",
            stage_status: {
                static: "done",
                deep: "done",
                smart_pack: "built",
                has_injection_attempt: staticRes.has_injection_attempt,
                injection_evidence: staticRes.injection_evidence
            },
            warnings: smartPack.warnings,
            progress_msg: "Analysis Complete."
        }).eq("id", scanId);

        if (updateError) {
            console.error(`[Pipeline] DB UPDATE FAILED for ${scanId}:`, updateError);
            throw new Error(`DB update failed: ${updateError.message}`);
        }

        // H. Update skill category if suggested by LLM
        if (deepRes.suggested_category && deepRes.suggested_category !== "Uncategorized") {
            // Get the skill_id from the scan
            const { data: scanData } = await (supabaseAdmin.from("scans") as any)
                .select("skill_id")
                .eq("id", scanId)
                .single();

            if (scanData?.skill_id) {
                // Only update if category is empty or "Uncategorized"
                const { data: skill } = await (supabaseAdmin.from("skills") as any)
                    .select("category")
                    .eq("id", scanData.skill_id)
                    .single();

                if (!skill?.category || skill.category === "Uncategorized") {
                    await (supabaseAdmin.from("skills") as any)
                        .update({ category: deepRes.suggested_category })
                        .eq("id", scanData.skill_id);
                    console.log(`[Pipeline] Updated skill category to: ${deepRes.suggested_category}`);
                }
            }
        }

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

    const { error } = await (supabaseAdmin.from("scans") as any).update({
        status,
        stage_status: { ...stage, msg },
        progress_msg: msg
    }).eq("id", id);

    if (error) {
        console.error(`[Pipeline] STATUS UPDATE FAILED for ${id}:`, error);
    } else {
        console.log(`[Pipeline] Status updated successfully for ${id}: ${msg}`);
    }
}

function parseGitHubInfo(url: string) {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return { owner: parts[0], repo: parts[1] };
}
