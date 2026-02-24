// ============================================================
//  download-images.js
//  Downloads all product images locally and updates products.js
// ============================================================

const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const PRODUCTS_FILE = path.join(__dirname, "products.js");
const IMAGES_DIR    = path.join(__dirname, "images");

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);

// ── Load products.js ──────────────────────────────────────
let src = fs.readFileSync(PRODUCTS_FILE, "utf8");

// Parse all imageUrl values
const entries = [...src.matchAll(/imageUrl:\s*"(https?:\/\/[^"]+)"/g)];
console.log(`Found ${entries.length} images to download\n`);

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    lib.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", err => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

(async () => {
  let updated = src;
  let ok = 0, fail = 0;

  for (let i = 0; i < entries.length; i++) {
    const url  = entries[i][1];
    const ext  = path.extname(url.split("?")[0]) || ".jpeg";
    const name = `product-${String(i + 1).padStart(2, "0")}${ext}`;
    const dest = path.join(IMAGES_DIR, name);
    const local = `images/${name}`;

    process.stdout.write(`  [${String(i+1).padStart(2)}/${entries.length}] ${name}...`);
    try {
      await download(url, dest);
      const size = (fs.statSync(dest).size / 1024).toFixed(0);
      console.log(` ✓ ${size}KB`);
      // Replace the CDN URL with local path in products.js content
      updated = updated.replace(url, local);
      ok++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
      fail++;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  fs.writeFileSync(PRODUCTS_FILE, updated, "utf8");

  console.log(`\n✅ Done! ${ok} downloaded, ${fail} failed`);
  console.log(`📁 Saved to: images/`);
  console.log(`📝 products.js updated with local paths`);
})();
