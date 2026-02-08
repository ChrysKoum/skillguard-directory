import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    console.log(`[GET /api/scan/${id}] Fetching scan...`);

    try {
        const { data: scan, error } = await (supabaseAdmin
            .from("scans") as any)
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            console.log(`[GET /api/scan/${id}] Error: ${error.message} (code: ${error.code})`);
            return NextResponse.json({ error: error.message }, { status: 404 });
        }

        console.log(`[GET /api/scan/${id}] Found scan with status: ${scan.status}`);
        return NextResponse.json(scan);
    } catch (err) {
        console.error(`[GET /api/scan/${id}] Exception:`, err);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
