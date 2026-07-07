// Test Subdl with different URL formats
async function main() {
  const imdbId = "tt0092455";

  // Test Subdl TV format: /tv/imdb/season/episode
  console.log("=== Subdl TV format ===");
  try {
    const url = "https://subdl.com/subtitle/" + imdbId + "/5/26";
    console.log("URL:", url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    console.log("Status:", res.status, "Length:", html.length);
    console.log("HTML:", html.slice(0, 1000));
  } catch(e) {
    console.error("Error:", e.message);
  }

  // Test Subdl search
  console.log("\n=== Subdl Search ===");
  try {
    const url = "https://subdl.com/s/" + imdbId;
    console.log("URL:", url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    console.log("Status:", res.status, "Length:", html.length);
    // Check if it redirects or has content
    console.log("Contains 'subtitle':", html.toLowerCase().includes("subtitle"));
    console.log("HTML:", html.slice(0, 1000));
  } catch(e) {
    console.error("Error:", e.message);
  }

  // Test TVSubtitles.net for TNG S5E26
  console.log("\n=== TVSubtitles.net ===");
  try {
    const url = "https://www.tvsubtitles.net/episode-NA.html";
    console.log("URL:", url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    console.log("Status:", res.status);
    const html = await res.text();
    console.log("Length:", html.length);
    console.log("HTML:", html.slice(0, 500));
  } catch(e) {
    console.error("Error:", e.message);
  }
}

main().then(() => console.log("Done")).catch(e => console.error("Fatal:", e));
