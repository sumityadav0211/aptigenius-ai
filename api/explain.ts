import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const { question, options, correct, topic } = req.body;
    if (!question || !options || correct === undefined) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Service configuration error." });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are an expert aptitude trainer. Explain this question step by step in clear markdown.

Topic: ${topic || "Aptitude"}
Question: ${question}
Options: ${options.map((o: string, i: number) => `${String.fromCharCode(65 + i)}) ${o}`).join(" | ")}
Correct Answer: Option ${String.fromCharCode(65 + correct)} — ${options[correct]}

Format your response with:
## Core Concept
One or two sentences explaining the key formula or logic.

## Step-by-Step Solution
Detailed walkthrough of every calculation step.

## Why Other Options Are Wrong
Brief explanation eliminating each wrong option.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    const explanationText = response.text;
    if (!explanationText) throw new Error("No explanation received from Gemini.");

    return res.status(200).json({ success: true, explanation: explanationText });

  } catch (error: any) {
    console.error("Explanation Failed:", error);
    return res.status(500).json({ error: error.message || "Explanation generation failed." });
  }
}
