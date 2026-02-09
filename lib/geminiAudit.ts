import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ScanPack } from "./github";
import { StaticScanResult } from "./staticScanner";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Gemini 2.0/3.0 usually supports "responseSchema" natively.
// We define the schema here for clarity and use.

export interface AuditFinding {
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    why_it_matters: string;
    evidence: Array<{
        source: string;
        snippet: string;
    }>;
    recommended_fix: string;
}

export interface DeepAuditResult {
    risk_level: "low" | "medium" | "high";
    summary: string;
    findings: AuditFinding[];
    attack_chain: string[];
    safe_run_checklist: string[];
    suggested_category: string;  // LLM-suggested category for the skill
    policy_suggestions: {
        allow_domains: string[];
        deny_paths: string[];
        tool_restrictions: string[];
    };
    verification_plan: {
        preflight_checks: string[];
        runtime_checks: string[];
        postrun_checks: string[];
    };
    token_usage?: {
        prompt: number;
        response: number;
        total: number;
    };
}

const auditSchema = {
    type: SchemaType.OBJECT,
    properties: {
        risk_level: { type: SchemaType.STRING, enum: ["low", "medium", "high"] },
        summary: { type: SchemaType.STRING },
        findings: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    title: { type: SchemaType.STRING },
                    severity: { type: SchemaType.STRING, enum: ["critical", "high", "medium", "low"] },
                    why_it_matters: { type: SchemaType.STRING },
                    evidence: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                source: { type: SchemaType.STRING },
                                snippet: { type: SchemaType.STRING }
                            },
                            required: ["source", "snippet"]
                        }
                    },
                    recommended_fix: { type: SchemaType.STRING }
                },
                required: ["title", "severity", "why_it_matters", "evidence", "recommended_fix"]
            }
        },
        attack_chain: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        safe_run_checklist: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        policy_suggestions: {
            type: SchemaType.OBJECT,
            properties: {
                allow_domains: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                deny_paths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                tool_restrictions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            },
            required: ["allow_domains", "deny_paths", "tool_restrictions"]
        },
        verification_plan: {
            type: SchemaType.OBJECT,
            properties: {
                preflight_checks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                runtime_checks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                postrun_checks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            },
            required: ["preflight_checks", "runtime_checks", "postrun_checks"]
        },
        suggested_category: {
            type: SchemaType.STRING,
            enum: [
                "Coding Agents & IDEs",
                "DevOps & Cloud",
                "Security & Passwords",
                "AI & LLMs",
                "Web & Frontend Development",
                "Productivity & Tasks",
                "Data & Analytics",
                "Uncategorized"
            ]
        }
    },
    required: ["risk_level", "summary", "findings", "attack_chain", "safe_run_checklist", "policy_suggestions", "verification_plan", "suggested_category"]
};

// Progress callback type for streaming updates
export type AuditProgressCallback = (progress: {
    message: string;
    findingsCount?: number;
    partialFindings?: string[];
}) => Promise<void>;

export async function performDeepAudit(
    pack: ScanPack,
    staticResult: StaticScanResult,
    modelName: string = "gemini-3-pro-preview",
    onProgress?: AuditProgressCallback
): Promise<DeepAuditResult> {

    // 1. Construct the Prompt with FULL Context
    const fileContext = pack.files.map(f => `
<file path="${f.path}">
${f.content}
</file>
`).join("\n");

    const staticContext = JSON.stringify(staticResult, null, 2);

    const systemPrompt = `
You are SkillGuard, a Senior Security Auditor for AI Agents.
Your job is to analyze the provided codebase for a "Skill" (Agent Tool) and produce a structured security report.

CONTEXT:
- You are strictly auditing for security risks, malware, and hidden behaviors.
- You must identify if the code does what it claims or has "Vibe Engineering" flaws (e.g. leaking data, unexpected networking).
- Use the "Static Analysis" results as a lead, but verify them with the actual code.
- "Vibe Engineering" Track: Produce a "Verification Plan" that allows a user to safely test this agent.

IMPORTANT CITATION RULES:
- In \`findings[].evidence\`, you MUST provide the exact \`source\` (file path) and \`snippet\`.
- If possible, include the line number in the snippet or title (e.g. "Line 45: bad_function()").
- Do not invent file paths; use the ones provided in the <file path="..."> tags.

INPUT DATA:
- STATIC FINDINGS: ${staticContext}
- FULL CODEBASE:
${fileContext}

INSTRUCTIONS:
1. Trace execution paths from identified entry points (package.json, Dockerfile) to sensitive operations.
2. Confirm if "Static Risks" are real or benign.
3. Identify logical vulnerabilities (e.g., prompt injection susceptibility, insecure defaults).
4. Output STRICT JSON matching the schema.
`;

    const modelsToTry = [
        "gemini-3-pro-preview",
        "gemini-3-flash-preview",
        "gemini-2.0-flash"
    ];

    let lastError;

    for (const modelName of modelsToTry) {
        try {
            console.log(`[Gemini Audit] Attempting with model: ${modelName}`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: auditSchema as any
                }
            });

            // Use streaming if callback provided, otherwise use regular generation
            if (onProgress) {
                await onProgress({ message: `Deep Audit: Analyzing with ${modelName}...` });

                const result = await generateWithStreaming(model, systemPrompt, onProgress);
                const parsed = JSON.parse(result.text) as DeepAuditResult;

                parsed.token_usage = {
                    prompt: result.usage?.promptTokenCount || 0,
                    response: result.usage?.candidatesTokenCount || 0,
                    total: result.usage?.totalTokenCount || 0
                };
                (parsed as any)._model_used = modelName;

                await onProgress({
                    message: `Found ${parsed.findings.length} potential issue(s).`,
                    findingsCount: parsed.findings.length,
                    partialFindings: parsed.findings.map(f => f.title)
                });

                return parsed;
            } else {
                // Non-streaming fallback
                const result = await generateWithRetry(model, systemPrompt);
                const responseText = result.response.text();
                const usage = result.response.usageMetadata;

                const parsed = JSON.parse(responseText) as DeepAuditResult;
                parsed.token_usage = {
                    prompt: usage?.promptTokenCount || 0,
                    response: usage?.candidatesTokenCount || 0,
                    total: usage?.totalTokenCount || 0
                };
                (parsed as any)._model_used = modelName;

                return parsed;
            }

        } catch (error) {
            console.warn(`[Gemini Audit] Failed with ${modelName}:`, error);
            lastError = error;
        }
    }

    // All models failed
    console.error("[Gemini Audit] All models failed.", lastError);
    return {
        risk_level: "high",
        summary: `Audit Failed on all models (Pro, Flash). Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
        findings: [{
            title: "Deep Audit Unavailable",
            severity: "medium",
            why_it_matters: "AI analysis could not complete. Rely on Static Analysis results.",
            evidence: [],
            recommended_fix: "Try rescanning later."
        }],
        attack_chain: [],
        safe_run_checklist: ["Manual review required."],
        suggested_category: "Uncategorized",
        policy_suggestions: { allow_domains: [], deny_paths: [], tool_restrictions: [] },
        verification_plan: { preflight_checks: [], runtime_checks: [], postrun_checks: [] }
    };
}

async function generateWithStreaming(
    model: any,
    prompt: string,
    onProgress: AuditProgressCallback
): Promise<{ text: string; usage: any }> {
    let fullText = "";
    let findingsFound = 0;
    let lastFindingCount = 0;

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;

        // Try to count findings as they appear in the stream
        const findingsMatches = fullText.match(/"title"\s*:\s*"[^"]+"/g);
        findingsFound = findingsMatches ? findingsMatches.length : 0;

        // Update progress when new findings are detected
        if (findingsFound > lastFindingCount) {
            lastFindingCount = findingsFound;
            await onProgress({
                message: `Analyzing... Found ${findingsFound} issue(s) so far`,
                findingsCount: findingsFound
            });
        }
    }

    const response = await result.response;
    return {
        text: fullText || response.text(),
        usage: response.usageMetadata
    };
}


async function generateWithRetry(model: any, prompt: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await model.generateContent(prompt);
        } catch (error: any) {
            // Check for 429 or quota related messages
            const isRateLimit = error.status === 429 ||
                (error.message && error.message.includes("429")) ||
                (error.message && error.message.includes("Quota exceeded"));

            if (isRateLimit) {
                if (i === retries - 1) throw error; // Max retries reached

                // Backoff: 20s, 40s, 60s
                const delay = 20000 * (i + 1);
                console.log(`[Gemini Audit] Rate limited (Attempt ${i + 1}/${retries}). Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error; // Not a rate limit error, rethrow
        }
    }
    throw new Error("Analysis failed after retries");
}
