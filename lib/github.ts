import JSZip from "jszip";

const MAX_FILE_SIZE = 500 * 1024; // 500KB cap per file to avoid bloat
const IGNORED_EXTENSIONS = new Set([
    // Images/Media
    "png", "jpg", "jpeg", "gif", "ico", "svg", "mp4", "webm", "mp3", "wav", "webp", "avif",
    // Archives/Binaries
    "zip", "tar", "gz", "7z", "rar", "exe", "dll", "so", "dylib", "bin",
    // Lockfiles
    "lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    // Documents
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    // Fonts
    "eot", "ttf", "woff", "woff2", "otf",
    // Source maps
    "map", "css.map", "js.map",
    // LOW-RISK STATIC FILES (no executable code)
    "css", "scss", "sass", "less",  // Styling - no security risk
    "txt", "log",                    // Plain text
    "csv",                           // Data files
    "min.js", "min.css",             // Minified bundles (too noisy)
    "d.ts",                          // TypeScript declarations
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
    subpath: string;  // NEW: The subdirectory being scanned (empty if root)
    files: RepoFile[];
    fileTree: string[];
}

/**
 * Parses GitHub URLs including subdirectory paths
 * Supports:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo/tree/main/path/to/folder
 *   - https://github.com/owner/repo/tree/branch/path/to/folder
 */
export interface ParsedGitHubUrl {
    owner: string;
    repo: string;
    branch: string;
    subpath: string;  // Path within repo (empty string if root)
}

export function parseGitHubUrl(url: string): ParsedGitHubUrl {
    try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);

        if (parts.length < 2) {
            throw new Error("Invalid GitHub URL - need at least owner/repo");
        }

        const owner = parts[0];
        const repo = parts[1].replace(".git", "");

        // Check if URL includes /tree/branch/path structure
        // Format: /owner/repo/tree/branch/path/to/folder
        if (parts.length >= 4 && parts[2] === "tree") {
            const branch = parts[3];
            const subpath = parts.slice(4).join("/");
            return { owner, repo, branch, subpath };
        }

        // Check for /blob/ URLs (convert to tree)
        if (parts.length >= 4 && parts[2] === "blob") {
            const branch = parts[3];
            // For blob URLs, get the directory containing the file
            const fullPath = parts.slice(4).join("/");
            const subpath = fullPath.includes("/")
                ? fullPath.substring(0, fullPath.lastIndexOf("/"))
                : "";
            return { owner, repo, branch, subpath };
        }

        // Default: just owner/repo, use main branch
        return { owner, repo, branch: "main", subpath: "" };

    } catch (e) {
        throw new Error(`Invalid URL format: ${url}`);
    }
}

export async function fetchRepoZip(inputUrl: string): Promise<ScanPack> {
    const parsed = parseGitHubUrl(inputUrl);
    const { owner, repo, branch, subpath } = parsed;

    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
    console.log(`[GitHub] Fetching ${zipUrl}...`);
    if (subpath) {
        console.log(`[GitHub] Filtering to subdirectory: /${subpath}`);
    }

    const response = await fetch(zipUrl);

    if (!response.ok) {
        // Try 'master' fallback if specified branch fails
        if (branch === "main") {
            const masterUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`;
            console.log(`[GitHub] '${branch}' failed, trying 'master': ${masterUrl}`);
            const masterResponse = await fetch(masterUrl);
            if (masterResponse.ok) {
                return processZip(await masterResponse.arrayBuffer(), owner, repo, subpath);
            }
        }
        throw new Error(`Failed to fetch repo zip: ${response.statusText}`);
    }

    return processZip(await response.arrayBuffer(), owner, repo, subpath);
}

async function processZip(
    buffer: ArrayBuffer,
    owner: string,
    repo: string,
    subpath: string = ""
): Promise<ScanPack> {
    const zip = await JSZip.loadAsync(buffer);
    const files: RepoFile[] = [];
    const fileTree: string[] = [];

    // Normalize subpath (remove leading/trailing slashes)
    const normalizedSubpath = subpath.replace(/^\/+|\/+$/g, "");

    // Iterate over files
    for (const [relativePath, file] of Object.entries(zip.files)) {
        if (file.dir) continue;

        // Remove top-level directory (e.g., "repo-main/")
        const cleanPath = relativePath.split("/").slice(1).join("/");
        if (!cleanPath) continue;

        // SUBDIRECTORY FILTER: Only include files under the specified subpath
        if (normalizedSubpath) {
            // File must start with the subpath
            if (!cleanPath.startsWith(normalizedSubpath + "/") && cleanPath !== normalizedSubpath) {
                continue;
            }
        }

        // For the file tree, store the path relative to the subpath
        const displayPath = normalizedSubpath
            ? cleanPath.replace(normalizedSubpath + "/", "")
            : cleanPath;

        if (displayPath) {
            fileTree.push(displayPath);
        }

        if (shouldSkip(cleanPath)) continue;

        try {
            const content = await file.async("string");

            if (content.length > MAX_FILE_SIZE) {
                console.warn(`[GitHub] Skipping large file: ${cleanPath} (${content.length} bytes)`);
                continue;
            }

            // Basic binary guard
            if (/\0/g.test(content.slice(0, 8000))) {
                continue;
            }

            // Store with path relative to subpath for cleaner display
            files.push({
                path: displayPath || cleanPath,
                content
            });
        } catch (err) {
            console.warn(`[GitHub] Failed to read ${cleanPath}`, err);
        }
    }

    // Log what we found
    if (normalizedSubpath) {
        console.log(`[GitHub] Found ${files.length} files in /${normalizedSubpath}`);
    }

    return { owner, repo, subpath: normalizedSubpath, files, fileTree };
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
        if (filename === ".DS_Store") return true;
    }

    return false;
}
