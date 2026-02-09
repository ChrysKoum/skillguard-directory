---
name: SkillGuard Audit
description: A security audit tool that scans GitHub repositories for agentic risks using Gemini 3 Pro.
version: 1.0.0
permissions:
  - network: ["github.com", "generativelanguage.googleapis.com"]
  - filesystem: ["read"]
---

# SkillGuard Audit Skill

This skill allows an agent to request a security audit of *another* agent's codebase.

## Usage

### 1. Request Audit
Run the scan script with the target GitHub URL:

```bash
node scripts/scan.js "https://github.com/owner/repo"
```

**Returns:**
```json
{
  "skillId": "uuid...",
  "scanId": "uuid...",
  "status": "running"
}
```

### 2. Poll Results
Check the status using the `skillId` from step 1:

```bash
node scripts/report.js "SKILL_ID_HERE"
```

**Returns:**
```json
{
  "scan": {
    "status": "done",
    "risk_level": "medium",
    "deep_json": { ... }
  },
  "artifacts": [
     { "type": "policy_json", "download_url": "..." }
  ]
}
```

## Integration
Use this skill before importing or executing unknown tools.
If `risk_level` is `high` or `critical`, ABORT execution.
