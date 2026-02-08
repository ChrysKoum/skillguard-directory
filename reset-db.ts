import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function resetDb() {
    console.log("🔥 NUKING DATABASE...");

    // Dynamic import to ensure dotenv loads first
    const { supabaseAdmin } = await import("./lib/supabase");

    const steps = [
        async () => {
            console.log("   - Deleting artifacts...");
            return supabaseAdmin.from("artifacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        },
        async () => {
            console.log("   - Deleting scans...");
            return supabaseAdmin.from("scans").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        },
        async () => {
            console.log("   - Deleting skills...");
            return supabaseAdmin.from("skills").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        }
    ];

    for (const step of steps) {
        const { error } = await step();
        if (error) {
            console.error("FAILED:", error.message);
        }
    }

    console.log("✅ Database is empty.");
}

resetDb();
