// ============================================================
//  VERONIKAK — ADMIN PANEL JS
// ============================================================

// ── State ────────────────────────────────────────────────────
let adminProducts = [];
let editingIndex = -1;  // -1 = new product
let savedApiKey  = localStorage.getItem("vk_openai_key") || "";

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
  // Load saved appearance
  applySkin(localStorage.getItem("vk_admin_skin")   || "dark");
  applyLayout(localStorage.getItem("vk_admin_layout") || "sidebar");
}

// ── Page Navigation ────────────────────────────────────────────
function switchPage(page, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  if (el) el.classList.add("active");
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
}

function showApiStatus(msg, color) {
  const el = document.getElementById("api-status");
  if (el) { el.textContent = msg; el.style.color = color; }
}

// ── GPT caller ─────────────────────────────────────────────────
async function callGPT(prompt, systemPrompt) {
  if (!savedApiKey) return useFallback(prompt);
  const sys = systemPrompt || `You are an expert social media content creator for "VeronikaK" (sinuguru.square.site), a UK handmade jewellery shop selling beaded bracelets, braided bracelets, kids jewellery, and earrings. All items are £6. Location: UK.`;
  try {
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
  return `<div class="output-card ${extraClass}">
    <pre>${content}</pre>
    <div class="output-actions">
      <button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.output-card').querySelector('pre').textContent).then(()=>{this.textContent='✅ Copied!';setTimeout(()=>this.textContent='📋 Copy',1500)})">📋 Copy</button>
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

// ── Skin / Theme ──────────────────────────────────────────────────
function applySkin(skin) {
  document.body.classList.remove("theme-light", "theme-rose", "theme-ocean");
  if (skin !== "dark") document.body.classList.add("theme-" + skin);
  localStorage.setItem("vk_admin_skin", skin);
  document.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
  const sw = document.getElementById("sw-" + skin);
  if (sw) sw.classList.add("active");
}

function applyLayout(layout) {
  document.body.classList.remove("layout-topnav");
  if (layout === "topnav") document.body.classList.add("layout-topnav");
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
