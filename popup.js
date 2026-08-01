const analyzeBtn = document.getElementById("analyzeBtn");
const input = document.getElementById("input");
const resultDiv = document.getElementById("result");
const scoreText = document.getElementById("scoreText");
const gaugeFill = document.getElementById("gaugeFill");
const gaugeMarker = document.getElementById("gaugeMarker");
const summaryEl = document.getElementById("summary");
const flagsEl = document.getElementById("flags");
const themeToggle = document.getElementById("themeToggle");
const themeToggleLabel = document.getElementById("themeToggleLabel");
const errorMessage = document.getElementById("errorMessage");
const evidenceSection = document.getElementById("evidenceSection");
const evidenceList = document.getElementById("evidenceList");
const confidenceText = document.getElementById("confidenceText");
const simpleToggle = document.getElementById("simpleToggle");
const exportBtn = document.getElementById("exportBtn");
const shareBtn = document.getElementById("shareBtn");
const historyPanel = document.getElementById("historyPanel");
const historyCount = document.getElementById("historyCount");
const historyList = document.getElementById("historyList");
const API_URL = "https://scam-shield-backend-mcqp.onrender.com/analyze";
let currentAnalysis = null;
let currentText = "";
let simpleMode =
  false;

const EVIDENCE_PATTERNS = [
  {
    pattern: /\b(?:urgent|immediately|act now|final warning|suspended)\b/gi,
    reason: "Creates urgency or pressure to act quickly",
  },
  {
    pattern: /\b(?:gift cards?|wire transfer|cryptocurrency|bitcoin)\b/gi,
    reason: "Requests a payment method commonly used in scams",
  },
  {
    pattern: /\b(?:password|verification code|social security|bank account)\b/gi,
    reason: "Requests sensitive account or identity information",
  },
  {
    pattern: /\b(?:verify your account|click here|click the link)\b/gi,
    reason: "Pressures you to follow instructions or verify an account",
  },
  {
    pattern: /\bhttps?:\/\/[^\s<>"']+/gi,
    reason: "Contains a link worth checking before opening",
  },
];

/* ==========================================================
   SCAN BUTTON — registered first, and has zero dependency
   on theme code. Even if storage/theme logic throws, this
   still works.
   ========================================================== */
analyzeBtn.addEventListener("click", async () => {
  const text = input.value.trim();

  if (!text) {
    input.focus();
    input.style.borderColor = "var(--risk-high)";
    setTimeout(() => (input.style.borderColor = ""), 900);
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Scanning...";
  resultDiv.classList.add("hidden");
  errorMessage.classList.add("hidden");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The message could not be analyzed.");
    }

    if (!isValidAnalysis(data)) {
      throw new Error("The backend returned an invalid analysis.");
    }

    renderAnalysis(data, text);
    saveScan(text, data);
  } catch (error) {
    console.error("Scam Shield analysis failed:", error);
    errorMessage.textContent =
      error instanceof TypeError
        ? "Could not reach Scam Shield. Make sure the backend is running."
        : error.message;
    errorMessage.classList.remove("hidden");
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Scan message";
  }
});

function isValidAnalysis(data) {
  return (
    data &&
    ["high", "medium", "low"].includes(data.riskLevel) &&
    typeof data.riskScore === "number" &&
    data.riskScore >= 0 &&
    data.riskScore <= 100 &&
    typeof data.summary === "string" &&
    Array.isArray(data.flags) &&
    data.flags.every((flag) => typeof flag === "string")
  );
}

function renderAnalysis(data, analyzedText) {
  currentAnalysis = data;
  currentText = analyzedText;
  simpleMode = false;
  resultDiv.className = `result risk-${data.riskLevel}`;

  scoreText.textContent = `${data.riskScore} / 100`;

  gaugeFill.className = `gauge-fill fill-${data.riskLevel}`;
  gaugeFill.style.width = `${data.riskScore}%`;
  gaugeMarker.style.left = `${data.riskScore}%`;

  confidenceText.textContent = data.confidence || "uncertain";
  summaryEl.textContent = data.summary;
  simpleToggle.textContent = "Explain like I'm 12";

  flagsEl.replaceChildren(
    ...data.flags.map((flag) => {
      const item = document.createElement("li");
      item.textContent = flag;
      return item;
    }),
  );

  renderEvidence(analyzedText);

  resultDiv.classList.remove("hidden");
}

simpleToggle.addEventListener("click", () => {
  if (!currentAnalysis) return;

  simpleMode = !simpleMode;
  summaryEl.textContent = simpleMode
    ? currentAnalysis.simpleSummary || currentAnalysis.summary
    : currentAnalysis.summary;
  simpleToggle.textContent = simpleMode
    ? "Show standard explanation"
    : "Explain like I'm 12";
});

function reportText() {
  if (!currentAnalysis) return "";

  return [
    `Scam Shield: ${currentAnalysis.riskLevel.toUpperCase()} RISK (${currentAnalysis.riskScore}/100)`,
    `Confidence: ${currentAnalysis.confidence || "uncertain"}`,
    currentAnalysis.summary,
    "Flags:",
    ...currentAnalysis.flags.map((flag) => `- ${flag}`),
  ].join("\n");
}

exportBtn.addEventListener("click", () => {
  if (!currentAnalysis) return;

  const blob = new Blob(
    [JSON.stringify({ message: currentText, analysis: currentAnalysis }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `scam-shield-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

shareBtn.addEventListener("click", async () => {
  const text = reportText();
  if (!text) return;

  try {
    if (navigator.share) {
      await navigator.share({ title: "Scam Shield analysis", text });
      return;
    }
  } catch (error) {
    if (error.name === "AbortError") return;
  }

  try {
    await navigator.clipboard.writeText(text);
    shareBtn.textContent = "Copied";
    setTimeout(() => (shareBtn.textContent = "Share"), 1200);
  } catch (error) {
    console.error("Scam Shield share failed:", error);
  }
});

function saveScan(text, analysis) {
  if (!hasChromeStorage) return;

  chrome.storage.local.get(["scanHistory"], ({ scanHistory = [] }) => {
    const nextHistory = [
      { id: Date.now(), scannedAt: new Date().toISOString(), text, analysis },
      ...scanHistory,
    ].slice(0, 5);
    chrome.storage.local.set({ scanHistory: nextHistory }, () =>
      renderHistory(nextHistory),
    );
  });
}

function renderHistory(history) {
  historyCount.textContent = history.length;
  historyPanel.classList.toggle("hidden", history.length === 0);
  historyList.replaceChildren(
    ...history.map((scan) => {
      const button = document.createElement("button");
      const heading = document.createElement("strong");
      const preview = document.createElement("span");
      button.type = "button";
      button.className = "history-item";
      heading.textContent = `${scan.analysis.riskLevel} · ${scan.analysis.riskScore}/100`;
      preview.textContent = scan.text;
      button.append(heading, preview);
      button.addEventListener("click", () => {
        input.value = scan.text;
        renderAnalysis(scan.analysis, scan.text);
        historyPanel.open = false;
      });
      return button;
    }),
  );
}

function initHistory() {
  if (!hasChromeStorage) return;
  chrome.storage.local.get(["scanHistory"], ({ scanHistory = [] }) =>
    renderHistory(scanHistory.slice(0, 5)),
  );
}

function findEvidence(text) {
  const evidence = [];

  for (const { pattern, reason } of EVIDENCE_PATTERNS) {
    pattern.lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
      const quote = match[0].replace(/[),.;!?]+$/g, "");
      const start = match.index;

      if (!quote || evidence.some((item) => item.start === start)) {
        continue;
      }

      evidence.push({ quote, reason, start, end: start + quote.length });

      if (evidence.length === 5) {
        return evidence.sort((a, b) => a.start - b.start);
      }
    }
  }

  return evidence.sort((a, b) => a.start - b.start);
}

function renderEvidence(text) {
  const evidence = findEvidence(text);

  evidenceList.replaceChildren(
    ...evidence.map(({ quote, reason, start, end }) => {
      const button = document.createElement("button");
      const quoteEl = document.createElement("span");
      const reasonEl = document.createElement("span");

      button.type = "button";
      button.className = "evidence-item";
      button.setAttribute("aria-label", `Locate ${quote} in message`);
      quoteEl.className = "evidence-quote";
      quoteEl.textContent = `“${quote}”`;
      reasonEl.className = "evidence-reason";
      reasonEl.textContent = reason;
      button.append(quoteEl, reasonEl);
      button.addEventListener("click", () => {
        input.focus();
        input.setSelectionRange(start, end);
      });

      return button;
    }),
  );
  evidenceSection.classList.toggle("hidden", evidence.length === 0);
}

/* ==========================================================
   THEME TOGGLE — wrapped defensively. If chrome.storage isn't
   available yet (e.g. extension needs a full reload after the
   "storage" permission was added), we fall back to an
   in-memory-only toggle instead of crashing the whole script.
   ========================================================== */
const hasChromeStorage =
  typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);

  if (hasChromeStorage) {
    try {
      chrome.storage.local.set({ theme: next });
    } catch (err) {
      console.warn("Scam Shield: couldn't save theme preference.", err);
    }
  }
});

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggleLabel.textContent = "LIGHT";
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeToggleLabel.textContent = "DARK";
  }
}

function initTheme() {
  const fallbackTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  if (!hasChromeStorage) {
    applyTheme(fallbackTheme);
    return;
  }

  try {
    chrome.storage.local.get(["theme"], (result) => {
      if (chrome.runtime.lastError) {
        applyTheme(fallbackTheme);
        return;
      }
      applyTheme(result.theme || fallbackTheme);
    });
  } catch (err) {
    console.warn("Scam Shield: couldn't read theme preference.", err);
    applyTheme(fallbackTheme);
  }
}

initTheme();
initHistory();
