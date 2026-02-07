import { fetchRepoZip } from "./lib/github";
import { performStaticScan } from "./lib/staticScanner";
// import { performDeepAudit } from "./lib/geminiAudit"; // Commented out to avoid API cost in simple test, unless needed

async function testPhase2() {
    const TEST_REPO = "https://github.com/octocat/Hello-World"; // Safe, small repo

    console.log("--- 1. Testing GitHub Ingestion ---");
    try {
        const pack = await fetchRepoZip(TEST_REPO);
        console.log(`[Success] Fetched ${pack.repo} by ${pack.owner}`);
        console.log(`[Info] File count: ${pack.files.length}`);
        console.log(`[Info] Tree sample:`, pack.fileTree.slice(0, 3));

        console.log("\n--- 2. Testing Static Analyzer ---");
        const staticResult = performStaticScan(pack);
        console.log(`[Success] Static Score: ${staticResult.static_score}`);
        console.log(`[Info] Capabilities:`, staticResult.capabilities);

        // Note: We skip Deep Audit in this quick verify to save API calls/time 
        // unless user explicitly wants to test credentials.
        console.log("\n[Skipped] Gemini Deep Audit (Requires live API Key)");

    } catch (err) {
        console.error("[Fail] Phase 2 Test Failed:", err);
        process.exit(1);
    }
}

testPhase2();
