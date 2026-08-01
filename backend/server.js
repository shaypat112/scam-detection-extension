require("dotenv").config();

const express = require("express");
const analyzeWithLLM = require("./lib/llmAnalyze");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Scam Shield API is running" });
});

function fakeAnalyze(text) {
  const normalizedText = text.toLowerCase();
  const indicators = [
    { pattern: /urgent|immediately|act now/, flag: "Urgent or threatening language", points: 25 },
    { pattern: /gift card|wire transfer|cryptocurrency|bitcoin/, flag: "Requests a hard-to-recover payment method", points: 35 },
    { pattern: /password|social security|bank account|verification code/, flag: "Requests sensitive personal information", points: 30 },
    { pattern: /click (?:here|the link)|verify your account/, flag: "Pressures you to follow a link or verify an account", points: 20 },
  ];

  const matches = indicators.filter(({ pattern }) => pattern.test(normalizedText));
  const riskScore = Math.min(100, matches.reduce((score, { points }) => score + points, 10));
  const riskLevel = riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low";

  return {
    riskLevel,
    riskScore,
    summary:
      matches.length > 0
        ? "This message contains patterns commonly used in scams. Treat it cautiously and verify the sender independently."
        : "This message does not contain obvious scam patterns, but you should still verify unexpected requests.",
    flags:
      matches.length > 0
        ? matches.map(({ flag }) => flag)
        : ["No common scam keywords were detected"],
  };
}

app.post("/analyze", async (req, res) => {
  const { text } = req.body;

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Text is required" });
  }

  let timeoutId;

  try {
    const analysis = await Promise.race([
      analyzeWithLLM(text),
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Groq analysis timed out after 10 seconds")),
          10_000,
        );
      }),
    ]);

    return res.json(analysis);
  } catch (error) {
    console.error("LLM analysis failed; using heuristic fallback:", error);
    return res.json(fakeAnalyze(text));
  } finally {
    clearTimeout(timeoutId);
  }
});

app.listen(PORT, () => {
  console.log(`Scam Shield API listening on port ${PORT}`);
});
