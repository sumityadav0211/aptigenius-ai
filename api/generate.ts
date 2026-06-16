import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const { topic, count, difficulty, pdfText } = req.body;

    if (!topic || !count) {
      return res.status(400).json({ error: "Missing topic or count parameters" });
    }

    if (pdfText && pdfText.trim().length < 50) {
      return res.status(400).json({ error: "PDF content is too short. Please upload a more detailed document." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Service configuration error. Please contact support." });
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
    console.error("Generation Failed:", error);
    const errMsg = error.message || "";
    if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({ error: "API quota exceeded. Please wait a moment and retry." });
    }
    return res.status(500).json({ error: errMsg || "An unexpected error occurred." });
  }
}
