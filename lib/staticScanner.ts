import { ScanPack } from "@/lib/github";

export interface RiskFlag {
    code: string;
    severity: "critical" | "high" | "medium" | "low";
    evidence: string;
    file: string;
}

export interface StaticScanResult {
    capabilities: string[];
    sensitive_paths: string[];
    outbound_domains: string[];
    risk_flags: RiskFlag[];
    static_score: number; // 0-100, where 100 is risky
    has_injection_attempt: boolean; // Detected prompt injection / misleading comments
    injection_evidence: string[]; // Evidence of injection attempts
}

const CAPABILITY_REGEX = {
    shell: /(child_process|exec|spawn|execSync|shellt|subprocess\.run|os\.system|popen)/i,
    filesystem_read: /(fs\.read|readFileSync|cat |grep |open\(.*['"]r['"]\))/i,
    filesystem_write: /(fs\.write|writeFileSync|>>|echo .* >|open\(.*['"]w['"]\))/i,
    network: /(fetch\(|axios|http\.request|curl|wget|requests\.get|urllib|httpx)/i,
    browser_data: /(puppeteer|selenium|playwright|chrome-aws-lambda|cookies|webdriver)/i,
    env_access: /(process\.env|dotenv|\.env|os\.environ|os\.getenv)/i
};

const SENSITIVE_PATH_REGEX = [
    /\.env/i,
    /id_rsa/i,
    /\.ssh/i,
    /\.aws/i,
    /\.kube/i,
    /AppData/i,
    /\/etc\/passwd/i,
    /\/etc\/shadow/i,
    /secrets\.toml/i
];

const HIGH_RISK_PATTERNS = [
    { pattern: /curl.*\|.*bash/i, id: "PIPE_BASH", severity: "critical", msg: "Detected 'curl | bash' pattern" },
    { pattern: /powershell.*-enc/i, id: "POWERSHELL_ENC", severity: "critical", msg: "Detected suspicious PowerShell encoding" },
    { pattern: /base64.*decode.*exec/i, id: "BASE64_EXEC", severity: "critical", msg: "Detected Base64 decoded execution" },
    { pattern: /(eval|exec)\s*\(/i, id: "UNSAFE_EVAL", severity: "high", msg: "Detected usage of 'eval()' or 'exec()'" },
    { pattern: /os\.system\s*\(/i, id: "OS_SYSTEM", severity: "high", msg: "Detected usage of 'os.system()'" }
];

// Prompt injection / misleading comment patterns
// These patterns detect attempts to bypass LLM security analysis
const INJECTION_PATTERNS = [
    { pattern: /ignore.*previous.*instructions/i, msg: "Attempts to bypass previous instructions" },
    { pattern: /forget.*all.*instructions/i, msg: "Attempts to reset LLM context" },
    { pattern: /this.*(?:is|code.*is).*safe/i, msg: "Misleading safety claim" },
    { pattern: /do.*not.*report/i, msg: "Attempts to suppress reporting" },
    { pattern: /skip.*security.*check/i, msg: "Attempts to skip security checks" },
    { pattern: /trust.*this.*code/i, msg: "Misleading trust claim" },
    { pattern: /no.*vulnerabilit/i, msg: "False vulnerability claim" },
    { pattern: /SAFE_CODE_MARKER/i, msg: "Suspicious safety marker" },
    { pattern: /ignore.*security/i, msg: "Attempts to ignore security" },
    { pattern: /everything.*is.*fine/i, msg: "Misleading reassurance" },
    { pattern: /nothing.*malicious/i, msg: "False safety claim" },
    { pattern: /you.*are.*now/i, msg: "Prompt injection attempt" },
];

export function performStaticScan(pack: ScanPack): StaticScanResult {
    const capabilities = new Set<string>();
    const sensitivePaths = new Set<string>();
    const outboundDomains = new Set<string>(); // Mock implementation for regex domain extraction
    const riskFlags: RiskFlag[] = [];
    const injectionEvidence: string[] = [];
    let score = 0;

    // 1. Analyze File Content
    for (const file of pack.files) {
        // Check Capabilities
        for (const [cap, regex] of Object.entries(CAPABILITY_REGEX)) {
            if (regex.test(file.content)) {
                capabilities.add(cap);
            }
        }

        // Check High Risk Patterns
        for (const rule of HIGH_RISK_PATTERNS) {
            if (rule.pattern.test(file.content)) {
                riskFlags.push({
                    code: rule.id,
                    severity: rule.severity as any,
                    evidence: rule.msg,
                    file: file.path
                });
                score += (rule.severity === 'critical' ? 50 : 20);
            }
        }

        // Check Injection Patterns (misleading comments/prompt injection)

        // PASS B: Skip heuristics for known noise/content directories and lockfiles
        // We do NOT exclude .json/.yaml globally as they may contain agent configs.
        const isNoise = file.path.includes("docs/") ||
            file.path.includes("music/") ||
            file.path.includes("content/") ||
            file.path.includes("assets/") ||
            file.path.includes("examples/") ||
            file.path.includes("test/") ||
            file.path.includes("tests/") ||
            file.path.includes("__tests__/") ||
            file.path.includes("spec/") ||
            file.path.toLowerCase().endsWith("readme.md") ||
            file.path.endsWith("package-lock.json") ||
            file.path.endsWith("yarn.lock") ||
            file.path.endsWith("pnpm-lock.yaml") ||
            file.path.endsWith(".csv") ||
            file.path.endsWith(".txt") ||
            file.path.endsWith(".map"); // Source maps

        if (!isNoise) {
            for (const rule of INJECTION_PATTERNS) {
                if (rule.pattern.test(file.content)) {
                    injectionEvidence.push(`${file.path}: ${rule.msg}`);
                    score += 25; // Significant penalty for injection attempts
                }
            }
        }

        // Check Outbound Domains (Simple URL Regex)
        const urlMatches = file.content.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (urlMatches) {
            urlMatches.forEach(url => outboundDomains.add(new URL(url).hostname));
        }
    }

    // 2. Analyze File Names (Paths)
    for (const filePath of pack.fileTree) {
        for (const regex of SENSITIVE_PATH_REGEX) {
            if (regex.test(filePath)) {
                sensitivePaths.add(filePath);
                score += 10;
            }
        }
    }

    // Cap score
    if (score > 100) score = 100;

    return {
        capabilities: Array.from(capabilities),
        sensitive_paths: Array.from(sensitivePaths),
        outbound_domains: Array.from(outboundDomains).slice(0, 50), // Cap domains
        risk_flags: riskFlags,
        static_score: score,
        has_injection_attempt: injectionEvidence.length > 0,
        injection_evidence: injectionEvidence
    };
}
