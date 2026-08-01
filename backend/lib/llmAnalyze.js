const Groq = require("groq-sdk");

const SYSTEM_PROMPT = `You are a careful scam and phishing analyst. Analyze the user's message for signs of fraud, impersonation, manipulation, suspicious payment requests, credential theft, and malicious links.

Return ONLY a valid JSON object with exactly this shape:
{
  "riskLevel": "high" | "medium" | "low",
  "riskScore": number from 0 to 100,
  "summary": string,
  "simpleSummary": string,
  "confidence": "clear-cut" | "likely" | "uncertain",
  "flags": string[]
}

The summary must be one or two plain-English sentences without jargon. The simpleSummary must explain the same conclusion using vocabulary a 12-year-old would understand, with short sentences and a clear next step. Confidence describes how certain the evidence is: clear-cut for multiple strong scam signals, likely for meaningful but incomplete evidence, and uncertain when context is missing or mixed. Each flag must describe a specific red flag found in the message. If there are no red flags, include one reassuring note in flags. Do not include Markdown, code fences, or any fields other than riskLevel, riskScore, summary, simpleSummary, confidence, and flags.`;

async function analyzeWithLLM(text) {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty analysis response");
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse Groq analysis as JSON: ${error.message}`);
  }
}

module.exports = analyzeWithLLM;
