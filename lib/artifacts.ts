import { DeepAuditResult } from "./geminiAudit";
import { supabaseAdmin } from "./supabase";

export async function generateAndStoreArtifacts(
    scanId: string,
    auditResult: DeepAuditResult
): Promise<string[]> {
    const artifactsCreated: string[] = [];

    // 1. Policy JSON
    // Standardized format for "Antigravity" or generic runtime enforcement
    const policyJson = {
        meta: {
            generated_by: "SkillGuard",
            scan_id: scanId,
            timestamp: new Date().toISOString(),
            risk_level: auditResult.risk_level
        },
        policy: {
            network: {
                allowed_domains: auditResult.policy_suggestions.allow_domains
            },
            filesystem: {
                denied_paths: auditResult.policy_suggestions.deny_paths
            },
            execution: {
                restrictions: auditResult.policy_suggestions.tool_restrictions
            }
        }
    };

    const policyPath = `skillguard/${scanId}/policy.json`;
    await uploadString(policyPath, JSON.stringify(policyJson, null, 2), "application/json");
    artifactsCreated.push(policyPath);
    await recordArtifact(scanId, "policy_json", policyPath);


    // 2. Verification Plan (Markdown)
    const verificationMd = `
# Verification Plan for Skill Candidate

**Scan ID**: \`${scanId}\`
**Risk Level**: ${auditResult.risk_level.toUpperCase()}

## 1. Preflight Checks
Before running the agent, verify:
${auditResult.verification_plan.preflight_checks.map(c => `- [ ] ${c}`).join("\n")}

## 2. Runtime Verification
While the agent is running, observe:
${auditResult.verification_plan.runtime_checks.map(c => `- [ ] ${c}`).join("\n")}

## 3. Post-Run Audit
After execution, check:
${auditResult.verification_plan.postrun_checks.map(c => `- [ ] ${c}`).join("\n")}

## Security Summary
${auditResult.summary}
`;

    const verificationPath = `skillguard/${scanId}/verification_plan.md`;
    await uploadString(verificationPath, verificationMd, "text/markdown");
    artifactsCreated.push(verificationPath);
    await recordArtifact(scanId, "verification_md", verificationPath);

    return artifactsCreated;
}

async function uploadString(path: string, content: string, contentType: string) {
    const { error } = await supabaseAdmin.storage
        .from("skillguard")
        .upload(path, content, {
            contentType,
            upsert: true
        });

    if (error) {
        console.error(`[Storage] Failed to upload ${path}:`, error);
        throw error;
    }
}

async function recordArtifact(scanId: string, type: "policy_json" | "verification_md" | "patch_diff", path: string) {
    const { error } = await (supabaseAdmin
        .from("artifacts") as any)
        .insert({
            scan_id: scanId,
            type,
            storage_path: path
        });

    if (error) {
        console.error(`[DB] Failed to record artifact ${path}:`, error);
    }
}
