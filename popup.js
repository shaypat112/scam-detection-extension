const analyzeBtn = document.getElementById("analyzeBtn");
const input = document.getElementById("input");
const resultDiv = document.getElementById("result");

analyzeBtn.addEventListener("click", async () => {
  const text = input.value.trim();

  if (!text) {
    showResult("Paste something first.", "low");
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  resultDiv.classList.add("hidden");

  // STAGE 1 PLACEHOLDER: fake response, no backend call yet.
  // We're testing the UI flow first. Stage 3 will replace this
  // with a real fetch() to our Render backend.
  await fakeDelay(800);
  const fakeResponse = {
    riskLevel: "high",
    riskScore: 87,
    summary:
      "This message uses urgency language and impersonates a bank. (This is placeholder data — real analysis comes in a later stage.)",
    flags: [
      "Urgent/threatening language",
      "Suspicious sender domain",
      "Requests personal info",
    ],
  };

  renderAnalysis(fakeResponse);

  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "Analyze";
});

function renderAnalysis(data) {
  const riskClass = `risk-${data.riskLevel}`;
  resultDiv.innerHTML = `
    <div class="${riskClass}">Risk: ${data.riskLevel.toUpperCase()} (${data.riskScore}/100)</div>
    <p>${data.summary}</p>
    <ul>
      ${data.flags.map((f) => `<li>${f}</li>`).join("")}
    </ul>
  `;
  resultDiv.classList.remove("hidden");
}

function showResult(message, riskLevel) {
  resultDiv.innerHTML = `<div class="risk-${riskLevel}">${message}</div>`;
  resultDiv.classList.remove("hidden");
}

function fakeDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
