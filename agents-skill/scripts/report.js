#!/usr/bin/env node

const fs = require('fs');

const API_BASE = process.env.SKILLGUARD_API_URL || "http://localhost:3000";

async function getReport() {
    const skillId = process.argv[2];
    if (!skillId) {
        console.error("Usage: node report.js <skillId>");
        process.exit(1);
    }

    try {
        const response = await fetch(`${API_BASE}/api/skill/${skillId}`);

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
