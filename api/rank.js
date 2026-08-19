export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { keyword, domain, country = "United States" } = req.body || {};

    if (!keyword || !domain) {
      return res.status(400).json({
        error: "Keyword and domain are required.",
      });
    }

    const apiKey = process.env.ZENROWS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "ZENROWS_API_KEY is not configured.",
      });
    }

    const cleanDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];

    const googleUrl =
      `https://www.google.com/search?q=${encodeURIComponent(keyword)}` +
      `&num=100`;

    const params = new URLSearchParams({
      url: googleUrl,
      apikey: apiKey,
      js_render: "true",
      premium_proxy: "true",
      autoparse: "true",
      location: country,
    });

    const response = await fetch(
      `https://api.zenrows.com/v1/?${params.toString()}`
    );

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: "ZenRows request failed.",
        details: errorText,
      });
    }

    const html = await response.text();

    const results = extractGoogleResults(html);

    const match = results.find((result) => {
      try {
        const hostname = new URL(result.url).hostname
          .toLowerCase()
          .replace(/^www\./, "");

        return (
          hostname === cleanDomain ||
          hostname.endsWith(`.${cleanDomain}`)
        );
      } catch {
        return false;
      }
    });

    return res.status(200).json({
      success: true,
      keyword,
      domain: cleanDomain,
      position: match ? match.position : null,
      url: match ? match.url : null,
      title: match ? match.title : null,
      totalResults: results.length,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unexpected server error.",
    });
  }
}

function extractGoogleResults(html) {
  const results = [];

  /*
   * Google result links commonly appear in:
   *
   * <a href="/url?q=https://example.com/...">
   *
   * This parser intentionally ignores Google-owned links.
   */

  const regex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    let href = match[1];

    if (href.startsWith("/url?q=")) {
      href = href.substring(7);
    }

    try {
      href = decodeURIComponent(href);
    } catch {
      continue;
    }

    if (!href.startsWith("http")) {
      continue;
    }

    const url = href.split("&")[0];

    const hostname = new URL(url).hostname.toLowerCase();

    if (
      hostname.includes("google.") ||
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com")
    ) {
      continue;
    }

    const title = match[2]
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (!results.some((item) => item.url === url)) {
      results.push({
        position: results.length + 1,
        url,
        title,
      });
    }

    if (results.length >= 100) {
      break;
    }
  }

  return results;
}
