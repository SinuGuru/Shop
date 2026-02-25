// ============================================================
//  sync-products.js  —  VeronikaK Auto Product Sync
// ============================================================
//  HOW TO USE:
//    node sync-products.js --square=YOUR_SQUARE_TOKEN
//      → Fetches products from Square API, generates fallback descriptions
//      → Updates products.js + pushes descriptions back to Square
//
//    node sync-products.js --square=YOUR_SQUARE_TOKEN --key=sk-xxxx
//      → Same as above but uses GPT-4o Vision for real AI descriptions
// ============================================================

const axios  = require("axios");
const fs     = require("fs");
const path   = require("path");

// ── Parse CLI args ───────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => { const [k,v] = a.slice(2).split("="); return [k, v ?? true]; })
);

const OPENAI_KEY   = args.key    || process.env.OPENAI_API_KEY  || "";
const SQUARE_TOKEN = args.square || process.env.SQUARE_TOKEN    || "";
const DRY_RUN      = !OPENAI_KEY;
const SQUARE_API   = "https://connect.squareup.com/v2";
const SHOP_URL     = "https://sinuguru.square.site";
const DELAY_MS     = 1200;

const sleep = ms => new Promise(r => setTimeout(r, ms));
function ok(msg)   { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function info(msg) { console.log(`\n📌 ${msg}`); }

const squareHeaders = {
  "Authorization": `Bearer ${SQUARE_TOKEN}`,
  "Content-Type": "application/json",
  "Square-Version": "2024-01-18"
};

// ── Fetch all catalog items from Square API ───────────────────
async function fetchSquareCatalog() {
  info("Fetching products from Square API...");
  const items = [];
  let cursor = null;

  do {
    const params = new URLSearchParams({ types: "ITEM", limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const { data } = await axios.get(`${SQUARE_API}/catalog/list?${params}`, {
      headers: squareHeaders, timeout: 15000
    });
    if (data.objects) items.push(...data.objects.filter(o => o.type === "ITEM"));
    cursor = data.cursor || null;
  } while (cursor);

  ok(`Found ${items.length} products in Square catalog`);
  return items;
}

// ── Fetch image URL for a Square image ID ────────────────────
async function fetchSquareImageUrl(imageId) {
  try {
    const { data } = await axios.get(`${SQUARE_API}/catalog/object/${imageId}`, {
      headers: squareHeaders, timeout: 8000
    });
    return data.object?.image_data?.url || "";
  } catch { return ""; }
}

// ── Update description on Square ─────────────────────────────
async function pushDescriptionToSquare(item, description) {
  try {
    const updated = JSON.parse(JSON.stringify(item)); // deep clone
    updated.item_data.description = description;
    // Remove read-only fields (but KEEP version — Square needs it)
    delete updated.is_deleted;
    delete updated.present_at_all_locations;
    delete updated.updated_at;
    delete updated.created_at;

    await axios.post(`${SQUARE_API}/catalog/batch-upsert`, {
      idempotency_key: `vk-sync-${item.id}-${Date.now()}`,
      batches: [{ objects: [updated] }]
    }, { headers: squareHeaders, timeout: 12000 });
    return true;
  } catch (err) {
    warn(`Square update failed for "${item.item_data?.name}": ${err.response?.data?.errors?.[0]?.detail || err.message}`);
    return false;
  }
}

// ── Generate AI description from image ───────────────────────
async function generateDescription(name, imageUrl) {
  if (!OPENAI_KEY || !imageUrl) return null;
  try {
    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content: `You are a product description writer for "VeronikaK", a UK handmade jewellery shop (sinuguru.square.site).
Write a compelling 1–2 sentence product description based on the image.
Rules: be specific about colours/materials/style, mention handmade, make people want to buy it, max 30 words, no hashtags, no price.`
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
              { type: "text", text: `Product name: ${name}` }
            ]
          }
        ]
      },
      { headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" }, timeout: 20000 }
    );
    return data.choices[0].message.content.trim();
  } catch (err) {
    warn(`AI failed for "${name}": ${err.response?.data?.error?.message || err.message}`);
    return null;
  }
}

// ── Fallback descriptions ─────────────────────────────────────
function buildFallbackDescription(name, category) {
  if (category === "Earrings") return "Beautiful handmade beaded earrings. Lightweight, stylish, and the perfect finishing touch to any look.";
  if (category === "Kids")     return "Fun and colourful handmade bracelet sized for children. Stretch fit, safe, and comfortable for little wrists.";
  if (category === "Braided")  return "Handcrafted braided bracelet with a beautiful woven design. Lightweight and stylish — perfect for everyday wear.";
  const n = name.toLowerCase();
  const size  = (n.match(/\d+mm/) || [""])[0];
  const color = n.includes("brown") ? "brown & yellow" : n.includes("blue") ? "blue & yellow" : n.includes("clear") ? "crystal clear" : "vibrant";
  const shape = n.includes("star") ? "golden star accents" : n.includes("octahedron") ? "golden octahedron spacers" : n.includes("cube") ? "golden cube charms" : "golden accents";
  return `Handmade stretch bracelet featuring ${size ? size + " " : ""}${color} round beads with ${shape}. Fits most adults.`;
}

// ── Category / style helpers ──────────────────────────────────
function detectCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("earring"))          return "Earrings";
  if (n.includes("braided"))          return "Braided";
  if (n.includes("kid") || n.includes("child")) return "Kids";
  return "Bracelets";
}
function detectEmoji(cat, name) {
  if (cat === "Earrings") return ["💎","🌸","✨","💜","🌺","🪩"][Math.floor(Math.random()*6)];
  if (cat === "Kids")     return ["🌈","🎠","🎡","🎀","⭐","🦋"][Math.floor(Math.random()*6)];
  if (cat === "Braided")  return ["🌿","ðŸƒ","🌾","🎋","🪢","🌻"][Math.floor(Math.random()*6)];
  const n = name.toLowerCase();
  if (n.includes("purple")) return "💜"; if (n.includes("blue")) return "💙";
  if (n.includes("brown"))  return "🤎"; if (n.includes("clear")) return "🔮";
  if (n.includes("star"))   return "⭐";
  return ["💎","🌸","✨","🪩","🌟","🔮"][Math.floor(Math.random()*6)];
}
function detectBg(cat, name) {
  if (cat === "Earrings") return "#fce4f3";
  if (cat === "Kids")     return "#e8f5e9";
  if (cat === "Braided")  return "#f1f8e9";
  const n = name.toLowerCase();
  if (n.includes("purple")) return "#f3e5f5"; if (n.includes("blue")) return "#e3f2fd";
  if (n.includes("brown"))  return "#efebe9"; if (n.includes("clear")) return "#e8eaf6";
  return "#fff0f9";
}
const TAGS = ["Best Seller ⭐","Popular 💕","Trending 🔥","New 🌸","Sale 🏷️","Handmade 💛","Gift Idea 🎁","Unique 💎"];

// ── Sitemap URL fetching & matching ──────────────────────────
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function fetchSitemapUrls() {
  try {
    const { data } = await axios.get(`${SHOP_URL}/sitemap.xml`, { timeout: 15000 });
    const matches = [...data.matchAll(/<loc>(https:\/\/[^<]*\/product\/[^<]+)<\/loc>/g)];
    return matches.map(m => m[1].trim());
  } catch (err) {
    warn(`Could not fetch sitemap: ${err.message}`);
    return [];
  }
}

function matchProductUrl(name, sitemapUrls) {
  if (!sitemapUrls.length) return SHOP_URL;
  const nameSlug = slugify(name);
  let match = sitemapUrls.find(u => u.includes(`/product/${nameSlug}/`));
  if (match) return match;
  const nameWords = nameSlug.split("-").filter(w => w.length > 2);
  let best = null, bestScore = 0;
  for (const u of sitemapUrls) {
    const urlSlug = u.replace(/.*\/product\//, "").replace(/\/\d+$/, "");
    const hits = nameWords.filter(w => urlSlug.includes(w)).length;
    if (hits > bestScore) { bestScore = hits; best = u; }
  }
  return bestScore >= 2 ? best : SHOP_URL;
}

// ── Write products.js ─────────────────────────────────────────
function writeProductsFile(products) {
  const lines = products.map(p => `  {
    id: ${p.id},
    name: ${JSON.stringify(p.name)},
    tag: ${JSON.stringify(p.tag)},
    category: ${JSON.stringify(p.category)},
    description: ${JSON.stringify(p.description)},
    price: ${JSON.stringify(p.price)},
    emoji: ${JSON.stringify(p.emoji)},
    bg: ${JSON.stringify(p.bg)},
    url: ${JSON.stringify(p.url)},
    imageUrl: ${JSON.stringify(p.imageUrl)}
  }`);
  const content = `// ============================================================
//  PRODUCT CATALOG — VeronikaK
//  AUTO-GENERATED by sync-products.js on ${new Date().toLocaleDateString("en-GB")}
//  ${products.length} products synced from Square API
// ============================================================

const SQUARE_SHOP = "https://sinuguru.square.site";

const products = [
${lines.join(",\n")}
];
`;
  fs.writeFileSync(path.join(__dirname, "products.js"), content, "utf8");
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log("\n╔â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•╗");
  console.log("║   VeronikaK — Auto Product Sync (Square API)    ║");
  console.log("╚â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");

  if (!SQUARE_TOKEN) {
    console.error("\n�Œ No Square token. Run with: node sync-products.js --square=YOUR_TOKEN");
    process.exit(1);
  }
  console.log(DRY_RUN
    ? "\n⚡ FALLBACK DESCRIPTIONS (add --key=sk-xxx for AI Vision)\n"
    : "\n🤖 AI MODE — GPT-4o Vision + Square API sync\n");

  // Step 1: Fetch from Square API
  const catalogItems = await fetchSquareCatalog();

  // Step 1b: Fetch real product URLs from sitemap
  info("Fetching product URLs from sitemap...");
  const sitemapUrls = await fetchSitemapUrls();
  ok(`Found ${sitemapUrls.length} product URLs in sitemap`);

  // Step 2: Process each item
  info("Processing products...");
  const finalProducts = [];
  let aiOk = 0, aiFallback = 0, squareUpdated = 0;

  for (let i = 0; i < catalogItems.length; i++) {
    const item     = catalogItems[i];
    const itemData = item.item_data || {};
    const name     = itemData.name || "Product";

    // Get price from first variation
    const variation  = (itemData.variations || [])[0];
    const priceMoney = variation?.item_variation_data?.price_money;
    const price      = priceMoney ? `£${(priceMoney.amount / 100).toFixed(2)}` : "£6.00";

    // Get image URL
    let imageUrl = "";
    const imageIds = itemData.image_ids || [];
    if (imageIds.length > 0) {
      imageUrl = await fetchSquareImageUrl(imageIds[0]);
    }

    // Link to Square shop homepage (individual product URLs can't be reliably derived from the API)
    const url = matchProductUrl(name, sitemapUrls);

    process.stdout.write(`  [${String(i+1).padStart(2)}/${catalogItems.length}] ${name}...`);

    // Generate description
    let description = null;
    if (!DRY_RUN && imageUrl) {
      description = await generateDescription(name, imageUrl);
      await sleep(DELAY_MS);
    }
    if (description) {
      aiOk++;
      process.stdout.write(` 🤖`);
    } else {
      description = buildFallbackDescription(name, detectCategory(name));
      aiFallback++;
      process.stdout.write(` ðŸ“`);
    }

    // Push back to Square
    if (SQUARE_TOKEN) {
      const pushed = await pushDescriptionToSquare(item, description);
      if (pushed) { squareUpdated++; process.stdout.write(` ✅ Square`); }
    }
    console.log("");

    const cat = detectCategory(name);
    finalProducts.push({
      id:          i + 1,
      name,
      tag:         TAGS[i % TAGS.length],
      category:    cat,
      description,
      price,
      emoji:       detectEmoji(cat, name),
      bg:          detectBg(cat, name),
      url:         item.url || url,
      imageUrl
    });
  }

  // Step 3: Write products.js
  info("Writing products.js...");
  writeProductsFile(finalProducts);
  ok("products.js updated!");

  // Summary
  const cats = {};
  finalProducts.forEach(p => { cats[p.category] = (cats[p.category]||0)+1; });
  console.log("\n╔â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•╗");
  console.log("║   Done!                                          ║");
  console.log("╠â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•╣");
  console.log(`║  Products:            ${String(finalProducts.length).padEnd(27)}║`);
  console.log(`║  AI descriptions:     ${String(aiOk).padEnd(27)}║`);
  console.log(`║  Fallback:            ${String(aiFallback).padEnd(27)}║`);
  console.log(`║  Square updated:      ${String(squareUpdated).padEnd(27)}║`);
  console.log("╚â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n");
  console.log("📦 Categories:");
  Object.entries(cats).forEach(([c,n]) => console.log(`   ${c.padEnd(15)} ${n} items`));

  console.log("\n💡 To push to GitHub too, run:");
  console.log("   node download-images.js");
  console.log("   git add . && git commit -m \"Update products\" && git push\n");
}

main().catch(err => {
  console.error("\n�Œ Fatal error:", err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});

