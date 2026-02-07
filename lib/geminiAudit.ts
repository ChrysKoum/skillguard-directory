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
        }
    },
    required: ["risk_level", "summary", "findings", "attack_chain", "safe_run_checklist", "policy_suggestions", "verification_plan"]
};

export async function performDeepAudit(
    pack: ScanPack,
    staticResult: StaticScanResult,
    modelName: string = "gemini-2.0-flash-exp" // Use available model
): Promise<DeepAuditResult> {

    // 1. Construct the Prompt with FULL Context
    // We format the codebase as a single XML-like block for clear separation
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

    try {
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: auditSchema as any
            }
        });

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text();

        return JSON.parse(responseText) as DeepAuditResult;

    } catch (error) {
        console.error("[Gemini Audit] Failed:", error);
        // Return a fallback error object to strict type
        return {
            risk_level: "high",
            summary: "Audit Failed due to API error. Assume HIGH risk.",
            findings: [{
                title: "Audit Error",
                severity: "critical",
                why_it_matters: "Gemini API failed to process request.",
                evidence: [],
                recommended_fix: "Retry scan."
            }],
            attack_chain: [],
            safe_run_checklist: ["Do not run until scanned."],
            policy_suggestions: { allow_domains: [], deny_paths: [], tool_restrictions: [] },
            verification_plan: { preflight_checks: [], runtime_checks: [], postrun_checks: [] }
        };
    }
}
