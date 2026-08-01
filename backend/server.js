require("dotenv").config();

const express = require("express");
const { rateLimit } = require("express-rate-limit");
const analyzeWithLLM = require("./lib/llmAnalyze");
const checkUrls = require("./lib/checkUrls");

const app = express();
const PORT = process.env.PORT || 3000;
const URL_RISK_BUMP = 30;
const analyzeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.set("trust proxy", 1);

function groqConfigurationStatus() {
  const apiKey = process.env.GROQ_API_KEY || "";

  if (!apiKey) {
    return "missing";
  }

  return apiKey.startsWith("gsk_") ? "configured" : "unexpected key format";
}

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

async function analyzeWithFallback(text) {
  let timeoutId;

  try {
    return await Promise.race([
      analyzeWithLLM(text),
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Groq analysis timed out after 10 seconds")),
          10_000,
        );
      }),
    ]);
  } catch (error) {
    console.error("LLM analysis failed; using heuristic fallback", {
      message: error.message,
      status: error.status,
      code: error.error?.error?.code,
      groqApiKey: groqConfigurationStatus(),
    });
    return fakeAnalyze(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

function riskLevelForScore(riskScore) {
  return riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low";
}

app.post("/analyze", analyzeLimiter, async (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  if (text.length > 5000) {
    return res
      .status(400)
      .json({ error: "Message too long, please shorten it" });
  }

  const [analysis, urlReputation] = await Promise.all([
    analyzeWithFallback(text),
    checkUrls(text).catch((error) => {
      console.error("URL reputation check failed; continuing without it:", error);
      return { suspiciousDomains: [], notes: [] };
    }),
  ]);

  if (urlReputation.suspiciousDomains.length === 0) {
    return res.json(analysis);
  }

  const riskScore = Math.min(
    98,
    analysis.riskScore +
      urlReputation.suspiciousDomains.length * URL_RISK_BUMP,
  );

  return res.json({
    ...analysis,
    riskLevel: riskLevelForScore(riskScore),
    riskScore,
    flags: [...analysis.flags, ...urlReputation.notes],
  });
});

app.listen(PORT, () => {
  console.log(`Scam Shield API listening on port ${PORT}`);
  console.log(`Groq API key status: ${groqConfigurationStatus()}`);
});
