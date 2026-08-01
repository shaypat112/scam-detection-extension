require("dotenv").config();

const analyzeWithLLM = require("../lib/llmAnalyze");

const scamExample = `URGENT: Your bank account will be suspended today.
Click http://secure-bank-verification.example and enter your password and
verification code immediately to keep your account active.`;

analyzeWithLLM(scamExample)
  .then((result) => console.log(result))
  .catch((error) => {
    console.error("LLM analysis test failed:", error.message);
    process.exitCode = 1;
  });
