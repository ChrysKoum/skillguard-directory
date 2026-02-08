import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("Key length:", apiKey?.length);

    const candidates = [
        "gemini-3-pro-preview",
        "gemini-3-flash-preview"
    ];

    const results = [];

    for (const m of candidates) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey!);
            const model = genAI.getGenerativeModel({ model: m });
            await model.generateContent("Hello");
            console.log(`✅ ${m} is AVAILABLE`);
            results.push(m);
        } catch (e: any) {
            console.log(`❌ ${m} FAILED: ${e.message?.split('[')[0]}`);
        }
    }

    console.log("Available models:", results);
}

main();
