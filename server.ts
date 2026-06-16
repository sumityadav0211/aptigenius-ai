import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// API endpoint to generate quiz questions
app.post("/api/generate", async (req: express.Request, res: express.Response) => {
  try {
    const { topic, count, difficulty, pdfText } = req.body;

    if (!topic || !count) {
      return res.status(400).json({ error: "Missing topic or count parameters" });
    }

    if (pdfText && pdfText.trim().length < 50) {
      return res.status(400).json({ error: "PDF content is too short. Please upload a more detailed document." });
    }

    const userGeminiKey = req.headers["x-gemini-key"] as string | undefined;
    const cleanUserKey = (userGeminiKey && userGeminiKey !== "YOUR_GEMINI_KEY_HERE" && userGeminiKey.trim().length > 3) ? userGeminiKey.trim() : undefined;
    const apiKey = cleanUserKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server environment. Please define GEMINI_API_KEY in your configuration settings." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const quizDifficulty = difficulty || "Medium";

    const difficultyInstructions: Record<string, string> = {
      Easy: `
- Questions should test basic understanding and simple application of concepts
- Use straightforward scenarios with 2-3 step solutions
- Example for Multiplication: "A shopkeeper sells 24 items per day for 15 days. If each item costs Rs. 35, what is his total revenue?"
- Options should have one clearly correct answer with plausible distractors`,
      Medium: `
- Questions should require deeper understanding and multi-step reasoning
- Use real-world word problems that require applying formulas
- Example for Percentage: "A student scored 456 marks out of 600. After re-evaluation, 24 marks were added. What is the percentage increase in marks?"
- Options should be close in value to create genuine challenge`,
      Hard: `
- Questions should be complex, tricky, and require advanced multi-step reasoning
- Use compound problems that combine multiple concepts
- Example for Time and Work: "A can do a piece of work in 12 days, B in 15 days. They work together for 4 days, then A leaves. In how many more days will B finish the remaining work?"
- Include trap options that catch common calculation mistakes
- Questions should be exam-level difficulty as seen in CAT, GATE, Bank PO, SSC CGL`
    };

    const topicGuidelines: Record<string, string> = {
      "Multiplication": "Generate word problems involving multiplication in real-world contexts like business, distance, cost calculation. Never ask direct multiplication like 'what is X * Y'.",
      "Division": "Generate word problems involving division in contexts like sharing, rate calculation, average. Never ask direct division like 'what is X / Y'.",
      "Percentage": "Generate problems on percentage increase/decrease, profit/loss %, marks percentage, population growth, discount calculations.",
      "Profit and Loss": "Generate problems on selling price, cost price, profit%, loss%, marked price, successive discounts, dishonest dealings.",
      "Simple Interest & Compound Interest": "Generate problems finding SI, CI, principal, rate, time. Include problems comparing SI vs CI.",
      "Ratio and Proportion": "Generate problems on dividing amounts in ratio, finding missing values, mixture problems, proportion-based word problems.",
      "Time and Work": "Generate problems on combined work rates, pipes and cisterns, men-days calculations, efficiency comparisons.",
      "Time, Speed and Distance": "Generate problems on relative speed, trains crossing, boats and streams, average speed, meeting point problems.",
      "Average": "Generate problems on weighted average, average of groups, replacing elements in average, cricket or exam score averages.",
      "Age Problems": "Generate word problems finding current, past, or future ages using equations and ratios.",
      "Number System": "Generate problems on divisibility, remainders, factors, HCF or LCM applications, unit digits, number properties.",
      "HCF & LCM": "Generate application-based problems using HCF and LCM in real scenarios like bells ringing, tiling, distribution.",
      "Permutation and Combination": "Generate problems on arrangements, selections, circular permutations, word formations, committee selections.",
      "Probability": "Generate problems using classical probability, conditional probability, cards, dice, balls problems.",
      "Mensuration": "Generate problems on area, perimeter, volume of 2D and 3D shapes with real-world applications.",
      "Series (Number/Alphabet)": "Generate number series, alphabet series, missing term problems requiring pattern recognition.",
      "Coding-Decoding": "Generate coding-decoding problems where letters or numbers are coded by a rule and the pattern must be found.",
      "Blood Relations": "Generate complex family relation problems requiring logical deduction.",
      "Direction Sense": "Generate problems involving directions, distance, final position after multiple turns.",
      "Seating Arrangement": "Generate linear or circular seating arrangement problems with multiple conditions.",
      "Syllogism": "Generate premise-conclusion problems requiring logical deduction.",
      "Synonyms and Antonyms": "Generate vocabulary questions testing knowledge of word meanings and opposites.",
      "Error Detection": "Generate sentences with grammatical errors that need to be identified.",
      "Sentence Correction": "Generate sentences with errors to be corrected choosing from options.",
      "Fill in the Blanks": "Generate sentences with blanks to be filled with the most appropriate word.",
      "SQL": "Generate questions on SQL queries, joins, subqueries, aggregate functions, normalization.",
      "Data Structures": "Generate questions on arrays, linked lists, trees, graphs, stacks, queues, complexity analysis.",
      "Algorithms": "Generate questions on sorting, searching, dynamic programming, greedy algorithms, complexity.",
      "Python": "Generate questions on Python syntax, OOP, built-in functions, data structures, error handling.",
      "Java": "Generate questions on Java OOP concepts, collections, exception handling, multithreading.",
      "C Programming": "Generate questions on C syntax, pointers, memory management, data structures in C.",
      "DBMS": "Generate questions on database concepts, normalization, transactions, ACID properties, indexing.",
      "Operating System": "Generate questions on process management, memory management, scheduling algorithms, deadlocks.",
      "Computer Networks": "Generate questions on OSI model, TCP/IP, protocols, subnetting, network devices."
    };

    const topicGuide = topicGuidelines[topic] ||
      `Generate proper aptitude exam-style questions on ${topic} as seen in competitive exams like CAT, GATE, Bank PO, SSC CGL, TCS, Infosys placement tests.`;

    let prompt = "";

    if (pdfText) {
      prompt = `You are an expert quiz generator. Based ONLY on the following study material, generate ${count} multiple choice questions at ${quizDifficulty} difficulty level.

STRICT RULES:
- Every question must come directly from the PDF content below
- Questions must test deep understanding, not trivial recall
- All 4 options must be plausible
- Explanation must reference the relevant section
- Return ONLY a valid JSON array, no markdown, no extra text

Each object must have exactly:
{
  "question": "scenario or concept based question from the material",
  "options": ["A", "B", "C", "D"],
  "correct": 0,
  "explanation": "step by step explanation referencing the material",
  "difficulty": "${quizDifficulty}",
  "page_hint": "Based on section about..."
}

STUDY MATERIAL:
${pdfText}`;
    } else {
      prompt = `You are an expert aptitude exam question setter for competitive exams like CAT, GATE, Bank PO, SSC CGL and campus placement tests at TCS, Infosys, Wipro.

Generate exactly ${count} high-quality multiple choice aptitude questions on the topic: "${topic}" at ${quizDifficulty} difficulty level.

TOPIC SPECIFIC GUIDELINES:
${topicGuide}

DIFFICULTY GUIDELINES for ${quizDifficulty}:
${difficultyInstructions[quizDifficulty]}

STRICT QUALITY RULES:
1. NEVER generate direct computation questions like "What is 7 * 9?" or "What is 15 + 23?"
2. ALWAYS use real-world word problems, scenarios, or logical puzzles
3. All 4 options must be realistic and plausible, not obviously wrong
4. Explanation must show clear step-by-step solution
5. Questions must strictly match the difficulty level
6. Each question must be unique, no repetition
7. For programming topics: use code snippets, output prediction, error detection
8. For verbal topics: use proper English grammar and vocabulary questions

Return ONLY a valid JSON array. No markdown, no backticks, no extra text.

Each object must have exactly:
{
  "question": "well-framed word problem or scenario-based question",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,
  "explanation": "step-by-step solution showing method and calculation clearly",
  "difficulty": "${quizDifficulty}",
  "page_hint": "Key concept: main formula or concept used"
}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correct: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              page_hint: { type: Type.STRING }
            },
            required: ["question", "options", "correct", "explanation", "difficulty", "page_hint"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response received from Gemini.");

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json({ success: true, questions: parsed });

  } catch (error: any) {
    console.error("AI Generation Failed:", error);
    const errMsg = error.message || "";
    if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({ error: "The Gemini API key has temporarily exceeded its rate limit or daily quota. Please wait a brief moment and retry." });
    }
    return res.status(500).json({ error: errMsg || "An unexpected error occurred during AI quiz generation." });
  }
});

// API endpoint to provide detailed step-by-step solutions on demand
app.post("/api/explain", async (req: express.Request, res: express.Response) => {
  try {
    const { question, options, correct, topic } = req.body;
    if (!question || !options || correct === undefined) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const userGeminiKey = req.headers["x-gemini-key"] as string | undefined;
    const cleanUserKey = (userGeminiKey && userGeminiKey !== "YOUR_GEMINI_KEY_HERE" && userGeminiKey.trim().length > 3) ? userGeminiKey.trim() : undefined;
    const apiKey = cleanUserKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Service configuration error. Please ensure GEMINI_API_KEY is configured." });
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

    return res.json({ success: true, explanation: explanationText });

  } catch (error: any) {
    console.error("Detailed explanation generation failed:", error);
    return res.status(500).json({ error: error.message || "Explanation generation failed." });
  }
});

// Vite middleware integration for dev mode or standard static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
