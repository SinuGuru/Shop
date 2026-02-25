// ============================================================
//  VERONIKAK — ADMIN PANEL JS
// ============================================================

// ── State ────────────────────────────────────────────────────
let adminProducts = [];
let editingIndex = -1;  // -1 = new product
let savedApiKey    = localStorage.getItem("vk_openai_key")  || "";
let savedSquareKey = localStorage.getItem("vk_square_key") || "";

// Use /api/gpt proxy when deployed on Vercel (keys stay server-side)
const USE_VERCEL_PROXY = !["localhost","127.0.0.1"].includes(location.hostname)
                       && !location.hostname.includes("github.io");

// ── Init ─────────────────────────────────────────────────────
function initAdmin() {
  // Deep-clone products array from products.js — work on our own copy
  adminProducts = JSON.parse(JSON.stringify(products));
  // Apply any locally saved edits
  const saved = localStorage.getItem("vk_admin_products");
  if (saved) {
    try { adminProducts = JSON.parse(saved); } catch(e) {}
  }
  renderDashboard();
  renderProductList();
  if (savedApiKey) {
    const inp = document.getElementById("api-key-input");
    if (inp) inp.value = savedApiKey;
    showApiStatus("✅ API key loaded.", "var(--success)");
  }
  sessionStorage.getItem("vk_admin_auth") === "1" && updateStats();
  loadSettingsPage();
  // Load saved appearance
  applySkin(localStorage.getItem("vk_admin_skin")   || "dark");
  applyLayout(localStorage.getItem("vk_admin_layout") || "sidebar");
}

// ── Password Change ─────────────────────────────────────────────
async function changeAdminPassword() {
  const current  = document.getElementById("pw-current").value;
  const newPw    = document.getElementById("pw-new").value;
  const confirm  = document.getElementById("pw-confirm").value;
  const statusEl = document.getElementById("pw-change-status");
  function setStatus(msg, color) { statusEl.innerHTML = `<span style="color:${color}">${msg}</span>`; }

  if (!current || !newPw || !confirm) return setStatus("Please fill in all three fields.", "var(--danger)");
  if (newPw !== confirm)             return setStatus("New passwords don't match.", "var(--danger)");
  if (newPw.length < 6)              return setStatus("Password must be at least 6 characters.", "var(--danger)");

  const stored   = localStorage.getItem("vk_admin_pw_hash");
  const enteredH = await hashStr(current);
  const valid    = stored ? enteredH === stored : enteredH === await hashStr("veronika");
  if (!valid) {
    setStatus("Current password is incorrect.", "var(--danger)");
    document.getElementById("pw-current").value = "";
    return;
  }

  // Generate recovery code: 3 groups of 4 uppercase alphanumeric chars
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1
  const seg   = () => Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => chars[b % chars.length]).join("");
  const code  = `${seg()}-${seg()}-${seg()}`;

  localStorage.setItem("vk_admin_pw_hash",       await hashStr(newPw));
  localStorage.setItem("vk_admin_recovery_hash", await hashStr(code.replace(/-/g, "")));

  document.getElementById("pw-current").value = "";
  document.getElementById("pw-new").value     = "";
  document.getElementById("pw-confirm").value = "";

  statusEl.innerHTML = `
    <div style="margin-top:12px;padding:16px;background:rgba(74,222,128,.12);border:1.5px solid #4ade80;border-radius:12px">
      <div style="font-weight:700;color:#4ade80;margin-bottom:8px">✅ Password changed!</div>
      <div style="font-size:.8rem;color:var(--gray);margin-bottom:10px">Save your recovery code somewhere safe. It will only be shown <strong>once</strong>.</div>
      <div id="rc-display" style="font-size:1.35rem;font-weight:700;letter-spacing:.18em;color:var(--text);font-family:monospace;background:var(--surface2);padding:10px 16px;border-radius:8px;display:inline-block">${code}</div>
      <br><button onclick="copyRecoveryCode('${code}')" style="margin-top:10px;padding:6px 14px;border-radius:8px;border:none;background:var(--pink);color:#fff;font-size:.8rem;cursor:pointer"><i class='fas fa-copy'></i> Copy code</button>
    </div>`;
}

async function useRecoveryCode() {
  const raw     = document.getElementById("rec-code").value.trim().toUpperCase().replace(/-/g, "");
  const newPw   = document.getElementById("rec-newpw").value;
  const confirm = document.getElementById("rec-confirm").value;
  const errEl   = document.getElementById("rec-error");
  const okEl    = document.getElementById("rec-success");
  function showErr(msg) { errEl.textContent = msg; errEl.style.display = "block"; okEl.style.display = "none"; }

  if (!raw || !newPw || !confirm) return showErr("Please fill in all fields.");
  if (newPw !== confirm)          return showErr("Passwords don't match.");
  if (newPw.length < 6)          return showErr("Password must be at least 6 characters.");

  const storedHash = localStorage.getItem("vk_admin_recovery_hash");
  if (!storedHash) return showErr("No recovery code set. You must change your password first to generate one.");

  const enteredHash = await hashStr(raw);
  if (enteredHash !== storedHash) return showErr("Recovery code is incorrect.");

  // Valid — set new password and clear recovery code (single-use)
  localStorage.setItem("vk_admin_pw_hash", await hashStr(newPw));
  localStorage.removeItem("vk_admin_recovery_hash");

  errEl.style.display = "none";
  okEl.textContent = "✅ Password reset! Go back to login."; okEl.style.display = "block";
  document.getElementById("rec-code").value    = "";
  document.getElementById("rec-newpw").value   = "";
  document.getElementById("rec-confirm").value = "";
}

function toggleRecovery(show) {
  document.getElementById("login-panel").style.display    = show ? "none"  : "block";
  document.getElementById("recovery-panel").style.display = show ? "block" : "none";
  if (show) document.getElementById("rec-code").focus();
  else      document.getElementById("pw-input").focus();
}

function copyRecoveryCode(code) {
  navigator.clipboard.writeText(code).catch(() => {});
  const btn = event.target.closest("button");
  if (btn) { btn.textContent = "✅ Copied!"; setTimeout(() => { btn.innerHTML = "<i class='fas fa-copy'></i> Copy code"; }, 2000); }
}

// ── Page Navigation ────────────────────────────────────────────
function switchPage(page, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  if (el) el.classList.add("active");
  if (page === "orders") loadOrdersPage();
  return false;
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  updateStats();
  const cats = {};
  adminProducts.forEach(p => { cats[p.category] = (cats[p.category]||0)+1; });
  const breakdown = document.getElementById("cat-breakdown");
  if (breakdown) {
    breakdown.innerHTML = Object.entries(cats)
      .map(([c,n]) => `<div class="cat-row"><span>${c}</span><span>${n} items</span></div>`)
      .join("");
  }
}

function updateStats() {
  const imgCount = adminProducts.filter(p => p.imageUrl).length;
  document.getElementById("stat-products").textContent = adminProducts.length;
  document.getElementById("stat-images").textContent   = imgCount;
  document.getElementById("prod-count-badge").textContent = adminProducts.length;
}
// ── Orders & Stock ─────────────────────────────────────────
let _ordersLoaded = false;
async function loadOrdersPage(force = false) {
  if (_ordersLoaded && !force) return;
  const loading   = document.getElementById("orders-loading");
  const statsEl   = document.getElementById("orders-stats");
  const tableWrap = document.getElementById("orders-table-wrap");
  const invWrap   = document.getElementById("inventory-wrap");
  const errEl     = document.getElementById("orders-error");
  loading.style.display  = "flex";
  statsEl.style.display  = "none";
  tableWrap.style.display = "none";
  invWrap.style.display  = "none";
  errEl.style.display    = "none";
  try {
    const isLocal = ["localhost","127.0.0.1"].includes(location.hostname) || location.hostname.includes("github.io");
    const API = isLocal
      ? "https://shop-sandy-theta.vercel.app/api/orders?type=all"
      : "/api/orders?type=all";
    const res  = await fetch(API);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API error " + res.status);
    // — Stats
    if (data.stats) {
      statsEl.innerHTML = `
        <div class="stat-card"><i class="fas fa-receipt"></i><div><span>${data.stats.total}</span><small>Total Orders</small></div></div>
        <div class="stat-card"><i class="fas fa-sterling-sign"></i><div><span>£${data.stats.revenue}</span><small>Revenue</small></div></div>
        <div class="stat-card"><i class="fas fa-circle-check"></i><div><span>${data.stats.completed}</span><small>Completed</small></div></div>
        <div class="stat-card"><i class="fas fa-clock"></i><div><span>${data.stats.open}</span><small>Pending</small></div></div>
        <div class="stat-card"><i class="fas fa-bag-shopping"></i><div><span>${data.stats.items_sold}</span><small>Items Sold</small></div></div>`;
      statsEl.style.display = "grid";
    }
    // — Orders table
    if (data.orders) {
      const tbody = data.orders.length ? `
        <div class="orders-scroll">
          <table class="orders-tbl">
            <thead><tr><th>Date</th><th>Customer</th><th>Ship To</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>${data.orders.map(o => `
              <tr>
                <td>${new Date(o.created_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"})}</td>
                <td><strong>${escHtml(o.customer.name)}</strong>${o.customer.email?`<br><small>${escHtml(o.customer.email)}</small>`:""}</td>
                <td><small>${escHtml(o.address||"—")}</small></td>
                <td><small>${o.items.map(i=>`${i.qty}× ${escHtml(i.name)}`).join("<br>")||""}</small></td>
                <td><strong>£${o.total}</strong></td>
                <td><span class="order-badge order-${o.state.toLowerCase()}">${o.state}</span></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>` : `<p style="color:var(--gray);padding:16px 0">No orders yet — they\'ll appear here once customers check out.</p>`;
      document.getElementById("orders-table").innerHTML = tbody;
      tableWrap.style.display = "block";
    }
    // — Inventory
    if (data.inventory !== undefined) {
      const invHtml = data.inventory.length ? `
        <div class="orders-scroll">
          <table class="orders-tbl">
            <thead><tr><th>Product</th><th>Variation</th><th>Qty</th><th>Level</th></tr></thead>
            <tbody>${data.inventory.map(item => {
              const pct   = Math.min(100, (item.quantity / 20) * 100);
              const color = item.quantity <= 2 ? "var(--danger)" : item.quantity <= 5 ? "#f59e0b" : "var(--success)";
              return `<tr>
                <td><strong>${escHtml(item.product_name)}</strong></td>
                <td><small>${escHtml(item.variation)}</small></td>
                <td><strong style="color:${color}">${item.quantity}</strong></td>
                <td><div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${color}"></div></div></td>
              </tr>`;
            }).join("")}
            </tbody>
          </table>
        </div>` : `<p style="color:var(--gray);font-size:.88rem;line-height:1.8">No stock tracking data found.<br>Enable it in <strong>Square Dashboard → Items → click any product → Stock tab → Track inventory</strong>.</p>`;
      document.getElementById("inventory-table").innerHTML = invHtml;
      invWrap.style.display = "block";
    }
    _ordersLoaded = true;
  } catch (err) {
    errEl.innerHTML = `<div class="sync-note" style="border-color:var(--danger);margin-bottom:20px"><i class="fas fa-circle-xmark" style="color:var(--danger)"></i><span><strong>Could not load orders:</strong> ${escHtml(err.message)}</span></div>`;
    errEl.style.display = "block";
  } finally {
    loading.style.display = "none";
  }
}
function escHtml(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
// ── Product List ──────────────────────────────────────────────
function renderProductList(filter = "", cat = "") {
  const list = document.getElementById("product-list");
  if (!list) return;
  const filtered = adminProducts.filter((p, i) => {
    const matchText = !filter || p.name.toLowerCase().includes(filter.toLowerCase())
                               || p.description.toLowerCase().includes(filter.toLowerCase());
    const matchCat  = !cat || p.category === cat;
    return matchText && matchCat;
  });

  list.innerHTML = filtered.map((p, fi) => {
    const realIndex = adminProducts.indexOf(p);
    const thumb = p.imageUrl
      ? `<div class="prod-thumb"><img src="${p.imageUrl}" alt="${p.name}" onerror="this.parentElement.textContent='${p.emoji}'"/></div>`
      : `<div class="prod-thumb">${p.emoji}</div>`;
    return `
      <div class="product-list-item" onclick="openEditProduct(${realIndex})">
        ${thumb}
        <div class="prod-info">
          <h4>${p.name}</h4>
          <p>${p.description}</p>
        </div>
        <span class="prod-cat">${p.category}</span>
        <span class="prod-price">${p.price}</span>
        <button class="prod-edit-btn" onclick="event.stopPropagation(); openEditProduct(${realIndex})">
          <i class="fas fa-pen"></i> Edit
        </button>
      </div>`;
  }).join("");

  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray)">No products found.</div>`;
  }
}

function filterProducts() {
  const search = document.getElementById("prod-search").value;
  const cat    = document.getElementById("cat-filter").value;
  renderProductList(search, cat);
}

// ── Add / Edit Product Modal ───────────────────────────────────
function openAddProduct() {
  editingIndex = -1;
  document.getElementById("modal-title").textContent = "Add New Product";
  document.getElementById("delete-btn").style.display  = "none";
  document.getElementById("edit-id").value    = "";
  document.getElementById("edit-name").value  = "";
  document.getElementById("edit-desc").value  = "";
  document.getElementById("edit-price").value = "£6.00";
  document.getElementById("edit-url").value   = "https://sinuguru.square.site";
  document.getElementById("edit-img").value   = "";
  document.getElementById("edit-cat").value   = "Bracelets";
  document.getElementById("edit-tag").value   = "New 🌸";
  document.getElementById("product-modal").classList.add("open");
  document.getElementById("edit-name").focus();
}

function openEditProduct(index) {
  editingIndex = index;
  const p = adminProducts[index];
  document.getElementById("modal-title").textContent   = "Edit Product";
  document.getElementById("delete-btn").style.display  = "flex";
  document.getElementById("edit-id").value    = index;
  document.getElementById("edit-name").value  = p.name;
  document.getElementById("edit-desc").value  = p.description;
  document.getElementById("edit-price").value = p.price;
  document.getElementById("edit-url").value   = p.url;
  document.getElementById("edit-img").value   = p.imageUrl || "";
  document.getElementById("edit-cat").value   = p.category;
  document.getElementById("edit-tag").value   = p.tag;
  document.getElementById("product-modal").classList.add("open");
}

function closeModal() {
  document.getElementById("product-modal").classList.remove("open");
}

function saveProduct() {
  const name  = document.getElementById("edit-name").value.trim();
  const desc  = document.getElementById("edit-desc").value.trim();
  const price = document.getElementById("edit-price").value.trim();
  const url   = document.getElementById("edit-url").value.trim();
  const img   = document.getElementById("edit-img").value.trim();
  const cat   = document.getElementById("edit-cat").value;
  const tag   = document.getElementById("edit-tag").value;

  if (!name) { alert("Product name is required."); return; }

  const catEmojis = { Bracelets: "💎", Braided: "🌿", Kids: "🎀", Earrings: "✨" };
  const catBgs    = { Bracelets: "#fff0f9", Braided: "#f1f8e9", Kids: "#e8f5e9", Earrings: "#fce4f3" };

  const productObj = {
    id:          editingIndex >= 0 ? adminProducts[editingIndex].id : adminProducts.length + 1,
    name, tag, category: cat, description: desc, price,
    emoji:    catEmojis[cat] || "💎",
    bg:       catBgs[cat]    || "#fff0f9",
    url, imageUrl: img
  };

  if (editingIndex >= 0) {
    adminProducts[editingIndex] = productObj;
  } else {
    adminProducts.push(productObj);
  }

  persistLocal();
  renderProductList(
    document.getElementById("prod-search").value,
    document.getElementById("cat-filter").value
  );
  renderDashboard();
  closeModal();
  showToast(editingIndex >= 0 ? "Product updated!" : "Product added!");
}

function deleteProduct() {
  if (!confirm(`Delete "${adminProducts[editingIndex].name}"?`)) return;
  adminProducts.splice(editingIndex, 1);
  // Re-assign IDs
  adminProducts.forEach((p, i) => p.id = i + 1);
  persistLocal();
  renderProductList();
  renderDashboard();
  closeModal();
  showToast("Product deleted.");
}

function persistLocal() {
  localStorage.setItem("vk_admin_products", JSON.stringify(adminProducts));
}

// ── Export products.js ─────────────────────────────────────────
function downloadProductsJs() {
  const lines = adminProducts.map(p => `  {
    id: ${p.id},
    name: ${JSON.stringify(p.name)},
    tag: ${JSON.stringify(p.tag)},
    category: ${JSON.stringify(p.category)},
    description: ${JSON.stringify(p.description)},
    price: ${JSON.stringify(p.price)},
    emoji: ${JSON.stringify(p.emoji)},
    bg: ${JSON.stringify(p.bg)},
    url: ${JSON.stringify(p.url)},
    imageUrl: ${JSON.stringify(p.imageUrl || "")}
  }`);

  const content = `// ============================================================
//  PRODUCT CATALOG — VeronikaK
//  EXPORTED from Admin Panel on ${new Date().toLocaleDateString("en-GB")}
//  ${adminProducts.length} products
// ============================================================

const SQUARE_SHOP = "https://sinuguru.square.site";

const products = [
${lines.join(",\n")}
];
`;

  const blob = new Blob([content], { type: "application/javascript" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = "products.js";
  a.click();
  showToast("products.js downloaded! Replace the file in your project folder, then git push.");
}

// ── AI: Generate description for product in modal ─────────────
async function aiDescFromName() {
  const name = document.getElementById("edit-name").value.trim();
  if (!name) { alert("Enter a product name first."); return; }
  if (!savedApiKey) { alert("Add your OpenAI API key in the AI Content tab first."); return; }
  const btn = event.target.closest("button");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
  btn.disabled = true;
  const desc = await callGPT(`Write a 1-2 sentence product description for a handmade UK jewellery item called: "${name}". Be specific about materials/style, mention handmade, max 30 words, no hashtags.`);
  document.getElementById("edit-desc").value = desc;
  btn.innerHTML = '<i class="fas fa-robot"></i> Generate with AI';
  btn.disabled = false;
}

// ── AI Content Tab ─────────────────────────────────────────────
function switchAiTab(tab, el) {
  document.querySelectorAll(".ai-tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".ai-panel").forEach(p => p.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("ai-" + tab).classList.add("active");
}

function saveApiKey() {
  const val = document.getElementById("api-key-input").value.trim();
  if (!val || !val.startsWith("sk-")) {
    showApiStatus("❌ Invalid key format.", "var(--danger)");
    return;
  }
  savedApiKey = val;
  localStorage.setItem("vk_openai_key", val);
  showApiStatus("✅ Key saved! AI mode active.", "var(--success)");
  loadSettingsPage();
}

function showApiStatus(msg, color) {
  const el = document.getElementById("api-status");
  if (el) { el.textContent = msg; el.style.color = color; }
}

// ── GPT caller ─────────────────────────────────────────────────
async function callGPT(prompt, systemPrompt) {
  const sys = systemPrompt || `You are an expert social media content creator for "VeronikaK" (sinuguru.square.site), a UK handmade jewellery shop selling beaded bracelets, braided bracelets, kids jewellery, and earrings. All items are £6. Location: UK.`;
  try {
    // On Vercel: use server-side proxy (API key stays secret)
    if (USE_VERCEL_PROXY) {
      const res = await fetch("/api/gpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemPrompt: sys, max_tokens: 600 })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.result;
    }
    // On GitHub Pages / localhost: use key from localStorage
    if (!savedApiKey) return useFallback(prompt);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${savedApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 600,
        messages: [{ role: "system", content: sys }, { role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content.trim();
  } catch(e) {
    console.warn("GPT error:", e.message);
    return useFallback(prompt);
  }
}

function useFallback(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("caption")) return "✨ Handmade with love — this little beauty is yours for just £6! 💕\n\nEach piece is made by hand, so no two are exactly alike. \n\n🛒 Shop now: sinuguru.square.site\n\n#HandmadeJewellery #BeadedBracelet #VeronikaK #HandmadeUK";
  if (p.includes("reel") || p.includes("script")) return "HOOK (0-3s): Close-up of hands stringing colourful beads\nMIDDLE: Time-lapse of bracelet being made\nOUTRO: Finished bracelet on wrist, price reveal — \"Just £6!\"\nCALL TO ACTION: \"Link in bio to shop\"";
  if (p.includes("hashtag")) return "#HandmadeJewellery #BeadedBracelet #HandmadeUK #JewelleryLover #BraceletStack #HandmadeGifts #UKMaker #ShopSmall #EtsyUK #BraceletOfTheDay #HandcraftedJewellery #GiftIdeas #UniqueJewellery #JewelleryAddict #WristCandy";
  if (p.includes("bio")) return "🌸 Handmade jewellery by Veronika\n💎 Beaded bracelets & earrings — all £6\n📦 Fast UK shipping\n👇 Shop now";
  return "Content generated! Add your OpenAI key for personalised AI output.";
}

function outputCard(content, extraClass = "") {
  // Render basic markdown: **bold**, ## headers, numbered/bullet lists
  const html = content
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^#{1,3}\s+(.+)$/gm, "<strong style='font-size:1rem'>$1</strong>")
    .replace(/\n/g, "<br>");
  return `<div class="output-card ${extraClass}">
    <div style="font-size:.88rem;line-height:1.8">${html}</div>
    <div class="output-actions">
      <button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.output-card').querySelector('div').innerText).then(()=>{this.textContent='\u2705 Copied!';setTimeout(()=>this.textContent='\ud83d\udccb Copy',1500)})">📋 Copy</button>
    </div>
  </div>`;
}

function showLoading(id) {
  document.getElementById(id).innerHTML = `<div style="text-align:center;padding:30px;color:var(--gray)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><p style="margin-top:12px;font-size:.88rem">Generating...</p></div>`;
}

// ── Captions ────────────────────────────────────────────────────
async function generateCaptions() {
  const product = document.getElementById("caption-product").value || "beaded bracelet";
  const tone    = document.getElementById("caption-tone").value;
  showLoading("caption-output");
  const result = await callGPT(`Write 3 different Instagram captions for a post about: "${product}". Tone: ${tone}. Each must include: a hook, 2-3 sentences about the product, a call to action to visit sinuguru.square.site, and 5 relevant hashtags. Separate each caption with "---".`);
  const captions = result.split(/---+/).filter(c => c.trim());
  document.getElementById("caption-output").innerHTML = captions.map(c => outputCard(c.trim())).join("");
}

// ── Reels Script ────────────────────────────────────────────────
async function generateReelScript() {
  const topic    = document.getElementById("reel-topic").value || "making a bracelet";
  const duration = document.getElementById("reel-duration").value;
  showLoading("reel-output");
  const result = await callGPT(`Write a ${duration} Instagram Reel script about: "${topic}" for VeronikaK jewellery shop. Format with: HOOK (0-3s), MAIN CONTENT with timestamps, OUTRO with CTA. Make it exciting and shareable.`);
  document.getElementById("reel-output").innerHTML = outputCard(result);
}

// ── Hashtags ────────────────────────────────────────────────────
async function generateHashtags() {
  const topic = document.getElementById("hashtag-topic").value || "handmade jewellery UK";
  const size  = document.getElementById("hashtag-size").value;
  showLoading("hashtag-output");
  const result = await callGPT(`Generate ${size} Instagram hashtags for: "${topic}". Mix of popular, niche, and location-based UK tags. Return only the hashtags separated by spaces, no explanations.`);
  const tags = result.match(/#\w+/g) || result.split(/\s+/).filter(t => t);
  document.getElementById("hashtag-output").innerHTML = `
    <div class="output-card">
      <div>${tags.map(t => `<span class="hashtag-pill">${t.startsWith("#") ? t : "#"+t}</span>`).join("")}</div>
      <div class="output-actions">
        <button class="copy-btn" onclick="navigator.clipboard.writeText('${tags.join(" ")}').then(()=>{this.textContent='✅ Copied!';setTimeout(()=>this.textContent='📋 Copy',1500)})">📋 Copy All</button>
      </div>
    </div>`;
}

// ── Content Calendar ────────────────────────────────────────────
async function generateCalendar() {
  const focus = document.getElementById("cal-focus").value || "general jewellery content";
  showLoading("calendar-output");
  const result = await callGPT(`Create a 7-day Instagram content calendar for VeronikaK jewellery shop. Theme: "${focus}". For each day provide: day name, post type (Reel/Photo/Story/Carousel), and a short content idea. Format each line as: DAY | TYPE | IDEA`);
  const lines = result.split("\n").filter(l => l.includes("|"));
  document.getElementById("calendar-output").innerHTML = lines.map(l => {
    const [day, type, ...rest] = l.split("|").map(s => s.trim());
    return `<div class="calendar-day"><span class="day-name">${day}</span><div class="day-content"><strong>${type}</strong><p>${rest.join(" ")}</p></div></div>`;
  }).join("") || outputCard(result);
}

// ── Story Ideas ─────────────────────────────────────────────────
async function generateStoryIdeas() {
  const goal = document.getElementById("story-goal").value || "engage followers";
  showLoading("story-output");
  const result = await callGPT(`Give 5 Instagram Story ideas for VeronikaK jewellery shop with goal: "${goal}". Each idea should be concrete and actionable. Number them 1-5.`);
  document.getElementById("story-output").innerHTML = outputCard(result);
}

// ── Settings page ─────────────────────────────────────────────────
function loadSettingsPage() {
  const oEl = document.getElementById("settings-openai");
  const sEl = document.getElementById("settings-square");
  const oSt = document.getElementById("openai-key-status");
  const sSt = document.getElementById("square-key-status");
  const cmd = document.getElementById("cmd-with-tokens");
  if (oEl && savedApiKey)    { oEl.value = savedApiKey;    oSt.textContent = "✅ OpenAI key saved";  oSt.style.color = "var(--success)"; }
  if (sEl && savedSquareKey) { sEl.value = savedSquareKey; sSt.textContent = "✅ Square token saved"; sSt.style.color = "var(--success)"; }
  if (cmd) {
    if (savedSquareKey && savedApiKey) {
      cmd.textContent = `node sync-products.js --square=${savedSquareKey} --key=${savedApiKey}`;
    } else if (savedSquareKey) {
      cmd.textContent = `node sync-products.js --square=${savedSquareKey}`;
    } else {
      cmd.textContent = "Save your keys above to generate this command.";
    }
  }
}

function saveSettingsKeys() {
  const oVal = document.getElementById("settings-openai").value.trim();
  const sVal = document.getElementById("settings-square").value.trim();
  const oSt  = document.getElementById("openai-key-status");
  const sSt  = document.getElementById("square-key-status");
  let saved  = 0;

  if (oVal) {
    if (!oVal.startsWith("sk-")) {
      oSt.textContent = "❌ Invalid — should start with sk-"; oSt.style.color = "var(--danger)";
    } else {
      savedApiKey = oVal;
      localStorage.setItem("vk_openai_key", oVal);
      oSt.textContent = "✅ Saved!"; oSt.style.color = "var(--success)";
      const inp = document.getElementById("api-key-input");
      if (inp) inp.value = oVal;
      showApiStatus("✅ API key loaded.", "var(--success)");
      saved++;
    }
  }
  if (sVal) {
    if (!sVal.startsWith("EAAA")) {
      sSt.textContent = "❌ Invalid — Square tokens start with EAAA"; sSt.style.color = "var(--danger)";
    } else {
      savedSquareKey = sVal;
      localStorage.setItem("vk_square_key", sVal);
      sSt.textContent = "✅ Saved!"; sSt.style.color = "var(--success)";
      saved++;
    }
  }
  if (saved) { loadSettingsPage(); showToast(`✅ ${saved} key${saved>1?"s":""} saved!`); }
}

// ── Audience Strategy ────────────────────────────────────────────
async function generateAudienceStrategy() {
  const goal     = document.getElementById("target-goal").value;
  const platform = document.getElementById("target-platform").value;
  const product  = document.getElementById("target-product").value;
  showLoading("targeting-output");
  const extra = product ? ` Focus: "${product}".` : "";
  const result = await callGPT(
    `Create a detailed ${platform} audience targeting strategy for VeronikaK (UK handmade jewellery, all £6). Goal: ${goal}.${extra}
Include:
1. **Primary audience** — age, gender, location, interests to target
2. **Secondary audience** — a niche group to also reach
3. **Interests & topics** to use in ${platform} targeting (list 10-15 specific ones)
4. **Accounts / pages** they likely follow (influencers, brands, hashtag communities)
5. **Best posting times** for UK audience on ${platform}
6. **Content hook** — one sentence that grabs this exact audience
Format clearly with bold headers.`,
    `You are a social media marketing expert specialising in UK small businesses and handmade products.`
  );
  document.getElementById("targeting-output").innerHTML = outputCard(result);
}

// ── Ideal Customer Profile ────────────────────────────────────────
async function generateCustomerProfile() {
  const focus = document.getElementById("icp-focus").value;
  showLoading("icp-output");
  const result = await callGPT(
    `Create a detailed Ideal Customer Profile (buyer persona) for VeronikaK, a UK handmade jewellery shop. Focus: ${focus}. All items £6.
Include:
- **Name & age** (fictional persona)
- **Location** (UK specific)
- **Lifestyle & values**
- **Why they buy handmade jewellery**
- **Where they spend time online** (platforms, accounts, communities)
- **What content stops their scroll**
- **Purchase triggers** — what makes them actually buy
- **Objections** — what might stop them buying and how to overcome it
- **Best way to reach them** — 3 specific content/ad ideas tailored to this person
Make it vivid, specific and actionable.`,
    `You are a consumer psychology and marketing expert specialising in UK e-commerce and handmade goods.`
  );
  document.getElementById("icp-output").innerHTML = outputCard(result);
}

// ── Bio ──────────────────────────────────────────────────────────
async function generateBio() {
  const platform = document.getElementById("bio-platform").value;
  const kw       = document.getElementById("bio-kw").value || "handmade jewellery UK";
  showLoading("bio-output");
  const result = await callGPT(`Write 3 different ${platform} bios for VeronikaK, a UK handmade jewellery shop. Keywords: ${kw}. All items £6. Include emojis, a CTA and the link sinuguru.square.site. Max 150 chars each. Separate with "---".`);
  const bios = result.split(/---+/).filter(b => b.trim());
  document.getElementById("bio-output").innerHTML = bios.map(b => outputCard(b.trim())).join("");
}

// ── Sync page: copy code ──────────────────────────────────────────
function copyCode(id) {
  const text = document.getElementById(id).textContent;
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!"));
}

// ── Toast notification ────────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById("admin-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "admin-toast";
    toast.style.cssText = "position:fixed;bottom:28px;right:28px;background:#1a1a2e;color:#fff;padding:12px 22px;border-radius:10px;font-size:.88rem;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.3);opacity:0;transition:opacity .3s";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = "0", 2800);
}

// ── Boot on DOMContentLoaded (if already authed) ──────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem("vk_admin_auth") === "1") {
    document.getElementById("admin-app").style.display = "flex";
    document.getElementById("pw-gate").style.display   = "none";
    initAdmin();
  }
});

// ── Auto-Post to Instagram ──────────────────────────────────────────
async function generateAndPreviewPost() {
  const topic = document.getElementById("autopost-topic").value || "handmade bracelet";
  const tone  = document.getElementById("autopost-tone").value;
  const img   = document.getElementById("autopost-image").value.trim();
  const prev  = document.getElementById("autopost-preview");
  document.getElementById("autopost-status").textContent = "";

  const caption = await callGPT(
    `Write one Instagram caption for a post about: "${topic}". Tone: ${tone}. Include a hook, 2-3 sentences, CTA to visit sinuguru.square.site, and 5-8 hashtags.`
  );
  document.getElementById("autopost-caption").value = caption;
  if (img) {
    document.getElementById("autopost-img-preview").src = img;
    document.getElementById("autopost-img-preview").style.display = "block";
  } else {
    document.getElementById("autopost-img-preview").style.display = "none";
  }
  prev.style.display = "block";
}

async function postToInstagram(btn) {
  const caption  = document.getElementById("autopost-caption").value.trim();
  const imageUrl = document.getElementById("autopost-image").value.trim();
  const status   = document.getElementById("autopost-status");

  if (!caption)  { status.textContent = "❌ Write or generate a caption first."; status.style.color = "var(--danger)"; return; }
  if (!imageUrl) { status.textContent = "❌ Add a public image URL first.";       status.style.color = "var(--danger)"; return; }
  if (!USE_VERCEL_PROXY) {
    status.textContent = "⚠️ Auto-posting only works when deployed on Vercel. Copy the caption and post manually for now.";
    status.style.color = "var(--gray)";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
  status.textContent = "";

  try {
    const res  = await fetch("/api/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, caption })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    status.innerHTML = `<span style="color:var(--success)">✅ Posted to Instagram! Post ID: ${data.post_id}</span>`;
    showToast("✅ Posted to Instagram!");
  } catch(e) {
    status.innerHTML = `<span style="color:var(--danger)">❌ ${e.message}</span>`;
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fab fa-instagram"></i> Post to Instagram';
}

// ── Auto-Post to Instagram ────────────────────────────────────────
async function generateAndPreviewPost() {
  const topic = document.getElementById("autopost-topic").value || "handmade bracelet";
  const tone  = document.getElementById("autopost-tone").value;
  const img   = document.getElementById("autopost-image").value.trim();
  const prev  = document.getElementById("autopost-preview");
  document.getElementById("autopost-status").textContent = "";

  const caption = await callGPT(
    `Write one Instagram caption for a post about: "${topic}". Tone: ${tone}. Include a hook, 2-3 sentences, CTA to visit sinuguru.square.site, and 5-8 hashtags.`
  );
  document.getElementById("autopost-caption").value = caption;
  if (img) {
    document.getElementById("autopost-img-preview").src = img;
    document.getElementById("autopost-img-preview").style.display = "block";
  } else {
    document.getElementById("autopost-img-preview").style.display = "none";
  }
  prev.style.display = "block";
}

async function postToInstagram(btn) {
  const caption  = document.getElementById("autopost-caption").value.trim();
  const imageUrl = document.getElementById("autopost-image").value.trim();
  const status   = document.getElementById("autopost-status");

  if (!caption)  { status.textContent = "❌ Write or generate a caption first."; status.style.color = "var(--danger)"; return; }
  if (!imageUrl) { status.textContent = "❌ Add a public image URL first.";       status.style.color = "var(--danger)"; return; }
  if (!USE_VERCEL_PROXY) {
    status.textContent = "⚠️ Auto-posting only works when deployed on Vercel. Copy the caption and post manually for now.";
    status.style.color = "var(--gray)";
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
  try {
    const res  = await fetch("/api/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, caption })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    status.innerHTML = `<span style="color:var(--success)">✅ Posted! Post ID: ${data.post_id}</span>`;
    showToast("✅ Posted to Instagram!");
  } catch(e) {
    status.innerHTML = `<span style="color:var(--danger)">❌ ${e.message}</span>`;
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fab fa-instagram"></i> Post to Instagram';
}

// ── Fix Product URLs via Sitemap ─────────────────────────────────
async function fixProductUrls(btn) {
  const output = document.getElementById("fix-urls-output");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching sitemap...';
  output.innerHTML = '';

  const SHOP = "https://sinuguru.square.site";
  let xml = "";

  // Try direct fetch first, fall back to CORS proxy
  try {
    const r = await fetch(`${SHOP}/sitemap.xml`);
    if (!r.ok) throw new Error("non-200");
    xml = await r.text();
  } catch {
    try {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Using proxy...';
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(SHOP+"/sitemap.xml")}`;
      const r = await fetch(proxy);
      const j = await r.json();
      xml = j.contents || "";
    } catch(e) {
      output.innerHTML = `<div class="sync-note" style="border-color:#fca5a5;background:#fef2f2"><i class="fas fa-xmark" style="color:var(--danger)"></i><span>Could not fetch sitemap: ${e.message}</span></div>`;
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-rotate"></i> Fetch &amp; Fix All URLs';
      return;
    }
  }

  // Parse all product URLs from sitemap
  const sitemapUrls = [...xml.matchAll(/<loc>(https:\/\/[^<]*\/product\/[^<]+)<\/loc>/g)]
    .map(m => m[1].trim());

  if (!sitemapUrls.length) {
    output.innerHTML = `<div class="sync-note" style="border-color:#fca5a5;background:#fef2f2"><i class="fas fa-xmark" style="color:var(--danger)"></i><span>No product URLs found in sitemap.</span></div>`;
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-rotate"></i> Fetch &amp; Fix All URLs';
    return;
  }

  function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
  function matchUrl(name) {
    const ns = slugify(name);
    let m = sitemapUrls.find(u => u.includes(`/product/${ns}/`));
    if (m) return m;
    const words = ns.split("-").filter(w => w.length > 2);
    let best = null, top = 0;
    for (const u of sitemapUrls) {
      const uslug = u.replace(/.*\/product\//,"").replace(/\/\d+$/,"");
      const hits = words.filter(w => uslug.includes(w)).length;
      if (hits > top) { top = hits; best = u; }
    }
    return top >= 2 ? best : SHOP;
  }

  let matched = 0, fallback = 0;
  const rows = [];

  adminProducts = adminProducts.map(p => {
    const url = matchUrl(p.name);
    const isReal = url !== SHOP;
    if (isReal) matched++; else fallback++;
    rows.push(`<div style="display:flex;gap:10px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:.78rem">
      <span style="color:${isReal?'var(--success)':'var(--gray)'}">${isReal?'✅':'⚠️'}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span>
      <span style="color:var(--gray);flex-shrink:0">${url.replace(SHOP,"") || "(homepage)"}</span>
    </div>`);
    return { ...p, url };
  });

  persistLocal();
  renderProductList();

  output.innerHTML = `
    <div class="sync-note" style="margin-bottom:12px">
      <i class="fas fa-check-circle" style="color:var(--success)"></i>
      <span><strong>${matched} URLs matched</strong> from ${sitemapUrls.length} in sitemap${fallback ? `, ${fallback} fell back to homepage` : ""}. <strong>Click Export products.js</strong> on the Products page then git push.</span>
    </div>
    <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px 12px;background:var(--bg)">${rows.join("")}</div>`;

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-rotate"></i> Fetch &amp; Fix All URLs';
  showToast(`✅ ${matched}/${adminProducts.length} product URLs updated!`);
}

// ── Skin / Theme ──────────────────────────────────────────────────
function applySkin(skin) {
  // Apply to <html> so it overrides :root CSS variables
  const html = document.documentElement;
  html.classList.remove("theme-light", "theme-rose", "theme-ocean");
  if (skin !== "dark") html.classList.add("theme-" + skin);
  localStorage.setItem("vk_admin_skin", skin);
  document.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
  const sw = document.getElementById("sw-" + skin);
  if (sw) sw.classList.add("active");
}

function applyLayout(layout) {
  document.documentElement.classList.remove("layout-topnav");
  if (layout === "topnav") document.documentElement.classList.add("layout-topnav");
  localStorage.setItem("vk_admin_layout", layout);
  const sb = document.getElementById("lb-sidebar");
  const tn = document.getElementById("lb-topnav");
  if (sb) sb.classList.toggle("active", layout === "sidebar");
  if (tn) tn.classList.toggle("active",  layout === "topnav");
}

function toggleSkinPanel() {
  document.getElementById("skin-panel").classList.toggle("open");
}

// Close panel when clicking outside
document.addEventListener("click", e => {
  const panel = document.getElementById("skin-panel");
  if (panel && panel.classList.contains("open")
      && !panel.contains(e.target)
      && !e.target.closest(".skin-toggle-btn")) {
    panel.classList.remove("open");
  }
});
