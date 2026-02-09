# SkillGuard Security Audit Skill

This directory contains the integration tools to use SkillGuard's deep security analysis capabilities from:
- **Command Line Interface (CLI)**
- **AI Agents (Antigravity, LangChain, etc.)**
- **IDEs (Cursor, Windsurf, VS Code via MCP)**

## 🚀 Quick Start (CLI)

Ensure the SkillGuard server is running (`npm run dev` in the root).

**1. Scan a Repository:**
```bash
node scripts/scan.js "https://github.com/owner/repo"
```
*Output: Returns a JSON with `skillId` and `scanId`.*

**2. Get Report:**
```bash
node scripts/report.js "SKILL_ID_FROM_STEP_1"
```
*Output: Returns the full security report JSON.*

---

## 🤖 Agent Integration

This folder follows the Antigravity Skill format. You can import this skill into your agent framework.

### Capabilities
- **`scan_repository(url)`**: Triggers a deep audit using Gemini 3 Pro.
- **`get_scan_report(skillId)`**: Retrieves the analysis results.

### JSON Schema
See `SKILL.md` for the full capability definition.

---

## 💻 IDE Integration (MCP Server)

SkillGuard provides a Model Context Protocol (MCP) server that exposes scanning tools directly to your IDE (Cursor, Windsurf) or AI Assistant (Claude Desktop).

### Setup for Claude Desktop / Cursor

Add the following to your MCP config file (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "skillguard-audit": {
      "command": "node",
      "args": [
        "/absolute/path/to/agents-skill/mcp-server.js"
      ],
      "env": {
        "SKILLGUARD_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

This integration works for **all IDEs** and AI systems that support the Model Context Protocol (MCP), including Antigravity, Cursor, Windsurf, Claude Code, and future agents.
