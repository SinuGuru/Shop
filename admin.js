// ============================================================
//  VERONIKAK — ADMIN PANEL JS
// ============================================================

// ── State ────────────────────────────────────────────────────
let adminProducts = [];
let editingIndex = -1;  // -1 = new product
let savedApiKey    = localStorage.getItem("vk_openai_key")  || "";
let savedRunwayKey = localStorage.getItem("vk_runway_key")  || "";
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
  if (page === "orders")        loadOrdersPage();
  if (page === "analytics")     loadAnalyticsPage();
  if (page === "discounts")     loadDiscountsPage();
  if (page === "shop-settings") loadShopSettings();
  if (page === "creative")      loadCreativeStudio();
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
      const threshold = parseInt(localStorage.getItem("vk_low_stock") || "3");
      const tbody = data.orders.length ? `
        <div class="orders-scroll">
          <table class="orders-tbl">
            <thead><tr><th>Date</th><th>Customer</th><th>Ship To</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${data.orders.map(o => {
              const payId = (o.paymentIds||[])[0] || "";
              const trackingInfo = o.tracking?.number ? `<br><small style="color:var(--gray)">📦 ${escHtml(o.tracking.carrier)} ${escHtml(o.tracking.number)}</small>` : "";
              let actions = "";
              if (o.state === "OPEN") {
                actions = `<button class="order-action-btn order-ship-btn" onclick="openShipModal('${o.id}',${o.version||1})" title="Mark as shipped">🚚 Ship</button>`;
                actions += ` <button class="order-cancel-btn" onclick="cancelOrder('${o.id}', ${o.version||1}, this)" title="Cancel order">✕ Cancel</button>`;
              } else if (o.state === "COMPLETED" && payId) {
                actions = `<button class="order-action-btn order-refund-btn" onclick="refundOrder('${o.id}','${payId}',${o.totalPence||0},this)" title="Refund order">💰 Refund</button>`;
              }
              return `
              <tr id="order-row-${o.id}">
                <td>${new Date(o.created_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"})}</td>
                <td><strong>${escHtml(o.customer.name)}</strong>${o.customer.email?`<br><small>${escHtml(o.customer.email)}</small>`:""}</td>
                <td><small>${escHtml(o.address||"—")}</small></td>
                <td><small>${o.items.map(i=>`${i.qty}× ${escHtml(i.name)}`).join("<br>")||""}</small></td>
                <td><strong>£${o.total}</strong></td>
                <td><span class="order-badge order-${o.state.toLowerCase()}" id="order-badge-${o.id}">${o.state}</span>${trackingInfo}</td>
                <td id="order-actions-${o.id}">${actions}</td>
              </tr>`;}).join("")}
            </tbody>
          </table>
        </div>` : `<p style="color:var(--gray);padding:16px 0">No orders yet — they\'ll appear here once customers check out.</p>`;
      document.getElementById("orders-table").innerHTML = tbody;
      tableWrap.style.display = "block";
    }
    // — Inventory
    if (data.inventory !== undefined) {
      const threshold = parseInt(localStorage.getItem("vk_low_stock") || "3");
      const lowItems  = data.inventory.filter(i => i.quantity <= threshold);
      let lowAlert = "";
      if (lowItems.length) {
        lowAlert = `<div class="sync-note" style="border-color:#f59e0b;margin-bottom:16px"><i class="fas fa-triangle-exclamation" style="color:#f59e0b"></i><span><strong>⚠️ ${lowItems.length} item${lowItems.length>1?"s":""} running low:</strong> ${lowItems.map(i=>`${escHtml(i.product_name)} (${i.quantity} left)`).join(", ")}</span></div>`;
      }
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
      document.getElementById("inventory-table").innerHTML = lowAlert + invHtml;
      invWrap.style.display = "block";
    }
    _ordersLoaded = true;
    if (data.orders) _ordersData = data.orders;
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

async function refundOrder(orderId, paymentId, totalPence, btn) {
  const amtStr = totalPence ? `£${(totalPence/100).toFixed(2)}` : "full amount";
  if (!confirm(`Issue a full refund of ${amtStr} for this order? This cannot be undone.`)) return;
  btn.disabled = true; btn.textContent = "Refunding...";
  try {
    const isLocal = ["localhost","127.0.0.1"].includes(location.hostname) || location.hostname.includes("github.io");
    const API = isLocal ? "https://shop-sandy-theta.vercel.app/api/refund-order" : "/api/refund-order";
    const res  = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ orderId, paymentId, amountPence: totalPence || undefined }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    const actionsEl = document.getElementById("order-actions-" + orderId);
    if (actionsEl) actionsEl.innerHTML = `<span style="color:var(--success);font-size:.78rem">✅ Refunded £${data.amount}</span>`;
  } catch (err) {
    alert("Could not refund: " + err.message);
    btn.disabled = false; btn.innerHTML = "💰 Refund";
  }
}

function openShipModal(orderId, version) {
  document.getElementById("ship-order-id").value      = orderId;
  document.getElementById("ship-order-version").value = version;
  document.getElementById("ship-tracking").value      = "";
  document.getElementById("ship-modal-status").textContent = "";
  document.getElementById("ship-submit-btn").disabled = false;
  document.getElementById("ship-submit-btn").innerHTML = "<i class='fas fa-truck'></i> Mark Shipped";
  document.getElementById("ship-modal").style.display = "flex";
  document.body.style.overflow = "hidden";
}
function closeShipModal() {
  document.getElementById("ship-modal").style.display = "none";
  document.body.style.overflow = "";
}
async function submitShipOrder() {
  const orderId  = document.getElementById("ship-order-id").value;
  const version  = parseInt(document.getElementById("ship-order-version").value) || 1;
  const carrier  = document.getElementById("ship-carrier").value;
  const tracking = document.getElementById("ship-tracking").value.trim();
  const btn      = document.getElementById("ship-submit-btn");
  const statusEl = document.getElementById("ship-modal-status");
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    const isLocal = ["localhost","127.0.0.1"].includes(location.hostname) || location.hostname.includes("github.io");
    const API = isLocal ? "https://shop-sandy-theta.vercel.app/api/ship-order" : "/api/ship-order";
    const res  = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ orderId, version, carrier, trackingNumber: tracking }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    // Update row in-place
    const badge = document.getElementById("order-badge-" + orderId);
    if (badge) {
      badge.className = "order-badge order-completed"; badge.textContent = "COMPLETED";
      if (tracking) badge.insertAdjacentHTML("afterend", `<br><small style="color:var(--gray)">📦 ${escHtml(carrier)} ${escHtml(tracking)}</small>`);
    }
    const actionsEl = document.getElementById("order-actions-" + orderId);
    if (actionsEl) actionsEl.innerHTML = `<span style="color:var(--success);font-size:.78rem">✅ Shipped</span>`;
    setTimeout(closeShipModal, 800);
  } catch (err) {
    statusEl.innerHTML = `<span style="color:var(--danger)">${escHtml(err.message)}</span>`;
    btn.disabled = false; btn.innerHTML = "<i class='fas fa-truck'></i> Mark Shipped";
  }
}

// ── Analytics ──────────────────────────────────────────────
let _analyticsLoaded = false;
let _revenueChart = null;
async function loadAnalyticsPage(force = false) {
  if (_analyticsLoaded && !force) return;
  const loadingEl = document.getElementById("analytics-loading");
  const errEl     = document.getElementById("analytics-error");
  const statsEl   = document.getElementById("analytics-stats");
  const chartCard = document.getElementById("revenue-chart-card");
  const gridEl    = document.getElementById("analytics-grid");
  loadingEl.style.display = "flex";
  statsEl.style.display = chartCard.style.display = gridEl.style.display = errEl.style.display = "none";
  try {
    const isLocal = ["localhost","127.0.0.1"].includes(location.hostname) || location.hostname.includes("github.io");
    const API = isLocal ? "https://shop-sandy-theta.vercel.app/api/orders?type=orders" : "/api/orders?type=orders";
    const res  = await fetch(API);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API error");

    const orders = data.orders || [];
    const stats  = data.stats  || {};

    // — Stats row
    statsEl.innerHTML = `
      <div class="stat-card"><i class="fas fa-sterling-sign"></i><div><span>£${stats.revenue||"0.00"}</span><small>Total Revenue</small></div></div>
      <div class="stat-card"><i class="fas fa-receipt"></i><div><span>${stats.total||0}</span><small>Orders</small></div></div>
      <div class="stat-card"><i class="fas fa-bag-shopping"></i><div><span>${stats.items_sold||0}</span><small>Items Sold</small></div></div>
      <div class="stat-card"><i class="fas fa-users"></i><div><span>${new Set(orders.map(o=>o.customer.email||o.customer.name).filter(Boolean)).size}</span><small>Customers</small></div></div>`;
    statsEl.style.display = "grid";

    // — Revenue chart (last 30 days)
    const today = new Date(); today.setHours(0,0,0,0);
    const dayMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      dayMap[d.toISOString().slice(0,10)] = 0;
    }
    orders.forEach(o => {
      const day = o.created_at?.slice(0,10);
      if (day && dayMap[day] !== undefined) dayMap[day] += parseFloat(o.total||0);
    });
    const labels = Object.keys(dayMap).map(d => {
      const [,m,dd] = d.split("-"); return `${dd}/${m}`;
    });
    const values = Object.values(dayMap);
    if (_revenueChart) _revenueChart.destroy();
    const ctx = document.getElementById("revenue-chart")?.getContext("2d");
    if (ctx) {
      _revenueChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{ label: "Revenue (£)", data: values,
            backgroundColor: "rgba(233,30,140,0.25)",
            borderColor: "rgba(233,30,140,0.8)",
            borderWidth: 2, borderRadius: 4
          }]
        },
        options: { responsive:true, maintainAspectRatio:false,
          plugins: { legend: { display:false } },
          scales: { x: { ticks:{font:{size:10}} }, y: { beginAtZero:true, ticks:{callback:v=>`£${v}`} } }
        }
      });
    }
    chartCard.style.display = "block";

    // — Best sellers
    const itemCounts = {};
    orders.forEach(o => o.items.forEach(i => {
      itemCounts[i.name] = (itemCounts[i.name]||0) + parseInt(i.qty||1);
    }));
    const topItems = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
    document.getElementById("best-sellers-list").innerHTML = topItems.length
      ? topItems.map(([name,qty],i) => `
          <div class="cat-row">
            <span><strong>${i+1}.</strong> ${escHtml(name)}</span>
            <span><strong>${qty}</strong> sold</span>
          </div>`).join("")
      : `<p style="color:var(--gray);font-size:.85rem">No sales data yet.</p>`;

    // — Customer list
    const customers = {};
    orders.forEach(o => {
      const key = o.customer.email || o.customer.name || "Unknown";
      if (!customers[key]) customers[key] = { name: o.customer.name, email: o.customer.email, orders: 0, spent: 0, last: o.created_at };
      customers[key].orders++;
      customers[key].spent += parseFloat(o.total||0);
      if (o.created_at > customers[key].last) customers[key].last = o.created_at;
    });
    const custList = Object.values(customers).sort((a,b) => b.spent - a.spent).slice(0,15);
    document.getElementById("customer-list").innerHTML = custList.length
      ? custList.map(c => `
          <div class="cat-row">
            <div><strong>${escHtml(c.name)}</strong>${c.email?`<br><small>${escHtml(c.email)}</small>`:""}</div>
            <div style="text-align:right"><strong>£${c.spent.toFixed(2)}</strong><br><small>${c.orders} order${c.orders>1?"s":""}</small></div>
          </div>`).join("")
      : `<p style="color:var(--gray);font-size:.85rem">No customers yet.</p>`;

    gridEl.style.display = "grid";
    _analyticsLoaded = true;
  } catch (err) {
    errEl.innerHTML = `<div class="sync-note" style="border-color:var(--danger)"><i class="fas fa-circle-xmark" style="color:var(--danger)"></i><span>${escHtml(err.message)}</span></div>`;
    errEl.style.display = "block";
  } finally {
    loadingEl.style.display = "none";
  }
}

// ── Discounts ─────────────────────────────────────────────
let _discountsLoaded = false;
function toggleDiscountFields() {
  const t = document.getElementById("disc-type").value;
  document.getElementById("disc-pct-wrap").style.display = t === "FIXED_PERCENTAGE" ? "flex" : "none";
  document.getElementById("disc-amt-wrap").style.display = t === "FIXED_AMOUNT"     ? "flex" : "none";
}
async function loadDiscountsPage(force = false) {
  if (_discountsLoaded && !force) return;
  const loadEl  = document.getElementById("discounts-loading");
  const listEl  = document.getElementById("discounts-list-wrap");
  loadEl.style.display = "flex"; listEl.style.display = "none";
  try {
    const isLocal = ["localhost","127.0.0.1"].includes(location.hostname) || location.hostname.includes("github.io");
    const API = isLocal ? "https://shop-sandy-theta.vercel.app/api/discounts" : "/api/discounts";
    const res  = await fetch(API);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const list = data.discounts || [];
    document.getElementById("discounts-table").innerHTML = list.length
      ? `<table class="orders-tbl"><thead><tr><th>Name</th><th>Type</th><th>Value</th><th></th></tr></thead><tbody>
          ${list.map(d => `<tr>
            <td><strong>${escHtml(d.name)}</strong></td>
            <td><small>${d.type === "FIXED_PERCENTAGE" ? "% Off" : "£ Off"}</small></td>
            <td><strong>${d.percentage ? d.percentage+"%" : d.amount ? "£"+d.amount : "—"}</strong></td>
            <td><button class="order-cancel-btn" onclick="deleteDiscount('${d.id}',this)">✕ Delete</button></td>
          </tr>`).join("")}
        </tbody></table>`
      : `<p style="color:var(--gray);font-size:.88rem">No discounts yet. Create one above.</p>`;
    listEl.style.display = "block";
    _discountsLoaded = true;
  } catch (err) {
    document.getElementById("discounts-table").innerHTML = `<p style="color:var(--danger)">${escHtml(err.message)}</p>`;
    listEl.style.display = "block";
  } finally { loadEl.style.display = "none"; }
}
async function createDiscount() {
  const name = document.getElementById("disc-name").value.trim();
  const type = document.getElementById("disc-type").value;
  const pct  = document.getElementById("disc-pct").value;
  const amt  = document.getElementById("disc-amt").value;
  const st   = document.getElementById("disc-status");
  if (!name) { st.innerHTML = `<span style="color:var(--danger)">Name is required.</span>`; return; }
  try {
    const isLocal = ["localhost","127.0.0.1"].includes(location.hostname) || location.hostname.includes("github.io");
    const API = isLocal ? "https://shop-sandy-theta.vercel.app/api/discounts" : "/api/discounts";
    const res  = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ name, type, percentage: pct||undefined, amount: amt||undefined }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    st.innerHTML = `<span style="color:var(--success)">✅ Discount created!</span>`;
    document.getElementById("disc-name").value = "";
    loadDiscountsPage(true);
  } catch (err) { st.innerHTML = `<span style="color:var(--danger)">${escHtml(err.message)}</span>`; }
}
async function deleteDiscount(id, btn) {
  if (!confirm("Delete this discount from Square?")) return;
  btn.disabled = true; btn.textContent = "Deleting...";
  try {
    const isLocal = ["localhost","127.0.0.1"].includes(location.hostname) || location.hostname.includes("github.io");
    const API = isLocal ? `https://shop-sandy-theta.vercel.app/api/discounts?id=${id}` : `/api/discounts?id=${id}`;
    const res  = await fetch(API, { method:"DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    btn.closest("tr").remove();
  } catch (err) { alert("Could not delete: " + err.message); btn.disabled=false; btn.textContent="✕ Delete"; }
}

// ── Shop Settings ──────────────────────────────────────────
const BANNER_GRADIENTS = {
  pink:  "linear-gradient(90deg,#fce4ec,#f8bbd0)",
  rose:  "linear-gradient(90deg,#f48fb1,#ec407a)",
  gold:  "linear-gradient(90deg,#fff8e1,#ffe082)",
  green: "linear-gradient(90deg,#e8f5e9,#a5d6a7)",
  blue:  "linear-gradient(90deg,#e3f2fd,#90caf9)"
};
const BANNER_TEXT_COLORS = { pink:"#880e4f", rose:"#fff", gold:"#5d4037", green:"#1b5e20", blue:"#0d47a1" };

function updateBannerPreview() {
  const text    = (document.getElementById("banner-text").value || "").trim();
  const color   = document.getElementById("banner-color").value || "pink";
  const enabled = document.getElementById("banner-enabled").checked;
  const previewEl = document.getElementById("banner-preview");
  const innerEl   = document.getElementById("banner-preview-inner");
  const textEl    = document.getElementById("banner-preview-text");
  innerEl.style.background = BANNER_GRADIENTS[color] || BANNER_GRADIENTS.pink;
  innerEl.style.color      = BANNER_TEXT_COLORS[color] || BANNER_TEXT_COLORS.pink;
  textEl.textContent        = text || "Your banner will appear here";
  previewEl.style.display   = (enabled || text) ? "block" : "none";
}

function selectBannerColor(btn) {
  document.getElementById("banner-color").value = btn.dataset.color;
  document.querySelectorAll(".banner-swatch").forEach(b => { b.style.outline = "none"; b.style.outlineOffset = "0"; });
  btn.style.outline = "2.5px solid var(--primary)";
  btn.style.outlineOffset = "2px";
  updateBannerPreview();
}

async function generateBannerAI() {
  const btn   = document.getElementById("banner-ai-btn");
  const sugEl = document.getElementById("banner-ai-suggestions");
  btn.disabled = true;
  btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Generating...";
  sugEl.style.display = "none"; sugEl.innerHTML = "";
  try {
    const text = await callGPT(
      "Generate exactly 3 short announcement banner texts for VeronikaK, a UK handmade jewellery shop. " +
      "Each must be under 12 words, include a relevant emoji, and be exciting, professional and punchy. " +
      "Topics can include: promotions, free shipping, new arrivals, limited stock, seasonal events. " +
      "Return ONLY the 3 banners, one per line, no numbering, no extra text."
    );
    const lines = text.split("\n").map(l => l.replace(/^\d+[\.\)\-]\s*/,"").trim()).filter(Boolean).slice(0,3);
    if (!lines.length) throw new Error("No suggestions returned");
    sugEl.innerHTML = lines.map(l =>
      `<button class="banner-suggestion" onclick="useBannerSuggestion(this)" data-text="${escHtml(l)}">${escHtml(l)}</button>`
    ).join("");
    sugEl.style.display = "flex";
  } catch(e) {
    sugEl.innerHTML = `<span style="color:var(--danger);font-size:.82rem">${escHtml(e.message)}</span>`;
    sugEl.style.display = "flex";
  }
  btn.disabled = false; btn.innerHTML = "<i class='fas fa-wand-magic-sparkles'></i> AI Generate";
}

function useBannerSuggestion(btn) {
  document.getElementById("banner-text").value = btn.dataset.text;
  updateBannerPreview();
  document.querySelectorAll(".banner-suggestion").forEach(b => b.style.background = "");
  btn.style.background = "var(--primary)"; btn.style.color = "#fff";
}

function loadShopSettings() {
  const banner = JSON.parse(localStorage.getItem("vk_banner") || "{}");
  document.getElementById("banner-enabled").checked = !!banner.enabled;
  document.getElementById("banner-text").value   = banner.text  || "";
  const color = banner.color || "pink";
  document.getElementById("banner-color").value  = color;
  // highlight the matching swatch
  document.querySelectorAll(".banner-swatch").forEach(b => {
    const active = b.dataset.color === color;
    b.style.outline      = active ? "2.5px solid var(--primary)" : "none";
    b.style.outlineOffset = active ? "2px" : "0";
  });
  updateBannerPreview();
  // Scheduled dates
  const startEl = document.getElementById("banner-start-date");
  const endEl   = document.getElementById("banner-end-date");
  if (startEl && banner.startDate) startEl.value = banner.startDate.slice(0,16);
  if (endEl   && banner.endDate)   endEl.value   = banner.endDate.slice(0,16);
  const notif = JSON.parse(localStorage.getItem("vk_notif") || "{}");
  document.getElementById("notif-enabled").checked = !!notif.enabled;
  document.getElementById("notif-email").value = notif.email || "";
  const threshold = localStorage.getItem("vk_low_stock") || "3";
  document.getElementById("low-stock-threshold").value = threshold;
  // Push notif button state
  const pushBtn = document.getElementById("push-notif-btn");
  const pushSt  = document.getElementById("push-notif-status");
  if (pushBtn) {
    if (localStorage.getItem("vk_push_notif") === "1" && Notification?.permission === "granted") {
      pushBtn.innerHTML = `<i class="fas fa-bell-slash"></i> Disable Notifications`;
      pushBtn.onclick = disablePushNotifications;
    } else {
      pushBtn.onclick = enablePushNotifications;
    }
  }
  // Instagram posts
  loadInstagramPosts();
}
function saveBanner() {
  const banner = {
    enabled: document.getElementById("banner-enabled").checked,
    text:    document.getElementById("banner-text").value.trim(),
    color:   document.getElementById("banner-color").value
  };
  localStorage.setItem("vk_banner", JSON.stringify(banner));
  document.getElementById("banner-status").innerHTML = `<span style="color:var(--success)">✅ Banner saved! Open the shop tab and refresh to see it.</span>`;
}
function saveNotifSettings() {
  const notif = {
    enabled: document.getElementById("notif-enabled").checked,
    email:   document.getElementById("notif-email").value.trim()
  };
  localStorage.setItem("vk_notif", JSON.stringify(notif));
  document.getElementById("notif-status").innerHTML = `<span style="color:var(--success)">✅ Notification settings saved.</span>`;
}
function saveStockThreshold() {
  const val = document.getElementById("low-stock-threshold").value;
  localStorage.setItem("vk_low_stock", val || "3");
  document.getElementById("threshold-status").innerHTML = `<span style="color:var(--success)">✅ Threshold saved.</span>`;
}

// ── Cancel Order ──────────────────────────────────────────────
async function cancelOrder(orderId, version, btn) {
  if (!confirm("Cancel this order on Square? This cannot be undone.")) return;
  btn.disabled = true;
  btn.textContent = "Cancelling...";
  try {
    const isLocal = ["localhost","127.0.0.1"].includes(location.hostname) || location.hostname.includes("github.io");
    const API = isLocal ? "https://shop-sandy-theta.vercel.app/api/cancel-order" : "/api/cancel-order";
    const res  = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, version })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    // Update row in place
    const badge = document.getElementById("order-badge-" + orderId);
    if (badge) { badge.className = "order-badge order-canceled"; badge.textContent = "CANCELED"; }
    btn.remove();
  } catch (err) {
    alert("Could not cancel order: " + err.message);
    btn.disabled = false;
    btn.textContent = "✕ Cancel";
  }
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
  // Clear SEO + upload thumb
  const seoTitleEl = document.getElementById("edit-seo-title");
  const seoDescEl  = document.getElementById("edit-seo-desc");
  const thumbEl    = document.getElementById("img-upload-thumb");
  const stEl       = document.getElementById("img-upload-status");
  if (seoTitleEl) seoTitleEl.value = "";
  if (seoDescEl)  seoDescEl.value  = "";
  if (thumbEl)    { thumbEl.src = ""; thumbEl.style.display = "none"; }
  if (stEl)       stEl.innerHTML = "";
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
  // Clear upload preview
  const thumbEl = document.getElementById("img-upload-thumb");
  const stEl    = document.getElementById("img-upload-status");
  if (thumbEl) { thumbEl.src = p.imageUrl || ""; thumbEl.style.display = p.imageUrl ? "block" : "none"; }
  if (stEl)    stEl.innerHTML = "";
  // SEO fields
  loadSeoFields(p.id);
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
  saveSeoFields(productObj.id);
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
  const rEl = document.getElementById("settings-runway");
  const sEl = document.getElementById("settings-square");
  const oSt = document.getElementById("openai-key-status");
  const rSt = document.getElementById("runway-key-status");
  const sSt = document.getElementById("square-key-status");
  const cmd = document.getElementById("cmd-with-tokens");
  if (oEl && savedApiKey)    { oEl.value = savedApiKey;    oSt.textContent = "✅ OpenAI key saved";  oSt.style.color = "var(--success)"; }
  if (rEl && savedRunwayKey) { rEl.value = savedRunwayKey; rSt.textContent = "✅ Runway key saved";  rSt.style.color = "var(--success)"; }
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
  // GA4
  const ga4Val = localStorage.getItem("vk_ga4_id") || "";
  const ga4El  = document.getElementById("settings-ga4");
  const ga4St  = document.getElementById("ga4-status");
  if (ga4El) ga4El.value = ga4Val;
  if (ga4St && ga4Val) { ga4St.textContent = `✅ GA4 active (${ga4Val})`; ga4St.style.color = "var(--success)"; }
  // Meta Pixel
  const fbVal = localStorage.getItem("vk_fb_pixel") || "";
  const fbEl  = document.getElementById("settings-fbpixel");
  const fbSt  = document.getElementById("fbpixel-status");
  if (fbEl) fbEl.value = fbVal;
  if (fbSt && fbVal) { fbSt.textContent = `✅ Meta Pixel active (${fbVal})`; fbSt.style.color = "var(--success)"; }
  // Cloudinary
  const clVal  = localStorage.getItem("vk_cloudinary_cloud")  || "";
  const clPVal = localStorage.getItem("vk_cloudinary_preset") || "";
  const clEl   = document.getElementById("settings-cloudinary");
  const clPEl  = document.getElementById("settings-cloudinary-preset");
  const clSt   = document.getElementById("cloudinary-status");
  if (clEl)  clEl.value  = clVal;
  if (clPEl) clPEl.value = clPVal;
  if (clSt && clVal) { clSt.textContent = `✅ Cloudinary configured (${clVal})`; clSt.style.color = "var(--success)"; }
  // Push Notifications
  const pushBtn = document.getElementById("push-notif-btn");
  if (pushBtn && localStorage.getItem("vk_push_notif") === "1" && Notification?.permission === "granted") {
    pushBtn.innerHTML = `<i class="fas fa-bell-slash"></i> Disable Notifications`;
    pushBtn.onclick = disablePushNotifications;
    if (localStorage.getItem("vk_push_notif") === "1") startPushPolling();
  }
}

function saveSettingsKeys() {
  const oVal  = document.getElementById("settings-openai").value.trim();
  const rVal  = document.getElementById("settings-runway")?.value.trim() || "";
  const sVal  = document.getElementById("settings-square").value.trim();
  const ga4Val = (document.getElementById("settings-ga4")?.value || "").trim();
  const fbVal  = (document.getElementById("settings-fbpixel")?.value || "").trim();
  const clVal  = (document.getElementById("settings-cloudinary")?.value || "").trim();
  const clPVal = (document.getElementById("settings-cloudinary-preset")?.value || "").trim();
  const oSt  = document.getElementById("openai-key-status");
  const rSt  = document.getElementById("runway-key-status");
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
  if (rVal) {
    savedRunwayKey = rVal;
    localStorage.setItem("vk_runway_key", rVal);
    if (rSt) { rSt.textContent = "✅ Saved!"; rSt.style.color = "var(--success)"; }
    saved++;
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
  if (ga4Val)  { localStorage.setItem("vk_ga4_id",  ga4Val);  saved++; }
  if (fbVal)   { localStorage.setItem("vk_fb_pixel", fbVal);   saved++; }
  if (clVal)   { localStorage.setItem("vk_cloudinary_cloud",  clVal);  saved++; }
  if (clPVal)  { localStorage.setItem("vk_cloudinary_preset", clPVal); }
  if (saved) { loadSettingsPage(); showToast(`✅ ${saved} setting${saved>1?"s":""} saved!`); }
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

// ── AI Creative Studio ─────────────────────────────────────────

function proxyBase() {
  const isLocal = ["localhost","127.0.0.1"].includes(location.hostname) || location.hostname.includes("github.io");
  return isLocal ? "https://shop-sandy-theta.vercel.app/api" : "/api";
}

function loadCreativeStudio() {
  // Key is server-side (RUNWAY_API_KEY env var) — nothing to check client-side
  const warn = document.getElementById("creative-no-key");
  if (warn) warn.style.display = "none";
}

function switchCreativeTab(tab) {
  document.getElementById("creative-images").style.display = tab === "images" ? "block" : "none";
  document.getElementById("creative-videos").style.display = tab === "videos" ? "block" : "none";
  document.getElementById("tab-images").classList.toggle("active", tab === "images");
  document.getElementById("tab-videos").classList.toggle("active", tab === "videos");
}

function useImgTemplate(btn) {
  document.getElementById("img-prompt").value = btn.dataset.prompt;
  document.querySelectorAll("#creative-images .cs-tpl").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}
function useVidTemplate(btn) {
  document.getElementById("vid-prompt").value = btn.dataset.prompt;
  document.querySelectorAll("#creative-videos .cs-tpl").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

async function enhanceImgPrompt() {
  const ta  = document.getElementById("img-prompt");
  const btn = document.getElementById("img-enhance-btn");
  const cur = ta.value.trim();
  if (!cur) { ta.placeholder = "Type a basic prompt first, then click Enhance."; return; }
  btn.disabled = true; btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Enhancing...";
  const enhanced = await callGPT(
    `Enhance this image generation prompt for a UK handmade jewellery brand called VeronikaK. ` +
    `Make it more detailed, cinematic, and professional for Runway Gen-4 AI. Keep it under 60 words. ` +
    `Original prompt: "${cur}". Return ONLY the enhanced prompt, no explanation.`
  );
  if (enhanced) ta.value = enhanced;
  btn.disabled = false; btn.innerHTML = "<i class='fas fa-wand-magic-sparkles'></i> AI Enhance Prompt";
}

async function enhanceVidPrompt() {
  const ta  = document.getElementById("vid-prompt");
  const btn = document.getElementById("vid-enhance-btn");
  const cur = ta.value.trim();
  if (!cur) { ta.placeholder = "Type a basic prompt first, then click Enhance."; return; }
  btn.disabled = true; btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Enhancing...";
  const enhanced = await callGPT(
    `Enhance this video generation prompt for a UK handmade jewellery brand called VeronikaK, for Runway Gen-4 Turbo AI. ` +
    `Add cinematic camera movement, lighting description, and mood. Keep it under 70 words. ` +
    `Original prompt: "${cur}". Return ONLY the enhanced prompt, no explanation.`
  );
  if (enhanced) ta.value = enhanced;
  btn.disabled = false; btn.innerHTML = "<i class='fas fa-wand-magic-sparkles'></i> AI Enhance Prompt";
}

async function generateImage() {
  const prompt = document.getElementById("img-prompt").value.trim();
  if (!prompt)   { document.getElementById("img-status").innerHTML = `<span style="color:var(--danger)">Please enter a prompt.</span>`; return; }
  const ratio   = document.getElementById("img-ratio").value;
  const btn     = document.getElementById("img-gen-btn");
  const statusEl = document.getElementById("img-status");
  const resultEl = document.getElementById("img-result");
  const phEl     = document.getElementById("img-placeholder");

  btn.disabled = true; btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Generating...";
  statusEl.innerHTML = `<span style="color:var(--gray)"><i class="fas fa-spinner fa-spin"></i> Sending to Runway… (~15 seconds)</span>`;
  resultEl.style.display = "none"; phEl.style.display = "flex";

  try {
    const res  = await fetch(`${proxyBase()}/creative-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ratio })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Generation failed");

    const url = data.imageUrl;
    document.getElementById("img-output").src     = url;
    document.getElementById("img-download").href  = url;
    phEl.style.display = "none"; resultEl.style.display = "block";
    statusEl.innerHTML = `<span style="color:var(--success)">✅ Image ready! Right-click or use Download.</span>`;
    // Store for banner use
    window._lastGeneratedImageUrl = url;
  } catch(err) {
    statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${escHtml(err.message)}</span>`;
  }
  btn.disabled = false; btn.innerHTML = "<i class='fas fa-sparkles'></i> Generate Image";
}

function copyImgUrl() {
  const url = document.getElementById("img-output").src;
  if (url) { navigator.clipboard.writeText(url); showToast("Image URL copied!"); }
}

function useAsShopBanner() {
  const url = window._lastGeneratedImageUrl || document.getElementById("img-output")?.src;
  if (!url) return;
  const banner = JSON.parse(localStorage.getItem("vk_banner") || "{}");
  banner.bgImage = url;
  localStorage.setItem("vk_banner", JSON.stringify(banner));
  showToast("✅ Image saved as banner background! Go to Shop Settings to publish.");
}

let _vidPollInterval = null;
async function generateVideo() {
  const prompt   = document.getElementById("vid-prompt").value.trim();
  if (!prompt)   { document.getElementById("vid-status").innerHTML = `<span style="color:var(--danger)">Please enter a prompt.</span>`; return; }
  const ratio    = document.getElementById("vid-ratio").value;
  const duration = document.getElementById("vid-duration").value;
  const btn      = document.getElementById("vid-gen-btn");
  const statusEl = document.getElementById("vid-status");
  const progWrap = document.getElementById("vid-progress-wrap");
  const progBar  = document.getElementById("vid-progress-bar");
  const progLbl  = document.getElementById("vid-progress-label");
  const resultEl = document.getElementById("vid-result");
  const phEl     = document.getElementById("vid-placeholder");

  if (_vidPollInterval) clearInterval(_vidPollInterval);
  btn.disabled = true; btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Starting...";
  statusEl.innerHTML = `<span style="color:var(--gray)"><i class="fas fa-spinner fa-spin"></i> Submitting to Runway…</span>`;
  progWrap.style.display = "block"; progBar.style.width = "5%"; progLbl.textContent = "Queued…";
  resultEl.style.display = "none"; phEl.style.display = "flex";

  try {
    const res  = await fetch(`${proxyBase()}/creative-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ratio, duration })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start video");

    const taskId = data.taskId;
    statusEl.innerHTML = `<span style="color:var(--gray)">Generating… this takes 1–3 minutes.</span>`;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Generating...";

    let fakePct = 5;
    _vidPollInterval = setInterval(async () => {
      try {
        const pr = await fetch(`${proxyBase()}/creative-task?taskId=${taskId}`);
        const pd = await pr.json();

        if (pd.progress) {
          fakePct = Math.round(pd.progress * 100);
        } else {
          fakePct = Math.min(fakePct + 3, 90);
        }
        progBar.style.width = fakePct + "%";
        progLbl.textContent = pd.status === "RUNNING" ? `Processing… ${fakePct}%` : pd.status;

        if (pd.status === "SUCCEEDED") {
          clearInterval(_vidPollInterval);
          const videoUrl = pd.output?.[0];
          progBar.style.width = "100%"; progLbl.textContent = "Done!";
          document.getElementById("vid-output").src    = videoUrl;
          document.getElementById("vid-download").href = videoUrl;
          phEl.style.display = "none"; resultEl.style.display = "block";
          statusEl.innerHTML = `<span style="color:var(--success)">✅ Video ready! Download to share on Instagram or WhatsApp.</span>`;
          btn.disabled = false; btn.innerHTML = "<i class='fas fa-circle-play'></i> Generate Video";
        } else if (pd.status === "FAILED") {
          clearInterval(_vidPollInterval);
          throw new Error(pd.failure || "Video generation failed");
        }
      } catch(pollErr) {
        if (pollErr.message.includes("failed") || pollErr.message.includes("Failed")) {
          clearInterval(_vidPollInterval);
          statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${escHtml(pollErr.message)}</span>`;
          progWrap.style.display = "none";
          btn.disabled = false; btn.innerHTML = "<i class='fas fa-circle-play'></i> Generate Video";
        }
      }
    }, 4000);

  } catch(err) {
    statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${escHtml(err.message)}</span>`;
    progWrap.style.display = "none";
    btn.disabled = false; btn.innerHTML = "<i class='fas fa-circle-play'></i> Generate Video";
  }
}

function copyVidUrl() {
  const url = document.getElementById("vid-output")?.src;
  if (url) { navigator.clipboard.writeText(url); showToast("Video URL copied!"); }
}

// ══════════════════════════════════════════════════════
//  CSV EXPORT
// ══════════════════════════════════════════════════════
let _ordersData = [];

function exportOrdersCSV() {
  if (!_ordersData.length) {
    showToast("No orders loaded. Open the Orders page first.", "var(--danger)");
    return;
  }
  const rows = [["Date","Customer","Email","Address","Items","Total","Status","Tracking"]];
  _ordersData.forEach(o => {
    rows.push([
      new Date(o.created_at).toLocaleDateString("en-GB"),
      o.customer.name || "",
      o.customer.email || "",
      o.address || "",
      (o.items||[]).map(i => `${i.qty}x ${i.name}`).join("; "),
      "£" + (o.total || ""),
      o.state || "",
      o.tracking?.number ? `${o.tracking.carrier} ${o.tracking.number}` : ""
    ]);
  });
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `veronikak-orders-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast("📥 CSV downloaded!");
}

// ══════════════════════════════════════════════════════
//  PRODUCT IMAGE UPLOAD (Cloudinary)
// ══════════════════════════════════════════════════════
function selectProductImage() {
  const cloudName = localStorage.getItem("vk_cloudinary_cloud");
  const preset    = localStorage.getItem("vk_cloudinary_preset") || "veronikak";
  if (!cloudName) {
    showToast("Add your Cloudinary cloud name in API Keys first.", "var(--danger)");
    return;
  }
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById("img-upload-status");
    const thumbEl  = document.getElementById("img-upload-thumb");
    if (statusEl) statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading…`;
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", preset);
    try {
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method:"POST", body:form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Upload failed");
      document.getElementById("edit-img").value = data.secure_url;
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--success)">✅ Uploaded!</span>`;
      if (thumbEl)  { thumbEl.src = data.secure_url; thumbEl.style.display = "block"; }
    } catch(err) {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${escHtml(err.message)}</span>`;
    }
  };
  input.click();
}

// ══════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS
// ══════════════════════════════════════════════════════
let _pushOrderIds = new Set();
let _pushInterval = null;

async function enablePushNotifications() {
  if (!("Notification" in window)) {
    document.getElementById("push-notif-status").innerHTML = `<span style="color:var(--danger)">Browser does not support notifications.</span>`;
    return;
  }
  const perm = await Notification.requestPermission();
  const btn  = document.getElementById("push-notif-btn");
  const st   = document.getElementById("push-notif-status");
  if (perm === "granted") {
    localStorage.setItem("vk_push_notif", "1");
    if (st)  st.innerHTML  = `<span style="color:var(--success)">✅ Enabled! You'll be notified of new orders while this tab is open.</span>`;
    if (btn) { btn.innerHTML = `<i class="fas fa-bell-slash"></i> Disable Notifications`; btn.onclick = disablePushNotifications; }
    startPushPolling();
  } else {
    if (st) st.innerHTML = `<span style="color:var(--danger)">Permission denied. Please allow notifications in browser settings.</span>`;
  }
}

function disablePushNotifications() {
  localStorage.removeItem("vk_push_notif");
  if (_pushInterval) { clearInterval(_pushInterval); _pushInterval = null; }
  const btn = document.getElementById("push-notif-btn");
  const st  = document.getElementById("push-notif-status");
  if (btn) { btn.innerHTML = `<i class="fas fa-bell"></i> Enable Notifications`; btn.onclick = enablePushNotifications; }
  if (st)  st.innerHTML = "";
}

function startPushPolling() {
  if (_pushInterval) return;
  _pushInterval = setInterval(checkForNewOrders, 5 * 60 * 1000);
}

async function checkForNewOrders() {
  if (Notification.permission !== "granted") return;
  try {
    const res  = await fetch(`${proxyBase()}/orders?type=all`);
    const data = await res.json();
    if (!data.orders) return;
    const existing = _pushOrderIds.size > 0;
    data.orders.forEach(o => {
      if (!_pushOrderIds.has(o.id)) {
        if (existing) {
          new Notification("🛍️ New Order — VeronikaK!", {
            body: `${o.customer.name} ordered ${o.items[0]?.name || "an item"} — £${o.total}`,
            icon: "icons/icon-192.png"
          });
        }
        _pushOrderIds.add(o.id);
      }
    });
  } catch(e) {}
}

// ══════════════════════════════════════════════════════
//  SEO PER-PRODUCT  (saved to products + vk_seo_<id>)
// ══════════════════════════════════════════════════════
function loadSeoFields(productId) {
  const seo = JSON.parse(localStorage.getItem("vk_seo_" + productId) || "{}");
  const titleEl = document.getElementById("edit-seo-title");
  const descEl  = document.getElementById("edit-seo-desc");
  if (titleEl) titleEl.value = seo.title || "";
  if (descEl)  descEl.value  = seo.desc  || "";
}

function saveSeoFields(productId) {
  const title = (document.getElementById("edit-seo-title") || {}).value?.trim() || "";
  const desc  = (document.getElementById("edit-seo-desc")  || {}).value?.trim() || "";
  if (title || desc) {
    localStorage.setItem("vk_seo_" + productId, JSON.stringify({ title, desc }));
  } else {
    localStorage.removeItem("vk_seo_" + productId);
  }
}

// ══════════════════════════════════════════════════════
//  SCHEDULED BANNER
// ══════════════════════════════════════════════════════
function saveBannerSchedule() {
  const start = document.getElementById("banner-start-date")?.value || "";
  const end   = document.getElementById("banner-end-date")?.value   || "";
  const b     = JSON.parse(localStorage.getItem("vk_banner") || "{}");
  b.startDate = start; b.endDate = end;
  localStorage.setItem("vk_banner", JSON.stringify(b));
  const st = document.getElementById("banner-schedule-status");
  if (st) st.innerHTML = `<span style="color:var(--success)">✅ Schedule saved!</span>`;
  setTimeout(() => { if (st) st.innerHTML = ""; }, 3000);
}

// ══════════════════════════════════════════════════════
//  INSTAGRAM POSTS
// ══════════════════════════════════════════════════════
function loadInstagramPosts() {
  const posts = JSON.parse(localStorage.getItem("vk_instagram_posts") || "[]");
  const list  = document.getElementById("insta-posts-list");
  if (!list) return;
  list.innerHTML = "";
  posts.forEach((p, i) => addInstaPostRow(p));
}

function addInstaPostRow(data) {
  const list = document.getElementById("insta-posts-list");
  if (!list) return;
  const div = document.createElement("div");
  div.className = "insta-post-row";
  div.innerHTML = `
    <input type="url" class="insta-url" placeholder="Instagram post URL (https://instagram.com/p/...)" value="${escHtml(data?.url||'')}"/>
    <input type="url" class="insta-img" placeholder="Thumbnail image URL (optional)" value="${escHtml(data?.img||'')}"/>
    <input type="text" class="insta-cap" placeholder="Caption (optional, max 80 chars)" maxlength="80" value="${escHtml(data?.caption||'')}"/>
    <button class="btn-danger" style="padding:8px 12px;font-size:.8rem" onclick="this.closest('.insta-post-row').remove()"><i class="fas fa-trash"></i></button>`;
  list.appendChild(div);
}

function saveInstagramPosts() {
  const rows  = document.querySelectorAll(".insta-post-row");
  const posts = [];
  rows.forEach(r => {
    const url = r.querySelector(".insta-url").value.trim();
    if (!url) return;
    posts.push({
      url,
      img:     r.querySelector(".insta-img").value.trim(),
      caption: r.querySelector(".insta-cap").value.trim()
    });
  });
  localStorage.setItem("vk_instagram_posts", JSON.stringify(posts));
  const st = document.getElementById("insta-status");
  if (st) st.innerHTML = `<span style="color:var(--success)">✅ ${posts.length} post(s) saved! Reload your shop to see the Instagram feed.</span>`;
  setTimeout(() => { if (st) st.innerHTML = ""; }, 4000);
}
