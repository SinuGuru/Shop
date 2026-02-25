// ============================================================
//  fix-urls.js  —  Fetch real product URLs from Square sitemap
//                  and update products.js automatically
//  Usage:  node fix-urls.js
// ============================================================

const axios = require("axios");
const fs    = require("fs");
const path  = require("path");

const SHOP_URL = "https://sinuguru.square.site";

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function fetchSitemapUrls() {
  console.log("📡 Fetching sitemap from Square...");
  const res = await axios.get(`${SHOP_URL}/sitemap.xml`, { timeout: 15000 });
  const matches = [...res.data.matchAll(/<loc>(https:\/\/[^<]*\/product\/[^<]+)<\/loc>/g)];
  const urls = matches.map(m => m[1].trim());
  console.log(`✅ Found ${urls.length} product URLs in sitemap`);
  return urls;
}

function matchProductUrl(name, sitemapUrls) {
  const nameSlug = slugify(name);
  // Exact slug match
  let match = sitemapUrls.find(u => u.includes(`/product/${nameSlug}/`));
  if (match) return match;
  // Word overlap scoring — pick URL whose slug shares the most words
  const nameWords = nameSlug.split("-").filter(w => w.length > 2);
  let best = null, bestScore = 0;
  for (const u of sitemapUrls) {
    const urlSlug = u.replace(/.*\/product\//, "").replace(/\/\d+$/, "");
    const hits = nameWords.filter(w => urlSlug.includes(w)).length;
    if (hits > bestScore) { bestScore = hits; best = u; }
  }
  return bestScore >= 2 ? best : SHOP_URL;
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   VeronikaK — Fix Product URLs from Sitemap          ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const sitemapUrls = await fetchSitemapUrls();
  if (!sitemapUrls.length) {
    console.warn("⚠️  No URLs found in sitemap — skipping URL update.");
    process.exit(0);
  }

  // Load existing products.js
  const filePath = path.join(__dirname, "products.js");
  let source = fs.readFileSync(filePath, "utf8");

  // Parse product names from the source
  const nameMatches = [...source.matchAll(/name:\s*"([^"]+)"/g)];
  const names = nameMatches.map(m => m[1]);
  console.log(`\n📦 Updating URLs for ${names.length} products...\n`);

  let matched = 0, fallback = 0;
  for (const name of names) {
    const url = matchProductUrl(name, sitemapUrls);
    const isReal = url !== SHOP_URL;
    if (isReal) matched++; else fallback++;

    // Replace url field for this product — match the line after the name
    const nameEscaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    source = source.replace(
      new RegExp(`(name:\\s*"${nameEscaped}"[\\s\\S]*?url:\\s*)"[^"]*"`),
      `$1${JSON.stringify(url)}`
    );

    console.log(`  ${isReal ? "✅" : "⚠️ "} ${name.substring(0, 50).padEnd(50)} → ${isReal ? url.replace(SHOP_URL, "") : "(shop homepage)"}`);
  }

  fs.writeFileSync(filePath, source, "utf8");

  console.log(`\n✨ Done! ${matched} real URLs matched, ${fallback} fell back to homepage.`);
  console.log("📁 products.js updated — run: git add products.js && git commit -m 'Fix product URLs' && git push\n");
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
