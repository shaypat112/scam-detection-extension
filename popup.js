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
const API_URL = "https://scam-shield-backend-mcqp.onrender.com/analyze";

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

    renderAnalysis(data);
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

function renderAnalysis(data) {
  resultDiv.className = `result risk-${data.riskLevel}`;

  scoreText.textContent = `${data.riskScore} / 100`;

  gaugeFill.className = `gauge-fill fill-${data.riskLevel}`;
  gaugeFill.style.width = `${data.riskScore}%`;
  gaugeMarker.style.left = `${data.riskScore}%`;

  summaryEl.textContent = data.summary;

  flagsEl.replaceChildren(
    ...data.flags.map((flag) => {
      const item = document.createElement("li");
      item.textContent = flag;
      return item;
    }),
  );

  resultDiv.classList.remove("hidden");
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
