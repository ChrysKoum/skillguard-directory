#!/usr/bin/env node
const http = require('http');

/**
 * SkillGuard MCP Server
 * A simple Model Context Protocol server that wraps the SkillGuard API.
 * This allows IDEs (Cursor, Windsurf) and Agents (Claude Desktop) to use SkillGuard tools.
 */

const API_BASE = process.env.SKILLGUARD_API_URL || "http://localhost:3000";

const TOOLS = [
    {
        name: "scan_repository",
        description: "Start a deep security audit of a GitHub repository using Gemini 3 Pro.",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string", description: "Public GitHub repository URL (e.g. https://github.com/owner/repo)" }
            },
            required: ["url"]
        }
    },
    {
        name: "get_scan_report",
        description: "Get the status and results of a security scan by skill ID.",
        inputSchema: {
            type: "object",
            properties: {
                skillId: { type: "string", description: "The skill UUID returned by scan_repository" }
            },
            required: ["skillId"]
        }
    },
    {
        name: "get_report_by_slug",
        description: "Get the security report using a friendly owner/repo slug (e.g. 'a-church-ai/church').",
        inputSchema: {
            type: "object",
            properties: {
                owner: { type: "string", description: "GitHub owner/org name" },
                repo: { type: "string", description: "GitHub repository name" }
            },
            required: ["owner", "repo"]
        }
    }
];

// Handles tool execution
async function handleCallTool(name, args) {
    if (name === "scan_repository") {
        const res = await fetch(`${API_BASE}/api/scan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: args.url })
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    }

    if (name === "get_scan_report") {
        const res = await fetch(`${API_BASE}/api/skill/${args.skillId}`, {
            headers: { "Accept": "application/json" }
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    }

    if (name === "get_report_by_slug") {
        const res = await fetch(`${API_BASE}/${args.owner}/${args.repo}`, {
            headers: { "Accept": "application/json" }
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    }

    throw new Error(`Unknown tool: ${name}`);
}

// MCP JSON-RPC over Stdio
process.stdin.on('data', async (chunk) => {
    const lines = chunk.toString().split('\n').filter(l => l.trim());
    for (const line of lines) {
        try {
            const msg = JSON.parse(line);

            // List Tools
            if (msg.method === "tools/list") {
                process.stdout.write(JSON.stringify({
                    jsonrpc: "2.0",
                    id: msg.id,
                    result: { tools: TOOLS }
                }) + "\n");
            }

            // Call Tool
            else if (msg.method === "tools/call") {
                try {
                    const result = await handleCallTool(msg.params.name, msg.params.arguments);
                    process.stdout.write(JSON.stringify({
                        jsonrpc: "2.0",
                        id: msg.id,
                        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
                    }) + "\n");
                } catch (err) {
                    process.stdout.write(JSON.stringify({
                        jsonrpc: "2.0",
                        id: msg.id,
                        error: { code: -32000, message: err.message }
                    }) + "\n");
                }
            }

            // Initialize (Handshake)
            else if (msg.method === "initialize") {
                process.stdout.write(JSON.stringify({
                    jsonrpc: "2.0",
                    id: msg.id,
                    result: {
                        protocolVersion: "2024-11-05",
                        capabilities: { tools: {} },
                        serverInfo: { name: "skillguard-mcp", version: "1.0.0" }
                    }
                }) + "\n");
            }

        } catch (e) {
            // Ignore parse errors for partial chunks
        }
    }
});

console.error("SkillGuard MCP Server specific running via STDIO");
