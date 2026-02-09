#!/usr/bin/env node

const fs = require('fs');

const API_BASE = process.env.SKILLGUARD_API_URL || "http://localhost:3000";

async function postScan() {
    const url = process.argv[2];
    if (!url) {
        console.error("Usage: node scan.js <github_url>");
        process.exit(1);
    }

    console.log(`Requesting scan for ${url} at ${API_BASE}...`);
    try {
        const response = await fetch(`${API_BASE}/api/scan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
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

postScan();
