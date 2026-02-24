// ============================================================
//  push-to-square.js
//  Pushes descriptions from products.js → Square catalog
//  Usage: node push-to-square.js --square=YOUR_TOKEN
// ============================================================

const axios = require("axios");
const fs    = require("fs");
const path  = require("path");

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => { const [k,v] = a.slice(2).split("="); return [k, v ?? true]; })
);

const SQUARE_TOKEN = args.square || process.env.SQUARE_TOKEN || "";
const SQUARE_API   = "https://connect.squareup.com/v2";

if (!SQUARE_TOKEN) {
  console.error("❌ No Square token. Run: node push-to-square.js --square=YOUR_TOKEN");
  process.exit(1);
}

const squareHeaders = {
  "Authorization": `Bearer ${SQUARE_TOKEN}`,
  "Content-Type":  "application/json",
  "Square-Version": "2024-01-18"
};

// Load products.js — eval in a wrapper to capture the const
const src = fs.readFileSync(path.join(__dirname, "products.js"), "utf8");
let localProducts;
try {
  const wrapper = `(function(){ ${src.replace(/^const /gm, "var ")} return products; })()`;
  localProducts = eval(wrapper);
} catch(e) {
  console.error("❌ Could not parse products.js:", e.message);
  process.exit(1);
}
console.log(`\n📦 Loaded ${localProducts.length} products from products.js`);

// Build name→description map
const descMap = {};
localProducts.forEach(p => { descMap[p.name.trim().toLowerCase()] = p.description; });

async function fetchCatalog() {
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
  return items;
}

(async () => {
  console.log("📌 Fetching catalog from Square...");
  const items = await fetchCatalog();
  console.log(`  ✅ Found ${items.length} items\n`);

  let ok = 0, skip = 0, fail = 0;

  for (const item of items) {
    const name = (item.item_data?.name || "").trim();
    const desc = descMap[name.toLowerCase()];

    if (!desc) {
      console.log(`  ⏭  Skipping "${name}" (not in products.js)`);
      skip++;
      continue;
    }

    process.stdout.write(`  Updating "${name}"...`);
    try {
      const updated = JSON.parse(JSON.stringify(item));
      updated.item_data.description = desc;
      delete updated.is_deleted;
      delete updated.present_at_all_locations;
      delete updated.updated_at;
      delete updated.created_at;
      // Keep version — Square requires it for optimistic locking

      await axios.post(`${SQUARE_API}/catalog/batch-upsert`, {
        idempotency_key: `vk-push-${item.id}-${Date.now()}`,
        batches: [{ objects: [updated] }]
      }, { headers: squareHeaders, timeout: 12000 });

      console.log(" ✅");
      ok++;
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.detail || err.message;
      console.log(` ❌ ${msg}`);
      fail++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n╔═══════════════════════════════╗`);
  console.log(`║ Updated: ${String(ok).padEnd(22)}║`);
  console.log(`║ Skipped: ${String(skip).padEnd(22)}║`);
  console.log(`║ Failed:  ${String(fail).padEnd(22)}║`);
  console.log(`╚═══════════════════════════════╝\n`);
})().catch(err => {
  console.error("❌ Fatal:", err.message);
  process.exit(1);
});
