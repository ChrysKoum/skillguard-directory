#!/usr/bin/env node

const fs = require('fs');

const API_BASE = process.env.SKILLGUARD_API_URL || "http://localhost:3000";

async function getReport() {
    const input = process.argv[2];
    if (!input) {
        console.error("Usage: node report.js <skillId|owner/repo>");
        console.error("Examples:");
        console.error("  node report.js 525485f2-1ce2-4218-905a-f2accc28830f");
        console.error("  node report.js a-church-ai/church");
        process.exit(1);
    }

    try {
        // Detect if input is a UUID or slug (owner/repo)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
        const url = isUUID
            ? `${API_BASE}/api/skill/${input}`
            : `${API_BASE}/${input}`;

        const response = await fetch(url, {
            headers: { "Accept": "application/json" }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

getReport();

