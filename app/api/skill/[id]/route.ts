import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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

        return NextResponse.json({
            skill,
            scan,
            artifacts: artifactsWithUrls
        });

    } catch (err) {
        console.error("Get Skill Error:", err);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
