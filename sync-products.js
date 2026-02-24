// ============================================================
//  sync-products.js  —  VeronikaK Auto Product Sync
// ============================================================
//  HOW TO USE:
//    1. Run:  npm install
//    2. Run:  node sync-products.js
//       (dry run — scrapes shop, no AI, no API key needed)
//
//    3. For AI descriptions add your OpenAI key:
//       node sync-products.js --key=sk-xxxx
//
//    4. After it finishes, products.js is updated automatically!
// ============================================================

const axios  = require("axios");
const fs     = require("fs");
const path   = require("path");

// ── Parse CLI args ───────────────────────────────────────────
const args   = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => { const [k,v] = a.slice(2).split("="); return [k, v ?? true]; })
);

const OPENAI_KEY  = args.key   || process.env.OPENAI_API_KEY || "";
const DRY_RUN     = !OPENAI_KEY;
const SHOP_URL    = "https://sinuguru.square.site";
const DELAY_MS    = 1200; // delay between AI calls to avoid rate limiting

// ── Helpers ──────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg)  { console.log(`  ${msg}`); }
function ok(msg)   { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function info(msg) { console.log(`\n📌 ${msg}`); }

// ── Category detection from URL / name ───────────────────────
function detectCategory(url, name) {
  const u = url.toLowerCase();
  const n = name.toLowerCase();
  if (u.includes("/earrings") || n.includes("earring"))    return "Earrings";
  if (u.includes("/braided")  || n.includes("braided"))    return "Braided";
  if (u.includes("/kids")     || u.includes("/kid-"))      return "Kids";
  return "Bracelets";
}

// ── Emoji & colour by category / name ────────────────────────
function detectEmoji(category, name) {
  const n = name.toLowerCase();
  if (category === "Earrings") return ["💎","🌸","✨","💜","🌺","🪩"][Math.floor(Math.random()*6)];
  if (category === "Kids")     return ["🌈","🎠","🎡","🎀","⭐","🦋"][Math.floor(Math.random()*6)];
  if (category === "Braided")  return ["🌿","🍃","🌾","🎋","🪢","🌻"][Math.floor(Math.random()*6)];
  // Bracelets — try to match colour
  if (n.includes("purple"))  return "💜";
  if (n.includes("blue"))    return "💙";
  if (n.includes("brown"))   return "🤎";
  if (n.includes("clear"))   return "🔮";
  if (n.includes("star"))    return "⭐";
  return ["💎","🌸","✨","🪩","🌟","🔮"][Math.floor(Math.random()*6)];
}

function detectBg(category, name) {
  const n = name.toLowerCase();
  if (category === "Earrings") return "#fce4f3";
  if (category === "Kids")     return "#e8f5e9";
  if (category === "Braided")  return "#f1f8e9";
  if (n.includes("purple"))   return "#f3e5f5";
  if (n.includes("blue"))     return "#e3f2fd";
  if (n.includes("brown"))    return "#efebe9";
  if (n.includes("clear"))    return "#e8eaf6";
  return "#fff0f9";
}

function detectTag(name, index) {
  const tags = [
    "Best Seller ⭐", "Popular 💕", "Trending 🔥", "New 🌸",
    "Sale 🏷️", "Handmade 💛", "Gift Idea 🎁", "Unique 💎"
  ];
  return tags[index % tags.length];
}

// ── Fetch all product URLs from shop page ─────────────────────
async function fetchAllProductUrls() {
  info("Fetching product list from shop...");
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-GB,en;q=0.9",
  };

  const { data } = await axios.get(`${SHOP_URL}/s/shop`, { headers, timeout: 15000 });

  // Extract all /product/ links from HTML
  const urlRegex = /href="(\/product\/[^"?]+)/g;
  const found  = new Set();
  let match;
  while ((match = urlRegex.exec(data)) !== null) {
    found.add(SHOP_URL + match[1]);
  }

  // Also catch absolute links
  const absRegex = new RegExp(`"(${SHOP_URL}/product/[^"?]+)`, "g");
  while ((match = absRegex.exec(data)) !== null) {
    found.add(match[1]);
  }

  const urls = [...found];
  ok(`Found ${urls.length} products`);
  return urls;
}

// ── Fetch a single product page ───────────────────────────────
async function fetchProduct(url) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121",
    "Accept": "text/html,application/xhtml+xml",
  };

  try {
    const { data } = await axios.get(url, { headers, timeout: 12000 });

    // ── Extract title ──────────────────────────────────────────
    let name = "";
    const h1Match = data.match(/<h1[^>]*class="[^"]*product[^"]*"[^>]*>([^<]{5,200})<\/h1>/i)
                 || data.match(/<h1[^>]*>([^<]{5,200})<\/h1>/i);
    if (h1Match) name = h1Match[1].replace(/&amp;/g,"&").replace(/&#39;/g,"'").trim();

    // Fallback: og:title
    if (!name) {
      const og = data.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
      if (og) name = og[1].trim();
    }
    // Fallback: <title>
    if (!name) {
      const t = data.match(/<title>([^<]+)<\/title>/i);
      if (t) name = t[1].replace(/\s*[\|\u2013\u2014-].*$/, "").trim();
    }

    // Strip site name suffix like " | VeronikaK"
    name = name.replace(/\s*[\|\u2013\u2014]\s*VeronikaK.*$/i, "").trim();
    // Strip trailing " | " patterns
    name = name.replace(/\s*\|\s*$/, "").trim();

    // ── Extract price ──────────────────────────────────────────
    const priceMatch = data.match(/£\s*(\d+(?:\.\d{2})?)/);
    const price = priceMatch ? `£${priceMatch[1]}` : "£6.00";

    // ── Extract image ──────────────────────────────────────────
    let imageUrl = "";

    // Try og:image first (most reliable)
    const ogImg = data.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
                || data.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (ogImg) imageUrl = ogImg[1];

    // Try CDN image URL
    if (!imageUrl) {
      const cdn = data.match(/https:\/\/\d+\.cdn\d+\.editmysite\.com\/uploads\/[^"'\s?]+\.(?:jpeg|jpg|png|webp)/i);
      if (cdn) imageUrl = cdn[0];
    }

    // Try any large image
    if (!imageUrl) {
      const img = data.match(/<img[^>]+src="(https:\/\/[^"]+(?:jpeg|jpg|png|webp))[^"]*"[^>]+(?:alt="altText"|class="[^"]*product)/i);
      if (img) imageUrl = img[1];
    }

    return { url, name: name || "Product", price, imageUrl };
  } catch (err) {
    warn(`Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

// ── Generate AI description from image ───────────────────────
async function generateDescription(product) {
  if (!OPENAI_KEY) return null;
  if (!product.imageUrl) {
    warn(`No image for "${product.name}" — using fallback description`);
    return null;
  }

  try {
    const body = {
      model: "gpt-4o",
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: `You are a product description writer for "VeronikaK", a UK handmade jewellery shop. 
Write a compelling 1–2 sentence product description based on the image.
Rules:
- Be specific about what you see (colours, bead types, style)
- Mention it's handmade
- End with something that makes people want to buy it
- Max 25 words
- No hashtags, no price mentions`
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: product.imageUrl,
                detail: "low"  // cheaper & faster, sufficient for products
              }
            },
            {
              type: "text",
              text: `Write a product description for: ${product.name}`
            }
          ]
        }
      ]
    };

    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      body,
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    return data.choices[0].message.content.trim();
  } catch (err) {
    warn(`AI failed for "${product.name}": ${err.response?.data?.error?.message || err.message}`);
    return null;
  }
}

// ── Fallback descriptions when no AI ─────────────────────────
function buildFallbackDescription(name, category) {
  const n = name.toLowerCase();
  if (category === "Earrings") {
    return `Beautiful handmade beaded earrings. Lightweight, stylish, and the perfect finishing touch to any look. Pairs great with our bracelets!`;
  }
  if (category === "Kids") {
    return `Fun and colourful handmade bracelet sized for children. Stretch fit, safe, and comfortable for little wrists. Makes a perfect gift!`;
  }
  if (category === "Braided") {
    return `Handcrafted braided bracelet with a beautiful woven design. Lightweight and stylish — great for everyday wear or stacking.`;
  }
  // Bracelets
  const size  = n.match(/\d+mm/) ? n.match(/\d+mm/)[0] : "";
  const color = n.includes("brown") ? "brown & yellow"
               : n.includes("purple") ? "purple"
               : n.includes("blue")   ? "blue & yellow"
               : n.includes("clear")  ? "crystal clear"
               : "vibrant";
  const shape = n.includes("star")        ? "golden star accents"
               : n.includes("octahedron") ? "golden octahedron spacers"
               : n.includes("cube")       ? "golden cube charms"
               : "golden accents";
  return `Handmade stretch bracelet featuring ${size ? size + " " : ""}${color} round beads with ${shape}. 7 inches (18cm) — fits most adults.`;
}

// ── Build JS product entry ────────────────────────────────────
function buildProductEntry(product, index, description) {
  const category = detectCategory(product.url, product.name);
  const emoji    = detectEmoji(category, product.name);
  const bg       = detectBg(category, product.name);
  const tag      = detectTag(product.name, index);
  const desc     = description || buildFallbackDescription(product.name, category);

  return {
    id:          index + 1,
    name:        product.name,
    tag:         tag,
    category:    category,
    description: desc,
    price:       product.price,
    emoji:       emoji,
    bg:          bg,
    url:         product.url,
    imageUrl:    product.imageUrl || ""
  };
}

// ── Write products.js ─────────────────────────────────────────
function writeProductsFile(products) {
  const lines = products.map(p => {
    const safeDesc = p.description.replace(/`/g, "'").replace(/\\/g, "\\\\");
    const safeName = p.name.replace(/`/g, "'");
    return `  {
    id: ${p.id},
    name: ${JSON.stringify(safeName)},
    tag: ${JSON.stringify(p.tag)},
    category: ${JSON.stringify(p.category)},
    description: ${JSON.stringify(p.description)},
    price: ${JSON.stringify(p.price)},
    emoji: ${JSON.stringify(p.emoji)},
    bg: ${JSON.stringify(p.bg)},
    url: ${JSON.stringify(p.url)},
    imageUrl: ${JSON.stringify(p.imageUrl)}
  }`;
  });

  const content = `// ============================================================
//  PRODUCT CATALOG — VeronikaK
//  AUTO-GENERATED by sync-products.js on ${new Date().toLocaleDateString("en-GB")}
//  ${products.length} products synced from https://sinuguru.square.site
//  Re-run: node sync-products.js --key=YOUR_OPENAI_KEY
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
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   VeronikaK — Auto Product Sync                 ║");
  console.log("╚══════════════════════════════════════════════════╝");

  if (DRY_RUN) {
    console.log("\n⚡ DRY RUN MODE (no API key provided)");
    console.log("   → Will scrape shop & generate fallback descriptions");
    console.log("   → For AI image descriptions, run:");
    console.log("     node sync-products.js --key=sk-YOUR_OPENAI_KEY\n");
  } else {
    console.log(`\n🤖 AI MODE — Using GPT-4o Vision`);
    console.log(`   → Will analyse each product image and generate descriptions\n`);
  }

  // Step 1: Get all product URLs
  let productUrls;
  try {
    productUrls = await fetchAllProductUrls();
  } catch (err) {
    console.error(`❌ Failed to fetch shop: ${err.message}`);
    process.exit(1);
  }

  if (!productUrls.length) {
    warn("No products found. The site may be blocking scraping.");
    warn("Using known product URLs from last sync instead...");
    productUrls = KNOWN_PRODUCT_URLS;
  }

  // Step 2: Fetch each product page
  info(`Fetching ${productUrls.length} product pages...`);
  const rawProducts = [];
  for (let i = 0; i < productUrls.length; i++) {
    const url = productUrls[i];
    const slug = url.split("/product/")[1]?.split("/")[0] || url;
    process.stdout.write(`  [${String(i+1).padStart(2)}/${productUrls.length}] ${slug}...`);
    try {
      const product = await fetchProduct(url);
      if (product && product.name && product.name !== "Product" && product.name.length > 3) {
        rawProducts.push(product);
        console.log(` ✓ "${product.name}" ${product.imageUrl ? "📷" : "⚠️ no image"}`);
      } else {
        console.log(` ✗ skipped (no name)`);
      }
    } catch (err) {
      console.log(` ✗ error: ${err.message}`);
    }
    await sleep(350);
  }

  ok(`Successfully fetched ${rawProducts.length} products`);

  // Step 3: Generate AI descriptions (if API key provided)
  info(DRY_RUN ? "Generating fallback descriptions..." : "Generating AI descriptions from product images...");

  const finalProducts = [];
  let aiSuccess = 0;
  let aiFallback = 0;

  for (let i = 0; i < rawProducts.length; i++) {
    const p = rawProducts[i];
    process.stdout.write(`  [${String(i+1).padStart(2)}/${rawProducts.length}] ${p.name}...`);

    let description = null;
    if (!DRY_RUN) {
      description = await generateDescription(p);
      await sleep(DELAY_MS);
    }

    if (description) {
      aiSuccess++;
      console.log(` 🤖 AI ✓`);
    } else {
      aiFallback++;
      console.log(` 📝 fallback`);
    }

    finalProducts.push(buildProductEntry(p, i, description));
  }

  // Step 4: Write products.js
  info("Writing products.js...");
  writeProductsFile(finalProducts);
  ok("products.js updated successfully!");

  // ── Summary ───────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Done! Summary                                  ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  Products found:      ${String(rawProducts.length).padEnd(27)}║`);
  if (!DRY_RUN) {
  console.log(`║  AI descriptions:     ${String(aiSuccess).padEnd(27)}║`);
  console.log(`║  Fallback used:       ${String(aiFallback).padEnd(27)}║`);
  }
  console.log(`║  File saved:          products.js${" ".repeat(18)}║`);
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (DRY_RUN) {
    console.log("💡 To use AI Vision descriptions, run:");
    console.log("   node sync-products.js --key=sk-YOUR_OPENAI_KEY\n");
  }

  // Print category breakdown
  const cats = {};
  finalProducts.forEach(p => { cats[p.category] = (cats[p.category]||0)+1; });
  console.log("📦 Products by category:");
  Object.entries(cats).forEach(([cat, count]) => {
    console.log(`   ${cat.padEnd(15)} ${count} items`);
  });
  console.log("");
}

// ── Known fallback URLs (used if scraping fails) ──────────────
const KNOWN_PRODUCT_URLS = [
  "https://sinuguru.square.site/product/12mm-round-beaded-with-golden-coloured-stars-bracelet/1",
  "https://sinuguru.square.site/product/10mm-brown-yellow-round-beaded-with-golden-coloured-stars-bracelet/5",
  "https://sinuguru.square.site/product/10mm-brown-yellow-round-beaded-with-golden-coloured-octahedron-bracelet/6",
  "https://sinuguru.square.site/product/8mm-blue-and-yellow-round-beaded-with-golden-coloured-cube-and-barrell-bracelet/7",
  "https://sinuguru.square.site/product/clear-1/10",
  "https://sinuguru.square.site/product/clear-2/11",
  "https://sinuguru.square.site/product/type-5/18",
  "https://sinuguru.square.site/product/type-6/19",
  "https://sinuguru.square.site/product/type-8/21",
  "https://sinuguru.square.site/product/braided-3/25",
  "https://sinuguru.square.site/product/braided-6/28",
  "https://sinuguru.square.site/product/braided-9/31",
  "https://sinuguru.square.site/product/braided-10/32",
  "https://sinuguru.square.site/product/braided-12/34",
  "https://sinuguru.square.site/product/kids-1/36",
  "https://sinuguru.square.site/product/kid-2/37",
  "https://sinuguru.square.site/product/kids-3/38",
  "https://sinuguru.square.site/product/earrings-2/40",
  "https://sinuguru.square.site/product/earrings-3/41",
  "https://sinuguru.square.site/product/earrings-5/43",
  "https://sinuguru.square.site/product/earrings-6/44",
  "https://sinuguru.square.site/product/earrings-7/45",
  "https://sinuguru.square.site/product/earrings-8/46",
  "https://sinuguru.square.site/product/earrings-9/47",
  "https://sinuguru.square.site/product/earrings-10/48",
];

main().catch(err => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
