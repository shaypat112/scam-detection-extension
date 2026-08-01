const { tavily } = require("@tavily/core");

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const CONCERN_PATTERN =
  /\b(?:scam(?:med|mer|s)?|phishing|fraud(?:ulent)?|malicious|unsafe|blacklist(?:ed)?|reported)\b/i;

function extractDomains(text) {
  const urls = text.match(URL_PATTERN) || [];
  const domains = [];

  for (const rawUrl of urls) {
    const cleanedUrl = rawUrl.replace(/[),.;!?\]}]+$/g, "");

    try {
      const parsedUrl = new URL(
        cleanedUrl.startsWith("www.") ? `https://${cleanedUrl}` : cleanedUrl,
      );
      const domain = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

      if (domain && !domains.includes(domain)) {
        domains.push(domain);
      }
    } catch {
      // Ignore malformed URL-like text.
    }

    if (domains.length === 3) {
      break;
    }
  }

  return domains;
}

async function checkUrls(text) {
  const domains = extractDomains(text);

  if (domains.length === 0) {
    return { suspiciousDomains: [], notes: [] };
  }

  const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const checks = await Promise.all(
    domains.map(async (domain) => {
      try {
        const response = await client.search(
          `"${domain}" scam phishing fraud report`,
          {
            searchDepth: "advanced",
            maxResults: 5,
            includeAnswer: false,
            includeRawContent: false,
            exactMatch: true,
          },
        );
        const concerningResults = response.results.filter((result) =>
          CONCERN_PATTERN.test(`${result.title} ${result.content}`),
        );

        if (concerningResults.length === 0) {
          return null;
        }

        const reportLabel = concerningResults.length === 1 ? "result" : "results";
        return {
          domain,
          note: `${domain} appeared in ${concerningResults.length} search ${reportLabel} mentioning scam, phishing, fraud, or malicious activity.`,
        };
      } catch (error) {
        console.error(`Tavily reputation lookup failed for ${domain}:`, error.message);
        return null;
      }
    }),
  );
  const suspiciousChecks = checks.filter(Boolean);

  return {
    suspiciousDomains: suspiciousChecks.map(({ domain }) => domain),
    notes: suspiciousChecks.map(({ note }) => note),
  };
}

module.exports = checkUrls;
