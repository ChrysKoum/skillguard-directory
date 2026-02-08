import { RepoFile, ScanPack } from "./github";

// Interfaces
export interface FileMetadata {
    path: string;
    extension: string;
    size: number;
    score: number;
    tokens: number; // Est. 4 chars per token
}

export interface SmartScanPack extends ScanPack {
    strategy: "smart" | "full";
    total_tokens: number;
    truncated_files: string[];
    warnings: string[];
}

// Configuration
const MAX_SMART_TOKENS = 120000;
const CHARS_PER_TOKEN = 4;
const MAX_FILES_IN_PACK = 60;
const MAX_FILE_SIZE_CHARS = 40000; // ~10k tokens

// Scoring Rules
const HIGH_VALUE_PATTERNS = [
    /package\.json$/, /requirements\.txt$/, /pyproject\.toml$/, /Cargo\.toml$/, // Deps
    /Dockerfile$/, /docker-compose/, // Infra
    /main\./, /index\./, /app\./, /server\./, // Entrypoints
    /README/, /SECURITY\.md/, /SKILL\.md/, // Docs
    /\.github\/workflows/, // CI/CD
    /auth/, /security/, /login/, /api/, // Sensitive Logic
    /\.env\.example/, // Config
];

const RISK_PATTERNS = [
    /exec\(/, /eval\(/, /subprocess/, /child_process/,
    /curl /, /wget /, /bash /, /sh /,
    /fs\.read/, /fs\.write/, /open\(/,
    /key/, /secret/, /token/, /password/
];

/**
 * Main function to build a smart scan pack (Stage B)
 */
export function buildSmartScanPack(
    fullPack: ScanPack,
    staticResults?: any // Optional static context to boost risky files
): SmartScanPack {

    // 1. Index & Score Files
    let metadataList = fullPack.files.map(f => scoreFile(f));

    // Boost files flagged by static analysis if available
    if (staticResults?.risk_flags) {
        const flaggedPaths = new Set(staticResults.risk_flags.map((rf: any) => rf.file));
        metadataList.forEach(m => {
            if (flaggedPaths.has(m.path)) m.score += 50;
        });
    }

    // 2. Sort by Score (Desc)
    metadataList.sort((a, b) => b.score - a.score);

    // 3. Select Files within Budget
    const selectedFiles: RepoFile[] = [];
    let currentTokens = 0;
    const truncated: string[] = [];
    const warnings: string[] = [];

    // Always include top 3 regardless of size (truncated if huge) to ensure context
    // Then fill budget
    for (const meta of metadataList) {
        if (selectedFiles.length >= MAX_FILES_IN_PACK) break;

        let content = fullPack.files.find(f => f.path === meta.path)?.content || "";
        let fileTokens = Math.ceil(content.length / CHARS_PER_TOKEN);

        // Truncate if individual file is too massive
        if (content.length > MAX_FILE_SIZE_CHARS) {
            content = content.slice(0, MAX_FILE_SIZE_CHARS) + "\n...[TRUNCATED BY SKILLGUARD]...";
            fileTokens = Math.ceil(content.length / CHARS_PER_TOKEN);
            truncated.push(meta.path);
        }

        // Check global budget
        if (currentTokens + fileTokens > MAX_SMART_TOKENS) {
            // If it's a very high score file, maybe include partial? 
            // For now, simple skip if budget full, unless it's critical (score > 80)
            if (meta.score > 80 && currentTokens < MAX_SMART_TOKENS * 1.1) {
                // Allow slight overflow for critical files
            } else {
                continue; // Skip fits
            }
        }

        selectedFiles.push({ path: meta.path, content });
        currentTokens += fileTokens;
    }

    if (truncated.length > 0) {
        warnings.push(`Truncated ${truncated.length} large files to fit token budget.`);
    }
    if (fullPack.files.length > selectedFiles.length) {
        warnings.push(`Analyzed top ${selectedFiles.length} files out of ${fullPack.files.length} for Deep Audit.`);
    }

    return {
        ...fullPack,
        files: selectedFiles,
        strategy: "smart",
        total_tokens: currentTokens,
        truncated_files: truncated,
        warnings
    };
}

function scoreFile(file: RepoFile): FileMetadata {
    let score = 10; // Base score
    const path = file.path;
    const size = file.content.length;

    // Pattern Matching
    for (const pattern of HIGH_VALUE_PATTERNS) {
        if (pattern.test(path)) score += 20;
    }

    // Risk Content Matching (Simple heuristic)
    // We limit this checks to first 2k chars to avoid perf hit on massive files in this step
    const preview = file.content.slice(0, 2000);
    for (const pattern of RISK_PATTERNS) {
        if (pattern.test(preview)) score += 10;
    }

    // Downrank low value
    if (path.includes("test") || path.includes("spec")) score -= 5;
    if (path.endsWith(".md") && !path.includes("README") && !path.includes("SKILL")) score -= 5;
    if (path.endsWith(".json") && size > 20000 && !path.includes("package")) score -= 15; // penalize large json data

    return {
        path,
        extension: path.split(".").pop() || "",
        size,
        score,
        tokens: Math.ceil(size / CHARS_PER_TOKEN)
    };
}
