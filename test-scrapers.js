// Quick test of all scrapers
async function main() {
  const imdbId = "tt0092455";
  const season = 5, episode = 26;

  // Test Podnapisi
  console.log("=== Podnapisi ===");
  try {
    const url = "https://www.podnapisi.net/subtitles/search/?sublanguage_id=en&imdb_id=" + imdbId + "&sseason=" + season + "&sepisode=" + episode;
    console.log("URL:", url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    console.log("Status:", res.status, "Length:", html.length);
    // Check for subtitle rows
    const match1 = html.match(/<td[^>]*class="[^"]*lang[^"]*"[^>]*>/gi);
    const match2 = html.match(/<a[^>]*href="(\/[^"]+)"[^>]*rel="nofollow"/gi);
    console.log("Lang td matches:", match1?.length || 0);
    console.log("Link matches:", match2?.length || 0);
    // Print first 500 chars
    console.log("HTML start:", html.slice(0, 500));
    console.log("HTML end:", html.slice(-500));
  } catch(e) {
    console.error("Podnapisi error:", e);
  }

  // Test Subdl
  console.log("\n=== Subdl ===");
  try {
    const url = "https://subdl.com/s/subtitle/" + imdbId + "/" + season + "/" + episode;
    console.log("URL:", url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    console.log("Status:", res.status, "Length:", html.length);
    const match = html.match(/<tr[^>]*>.*?<td[^>]*class="[^"]*lang[^"]*"[^>]*>([^<]+)<\/td>/gis);
    console.log("Row matches:", match?.length || 0);
    console.log("HTML start:", html.slice(0, 500));
  } catch(e) {
    console.error("Subdl error:", e);
  }

  // Test TVSubtitles.net
  console.log("\n=== TVSubtitles.net ===");
  try {
    const url = "https://tvsubtitles.net/tvshow-NA-1.html";
    console.log("URL:", url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    console.log("Status:", res.status, "Length:", html.length);
    // Check for "Star Trek" in the page
    console.log("Contains 'Star Trek':", html.includes("Star Trek"));
    console.log("Contains 'Next Generation':", html.includes("Next Generation"));
  } catch(e) {
    console.error("TVSubtitles error:", e);
  }
}

main().then(() => console.log("Done")).catch(e => console.error("Fatal:", e));
