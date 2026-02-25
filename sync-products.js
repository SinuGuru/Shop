// ============================================================
//  sync-products.js  â€”  VeronikaK Auto Product Sync
// ============================================================
//  HOW TO USE:
//    node sync-products.js --square=YOUR_SQUARE_TOKEN
//      â†’ Fetches products from Square API, generates fallback descriptions
//      â†’ Updates products.js + pushes descriptions back to Square
//
//    node sync-products.js --square=YOUR_SQUARE_TOKEN --key=sk-xxxx
//      â†’ Same as above but uses GPT-4o Vision for real AI descriptions
// ============================================================

const axios  = require("axios");
const fs     = require("fs");
const path   = require("path");

// â”€â”€ Parse CLI args â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
function ok(msg)   { console.log(`  âœ… ${msg}`); }
function warn(msg) { console.log(`  âš ️  ${msg}`); }
function info(msg) { console.log(`\nðŸ“Œ ${msg}`); }

const squareHeaders = {
  "Authorization": `Bearer ${SQUARE_TOKEN}`,
  "Content-Type": "application/json",
  "Square-Version": "2024-01-18"
};

// â”€â”€ Fetch all catalog items from Square API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Fetch image URL for a Square image ID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchSquareImageUrl(imageId) {
  try {
    const { data } = await axios.get(`${SQUARE_API}/catalog/object/${imageId}`, {
      headers: squareHeaders, timeout: 8000
    });
    return data.object?.image_data?.url || "";
  } catch { return ""; }
}

// â”€â”€ Update description on Square â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Generate AI description from image â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
Write a compelling 1â€“2 sentence product description based on the image.
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

// â”€â”€ Fallback descriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildFallbackDescription(name, category) {
  if (category === "Earrings") return "Beautiful handmade beaded earrings. Lightweight, stylish, and the perfect finishing touch to any look.";
  if (category === "Kids")     return "Fun and colourful handmade bracelet sized for children. Stretch fit, safe, and comfortable for little wrists.";
  if (category === "Braided")  return "Handcrafted braided bracelet with a beautiful woven design. Lightweight and stylish â€” perfect for everyday wear.";
  const n = name.toLowerCase();
  const size  = (n.match(/\d+mm/) || [""])[0];
  const color = n.includes("brown") ? "brown & yellow" : n.includes("blue") ? "blue & yellow" : n.includes("clear") ? "crystal clear" : "vibrant";
  const shape = n.includes("star") ? "golden star accents" : n.includes("octahedron") ? "golden octahedron spacers" : n.includes("cube") ? "golden cube charms" : "golden accents";
  return `Handmade stretch bracelet featuring ${size ? size + " " : ""}${color} round beads with ${shape}. Fits most adults.`;
}

// â”€â”€ Category / style helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function detectCategory(name) {
  const n = name.toLowerCase();
  if (n.includes("earring"))          return "Earrings";
  if (n.includes("braided"))          return "Braided";
  if (n.includes("kid") || n.includes("child")) return "Kids";
  return "Bracelets";
}
function detectEmoji(cat, name) {
  if (cat === "Earrings") return ["ðŸ’Ž","ðŸŒ¸","âœ¨","ðŸ’œ","ðŸŒº","ðŸª©"][Math.floor(Math.random()*6)];
  if (cat === "Kids")     return ["ðŸŒˆ","ðŸŽ ","ðŸŽ¡","ðŸŽ€","⭐","ðŸ¦‹"][Math.floor(Math.random()*6)];
  if (cat === "Braided")  return ["ðŸŒ¿","ðŸƒ","ðŸŒ¾","ðŸŽ‹","ðŸª¢","ðŸŒ»"][Math.floor(Math.random()*6)];
  const n = name.toLowerCase();
  if (n.includes("purple")) return "ðŸ’œ"; if (n.includes("blue")) return "ðŸ’™";
  if (n.includes("brown"))  return "ðŸ¤Ž"; if (n.includes("clear")) return "ðŸ”®";
  if (n.includes("star"))   return "⭐";
  return ["ðŸ’Ž","ðŸŒ¸","âœ¨","ðŸª©","ðŸŒŸ","ðŸ”®"][Math.floor(Math.random()*6)];
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
const TAGS = ["Best Seller ⭐","Popular ðŸ’•","Trending ðŸ”¥","New ðŸŒ¸","Sale ðŸ·️","Handmade ðŸ’›","Gift Idea ðŸŽ","Unique ðŸ’Ž"];

// â”€â”€ Write products.js â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
//  PRODUCT CATALOG â€” VeronikaK
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

// â”€â”€ MAIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function main() {
  console.log("\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—");
  console.log("â•‘   VeronikaK â€” Auto Product Sync (Square API)    â•‘");
  console.log("â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");

  if (!SQUARE_TOKEN) {
    console.error("\n�Œ No Square token. Run with: node sync-products.js --square=YOUR_TOKEN");
    process.exit(1);
  }
  console.log(DRY_RUN
    ? "\nâš¡ FALLBACK DESCRIPTIONS (add --key=sk-xxx for AI Vision)\n"
    : "\nðŸ¤– AI MODE â€” GPT-4o Vision + Square API sync\n");

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
      process.stdout.write(` ðŸ¤–`);
    } else {
      description = buildFallbackDescription(name, detectCategory(name));
      aiFallback++;
      process.stdout.write(` ðŸ“`);
    }

    // Push back to Square
    if (SQUARE_TOKEN) {
      const pushed = await pushDescriptionToSquare(item, description);
      if (pushed) { squareUpdated++; process.stdout.write(` âœ… Square`); }
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
  console.log("\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—");
  console.log("â•‘   Done!                                          â•‘");
  console.log("â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£");
  console.log(`â•‘  Products:            ${String(finalProducts.length).padEnd(27)}â•‘`);
  console.log(`â•‘  AI descriptions:     ${String(aiOk).padEnd(27)}â•‘`);
  console.log(`â•‘  Fallback:            ${String(aiFallback).padEnd(27)}â•‘`);
  console.log(`â•‘  Square updated:      ${String(squareUpdated).padEnd(27)}â•‘`);
  console.log("â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n");
  console.log("ðŸ“¦ Categories:");
  Object.entries(cats).forEach(([c,n]) => console.log(`   ${c.padEnd(15)} ${n} items`));

  console.log("\nðŸ’¡ To push to GitHub too, run:");
  console.log("   node download-images.js");
  console.log("   git add . && git commit -m \"Update products\" && git push\n");
}

main().catch(err => {
  console.error("\n�Œ Fatal error:", err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  process.exit(1);
});

