import JSZip from "jszip";

const MAX_FILE_SIZE = 500 * 1024; // 500KB cap per file to avoid bloat
const IGNORED_EXTENSIONS = new Set([
    // Images/Media
    "png", "jpg", "jpeg", "gif", "ico", "svg", "mp4", "webm", "mp3", "wav",
    // Archives/Binaries
    "zip", "tar", "gz", "7z", "rar", "exe", "dll", "so", "dylib", "bin",
    // Lockfiles
    "lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    // Misc
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "eot", "ttf", "woff", "woff2",
    "map", "css.map", "js.map"
]);

const IGNORED_DIRS = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
]);

export interface RepoFile {
    path: string;
    content: string;
}

export interface ScanPack {
    owner: string;
    repo: string;
    files: RepoFile[];
    fileTree: string[];
}

export async function fetchRepoZip(inputUrl: string): Promise<ScanPack> {
    const { owner, repo } = parseGitHubUrl(inputUrl);
    // Default to main, but fallback logic would go here in a full app
    const branch = "main";
    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;

    console.log(`[GitHub] Fetching ${zipUrl}...`);
    const response = await fetch(zipUrl);

    if (!response.ok) {
        // Try 'master' fallback if main fails
        if (branch === "main") {
            const masterUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`;
            console.log(`[GitHub] 'main' failed, trying 'master': ${masterUrl}`);
            const masterResponse = await fetch(masterUrl);
            if (masterResponse.ok) {
                return processZip(await masterResponse.arrayBuffer(), owner, repo);
            }
        }
        throw new Error(`Failed to fetch repo zip: ${response.statusText}`);
    }

    return processZip(await response.arrayBuffer(), owner, repo);
}

async function processZip(buffer: ArrayBuffer, owner: string, repo: string): Promise<ScanPack> {
    const zip = await JSZip.loadAsync(buffer);
    const files: RepoFile[] = [];
    const fileTree: string[] = [];

    // Iterate over files
    for (const [relativePath, file] of Object.entries(zip.files)) {
        if (file.dir) continue;

        // Remove top-level directory (e.g., "repo-main/")
        const cleanPath = relativePath.split("/").slice(1).join("/");
        if (!cleanPath) continue;

        fileTree.push(cleanPath);

        if (shouldSkip(cleanPath)) continue;

        // Check size before decompressing fully if possible, but JSZip loads lazily.
        // For now we assume we check text content length.

        try {
            const content = await file.async("string");

            // Simple binary check (presence of null bytes) or just length
            if (content.length > MAX_FILE_SIZE) {
                console.warn(`[GitHub] Skipping large file: ${cleanPath} (${content.length} bytes)`);
                continue;
            }

            // Basic binary guard (if it contains too many null bytes, skip)
            // This is a heuristic.
            if (/\0/g.test(content.slice(0, 8000))) {
                continue;
            }

            files.push({ path: cleanPath, content });
        } catch (err) {
            console.warn(`[GitHub] Failed to read ${cleanPath}`, err);
        }
    }

    return { owner, repo, files, fileTree };
}

function parseGitHubUrl(url: string): { owner: string; repo: string } {
    try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean); // [owner, repo, ...]
        if (parts.length < 2) throw new Error("Invalid GitHub URL");
        return { owner: parts[0], repo: parts[1].replace(".git", "") };
    } catch (e) {
        throw new Error("Invalid URL format");
    }
}

function shouldSkip(path: string): boolean {
    const parts = path.split("/");
    const filename = parts[parts.length - 1];

    // Check Directories
    for (const part of parts) {
        if (IGNORED_DIRS.has(part)) return true;
    }

    // Check Extension
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext && IGNORED_EXTENSIONS.has(ext)) return true;

    // Check dotfiles that aren't critical
    if (filename.startsWith(".") && !filename.startsWith(".env") && filename !== ".gitignore") {
        // We generally keep .env (usually .env.example) and .gitignore
        // Skip .DS_Store etc
        if (filename === ".DS_Store") return true;
    }

    return false;
}
