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

  // STAGE 1 PLACEHOLDER: fake response, no backend call yet.
  // Stage 3 will replace this with a real fetch() to our Render backend.
  await fakeDelay(800);
  const fakeResponse = {
    riskLevel: "high", // "high" | "medium" | "low"
    riskScore: 87,
    summary:
      "This message uses urgency language and impersonates a bank. (Placeholder data — real analysis comes in a later stage.)",
    flags: [
      "Urgent or threatening language",
      "Suspicious sender domain",
      "Requests personal information",
    ],
  };

  renderAnalysis(fakeResponse);

  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "Scan message";
});

function renderAnalysis(data) {
  resultDiv.className = `result risk-${data.riskLevel}`;

  scoreText.textContent = `${data.riskScore} / 100`;

  gaugeFill.className = `gauge-fill fill-${data.riskLevel}`;
  gaugeFill.style.width = `${data.riskScore}%`;
  gaugeMarker.style.left = `${data.riskScore}%`;

  summaryEl.textContent = data.summary;

  flagsEl.innerHTML = data.flags.map((f) => `<li>${f}</li>`).join("");

  resultDiv.classList.remove("hidden");
}

function fakeDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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