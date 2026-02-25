// ============================================================
//  BELLA BEADS - Main App Script
//  Handles: Product rendering, AI Chatbot, Order form, Popup
// ============================================================

// -------------------------------------------------------
//  CONFIG - Change these settings
// -------------------------------------------------------
const CONFIG = {
  // Your WhatsApp phone number (international format, no +, no spaces)
  // Example: "601123456789" for Malaysia, "12025550123" for US
  whatsappNumber: "447584587747",

  // Optional: Add your OpenAI API key for smarter AI responses
  // Leave empty "" to use the built-in smart auto-reply system (free, no API needed)
  openaiApiKey: "",

  // Shop name
  shopName: "VeronikaK",

  // Square online shop URL
  squareShop: "https://sinuguru.square.site",
};

// -------------------------------------------------------
//  PRODUCT KNOWLEDGE BASE (for AI chatbot)
// -------------------------------------------------------
const knowledgeBase = {
  greetings: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "halo", "hai"],
  priceQuestions: ["price", "cost", "how much", "berapa", "harga", "charge"],
  orderQuestions: ["order", "buy", "purchase", "how to", "cara", "beli"],
  colorQuestions: ["color", "colour", "kalur", "warna", "custom"],
  shippingQuestions: ["ship", "delivery", "hantar", "shipping", "postage", "pos"],
  materialQuestions: ["material", "bahan", "quality", "durable", "strong"],
  customQuestions: ["custom", "personali", "name", "nama", "special"],
  productListQuestions: ["what", "products", "collection", "bracelet", "show", "catalog"],
};

function matchesKeywords(message, keywords) {
  const lower = message.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function getProductListText() {
  return products.map((p, i) => `${i + 1}. ${p.name} — ${p.price}`).join("\n");
}

// -------------------------------------------------------
//  AI CHATBOT - Auto Reply Engine
// -------------------------------------------------------
async function getAIReply(userMessage) {
  // If OpenAI API key is set, use GPT
  if (CONFIG.openaiApiKey && CONFIG.openaiApiKey !== "") {
    return await callOpenAI(userMessage);
  }

  // Otherwise use built-in smart replies
  return getSmartReply(userMessage);
}

function getSmartReply(message) {
  const msg = message.toLowerCase();

  if (matchesKeywords(msg, knowledgeBase.greetings)) {
    return `Hi there! 👋 Welcome to ${CONFIG.shopName}! I can help you find the perfect handmade jewellery. We have beaded bracelets, braided bracelets, kids bracelets, and earrings — all just £6! 🌸`;
  }

  if (matchesKeywords(msg, knowledgeBase.productListQuestions)) {
    return `Here's what we have, all just £6 each:\n\n💟 Beaded Bracelets — various colours & bead sizes\n🌿 Braided Bracelets — handwoven designs\n👧 Kids Bracelets — sized for children\n👂 Handmade Earrings — matching styles\n\nBrowse & buy directly: ${CONFIG.squareShop} ✨`;
  }

  if (matchesKeywords(msg, knowledgeBase.priceQuestions)) {
    return `Great news — everything in our shop is just £6.00! 🎉\n\nAll items are currently on sale. We accept:\n✅ Apple Pay & Google Pay\n✅ Visa & Mastercard\n✅ American Express\n✅ Clearpay (buy now, pay later)\n\nShop here: ${CONFIG.squareShop} 💝`;
  }

  if (matchesKeywords(msg, knowledgeBase.customQuestions)) {
    return `Yes! 🎨 We love making custom bracelets!\n\n✅ Custom colors available\n✅ Personalized name beads\n✅ Choose bead size & style\n✅ Custom gift wrapping\n\nJust let us know what you have in mind and we'll make it for you! Custom orders are ready in 3–5 days. 💕`;
  }

  if (matchesKeywords(msg, knowledgeBase.colorQuestions)) {
    return `We have SO many colors available! 🌈\n\nPopular choices:\n• Pastels (pink, lavender, mint, peach)\n• Bold (red, blue, black, purple)\n• Natural (earth tones, beige, terracotta)\n• Metallic (gold, silver, rose gold accents)\n\nJust tell us your favorite colors and we'll make a bracelet just for you! ✨`;
  }

  if (matchesKeywords(msg, knowledgeBase.orderQuestions)) {
    return `Ordering is easy! 🛍️\n\n1️⃣ Browse our shop: ${CONFIG.squareShop}\n2️⃣ Click any item you like\n3️⃣ Add to cart & checkout\n4️⃣ We accept Apple Pay, Google Pay, cards & Clearpay!\n5️⃣ Your order ships straight to your door 📦\n\nNeed help choosing? Just ask me! 🌸`;
  }

  if (matchesKeywords(msg, knowledgeBase.shippingQuestions)) {
    return `📦 Shipping Info:\n\n• We ship to the UK— fast & reliable
• Delivery typically 2–5 working days\n• Order securely online at:\n${CONFIG.squareShop}\n\nAny other questions? 😊`;
  }

  if (matchesKeywords(msg, knowledgeBase.materialQuestions)) {
    return `We use quality materials for every piece! 💎\n\n✔️ Round glass beads (8mm–12mm)\n✔️ Golden coloured star, cube & octahedron spacers\n✔️ Elastic stretch cord — durable & comfortable\n✔️ Handcrafted braided designs\n\nBracelet length: 7 inches (18cm) — fits most adults. Kids sizes also available! 🌸`;
  }

  // Default helpful reply
  const defaultReplies = [
    `That's a great question! 😊 We have bracelets, earrings & kids jewellery — all £6!\n\nBrowse & buy: ${CONFIG.squareShop} 🌸`,
    `I can help with:\n• Our products & prices\n• How to order\n• Shipping info\n• Payment methods\n\nOr just visit our shop: ${CONFIG.squareShop} 💝`,
    `Not sure about that one! 😅 But you can browse everything at: ${CONFIG.squareShop} \u2014 or ask me something else! 🌸`
  ];
  return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
}

async function callOpenAI(userMessage) {
  const systemPrompt = `You are a friendly and helpful customer service assistant for "${CONFIG.shopName}", a small handmade jewellery business. Shop URL: ${CONFIG.squareShop}

Products available (all \u00a36.00 each, on sale):
${getProductListText()}

Key info:
- All items are handmade with love by Veronika
- Bracelet length: 7 inches (18cm), stretch fit
- Ships to customers, 2-5 days
- Everything is \u00a36.00 — great value!
- Payment: Apple Pay, Google Pay, Visa, Mastercard, Amex, Clearpay
- To order: visit ${CONFIG.squareShop}

Be warm, friendly, enthusiastic, and helpful. Use emojis. Keep answers concise. Always direct customers to the shop URL to purchase!`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CONFIG.openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 300,
        temperature: 0.8
      })
    });

    if (!response.ok) throw new Error("API error");
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    return getSmartReply(userMessage);
  }
}

// -------------------------------------------------------
//  RENDER PRODUCTS
// -------------------------------------------------------
function renderProducts() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  grid.innerHTML = products.map(p => `
    <div class="product-card" onclick="openCheckout(${p.id})">
      <div class="product-img" style="background:${p.bg};">
        ${p.imageUrl
          ? `<img src="${p.imageUrl}" alt="${p.name}" onerror="this.remove()">`
          : p.emoji
        }
      </div>
      <div class="product-body">
        <span class="product-tag">${p.tag}</span>
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <div class="product-footer">
          <span class="product-price">${p.price}</span>
          <div class="product-btns">
            <button class="product-cart-btn" onclick="event.stopPropagation(); addToCart(${p.id})" title="Add to basket">
              🛒
            </button>
            <button class="product-order-btn" onclick="event.stopPropagation(); openCheckout(${p.id})">
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

function goToProduct(url) {
  window.open(url, "_blank");
}

// -------------------------------------------------------
//  CHECKOUT MODAL
// -------------------------------------------------------
let checkoutProduct = null;

function openCheckout(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  checkoutProduct = p;

  // Populate modal
  const imgEl = document.getElementById("checkout-img");
  imgEl.style.background = p.bg;
  imgEl.innerHTML = p.imageUrl
    ? `<img src="${p.imageUrl}" alt="${p.name}" onerror="this.style.fontSize='3rem';this.outerHTML='${p.emoji}'">`
    : `<span style="font-size:3rem">${p.emoji}</span>`;

  document.getElementById("checkout-tag").textContent = p.tag;
  document.getElementById("checkout-name").textContent = p.name;
  document.getElementById("checkout-desc").textContent = p.description;

  // Reset button state
  document.getElementById("checkout-btn-text").style.display = "";
  document.getElementById("checkout-btn-spinner").style.display = "none";
  document.getElementById("checkout-pay-btn").disabled = false;

  // Show modal
  document.getElementById("checkout-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCheckout(e) {
  if (e.target === document.getElementById("checkout-overlay")) closeCheckoutDirect();
}

function closeCheckoutDirect() {
  document.getElementById("checkout-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

// Mobile-safe navigation: window.open is blocked on iOS when called after async
// so we open in same tab on mobile, new tab on desktop
function safeOpen(url) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    location.href = url;
  } else {
    const w = window.open(url, "_blank");
    if (!w) location.href = url; // fallback if popup blocked
  }
}

async function proceedToCheckout() {
  if (!checkoutProduct) return;

  const btn = document.getElementById("checkout-pay-btn");
  document.getElementById("checkout-btn-text").style.display = "none";
  document.getElementById("checkout-btn-spinner").style.display = "";
  btn.disabled = true;

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productName: checkoutProduct.name, price: 600 })
    });
    const data = await res.json();

    if (data.url) {
      closeCheckoutDirect();
      safeOpen(data.url);
    } else {
      alert("Sorry, checkout failed. Please try again or visit sinuguru.square.site");
      btn.disabled = false;
      document.getElementById("checkout-btn-text").style.display = "";
      document.getElementById("checkout-btn-spinner").style.display = "none";
    }
  } catch (err) {
    console.error(err);
    // Fallback to Square site
    closeCheckoutDirect();
    safeOpen(checkoutProduct.url);
  }
}

// Show success toast if redirected back after payment
if (location.search.includes("order=success")) {
  const toast = document.getElementById("success-toast");
  if (toast) {
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 5000);
    history.replaceState({}, "", location.pathname);
  }
}

// -------------------------------------------------------
//  SHOPPING CART
// -------------------------------------------------------
let cart = JSON.parse(localStorage.getItem("vk_cart") || "[]");

function saveCart() {
  localStorage.setItem("vk_cart", JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById("cart-badge");
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? "" : "none";
  }

  const itemsEl = document.getElementById("cart-items");
  const emptyEl = document.getElementById("cart-empty");
  const footerEl = document.getElementById("cart-footer");
  const totalEl  = document.getElementById("cart-total-price");
  if (!itemsEl) return;

  if (cart.length === 0) {
    emptyEl.style.display = "";
    footerEl.style.display = "none";
    // Clear all item rows
    [...itemsEl.querySelectorAll(".cart-item")].forEach(el => el.remove());
    return;
  }

  emptyEl.style.display = "none";
  footerEl.style.display = "";

  // Re-render cart items
  [...itemsEl.querySelectorAll(".cart-item")].forEach(el => el.remove());
  cart.forEach(item => {
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div class="cart-item-img" style="background:${item.bg}">
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="" onerror="this.remove()">` : `<span>${item.emoji}</span>`}
      </div>
      <div class="cart-item-info">
        <p>${item.name}</p>
        <span>£6.00</span>
      </div>
      <div class="cart-item-qty">
        <button onclick="changeQty(${item.id}, -1)">−</button>
        <span>${item.qty}</span>
        <button onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})">✕</button>
    `;
    itemsEl.appendChild(div);
  });

  const grandTotal = cart.reduce((s, i) => s + i.qty * 6, 0);
  totalEl.textContent = `£${grandTotal.toFixed(2)}`;
}

function addToCart(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: p.id, name: p.name, price: 600, qty: 1,
                imageUrl: p.imageUrl, emoji: p.emoji, bg: p.bg });
  }
  saveCart();
  // Pulse the cart icon
  const btn = document.getElementById("cart-nav-btn");
  if (btn) { btn.classList.add("cart-pulse"); setTimeout(() => btn.classList.remove("cart-pulse"), 600); }
  // Brief toast
  showAddedToast(p.name);
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  saveCart();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== productId);
  saveCart();
}

function clearCart() {
  cart = [];
  saveCart();
}

function openCart() {
  document.getElementById("cart-drawer").classList.add("open");
  document.getElementById("cart-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  document.getElementById("cart-drawer").classList.remove("open");
  document.getElementById("cart-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

function closeCartOverlay(e) {
  if (e.target === document.getElementById("cart-overlay")) closeCart();
}

let addedToastTimer;
function showAddedToast(name) {
  let toast = document.getElementById("added-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "added-toast";
    toast.className = "added-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = `✅ Added to basket!`;
  toast.classList.add("show");
  clearTimeout(addedToastTimer);
  addedToastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}

async function checkoutCart() {
  if (cart.length === 0) return;
  const btn = document.getElementById("cart-checkout-btn");
  document.getElementById("cart-checkout-text").style.display = "none";
  document.getElementById("cart-checkout-spinner").style.display = "";
  btn.disabled = true;

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map(i => ({ name: i.name, price: i.price, qty: i.qty })) })
    });
    const data = await res.json();
    if (data.url) {
      closeCart();
      clearCart();
      safeOpen(data.url);
    } else {
      alert("Checkout failed. Please try again.");
    }
  } catch(err) {
    console.error(err);
    alert("Checkout failed. Please try again.");
  } finally {
    btn.disabled = false;
    document.getElementById("cart-checkout-text").style.display = "";
    document.getElementById("cart-checkout-spinner").style.display = "none";
  }
}

// Init cart UI on load
updateCartUI();

// -------------------------------------------------------
//  CHATBOT UI
// -------------------------------------------------------
const chatToggle = document.getElementById("chatbot-toggle");
const chatWindow = document.getElementById("chatbot-window");
const chatClose = document.getElementById("chatbot-close");
const chatMessages = document.getElementById("chatbot-messages");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send");

chatToggle.addEventListener("click", () => {
  chatWindow.classList.toggle("open");
  if (chatWindow.classList.contains("open")) {
    chatInput.focus();
  }
});

chatClose.addEventListener("click", () => {
  chatWindow.classList.remove("open");
});

chatSendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendQuick(text) {
  chatInput.value = text;
  sendMessage();
  document.getElementById("quick-btns").style.display = "none";
}

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `chat-msg ${sender}`;
  msg.innerHTML = `<span>${text.replace(/\n/g, "<br/>")}</span>`;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

function showTyping() {
  const typing = document.createElement("div");
  typing.className = "chat-msg bot chat-typing";
  typing.id = "typing-indicator";
  typing.innerHTML = `<span>Bella is typing... ✨</span>`;
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById("typing-indicator");
  if (t) t.remove();
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  chatInput.value = "";

  showTyping();
  chatSendBtn.disabled = true;

  // Simulate natural typing delay
  const delay = 800 + Math.random() * 800;
  await new Promise(r => setTimeout(r, delay));

  const reply = await getAIReply(text);
  removeTyping();
  addMessage(reply, "bot");
  chatSendBtn.disabled = false;
  chatInput.focus();
}

// -------------------------------------------------------
//  ORDER FORM
// -------------------------------------------------------
const orderForm = document.getElementById("order-form");
if (orderForm) {
  orderForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = orderForm.querySelector("input[type=text]").value;
    const phone = orderForm.querySelector("input[type=tel]").value;
    const product = orderForm.querySelectorAll("input[type=text]")[1]?.value || "";
    const notes = orderForm.querySelectorAll("input[type=text]")[2]?.value || "";

    // Send via WhatsApp if number is set, otherwise direct to shop
    if (CONFIG.whatsappNumber && CONFIG.whatsappNumber !== "YOUR_PHONE_NUMBER") {
      const message = encodeURIComponent(
        `🌸 New Enquiry from VeronikaK website!\n\nName: ${name}\nPhone: ${phone}\nInterested in: ${product || "Not specified"}\nMessage: ${notes || "None"}`
      );
      window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${message}`, "_blank");
    } else {
      window.open(CONFIG.squareShop, "_blank");
    }

    // Show popup
    document.getElementById("popup-overlay").classList.add("show");
    orderForm.reset();
  });
}

function closePopup() {
  document.getElementById("popup-overlay").classList.remove("show");
}

// Close popup on overlay click
document.getElementById("popup-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("popup-overlay")) closePopup();
});

// -------------------------------------------------------
//  NAVBAR active link highlight on scroll
// -------------------------------------------------------
window.addEventListener("scroll", () => {
  const sections = document.querySelectorAll("section[id]");
  const links = document.querySelectorAll(".nav-links a");
  let current = "";
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 100) current = s.getAttribute("id");
  });
  links.forEach(link => {
    link.style.color = link.getAttribute("href") === `#${current}` ? "var(--pink)" : "";
  });
});

// -------------------------------------------------------
//  INIT
// -------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderProducts();
  // Update all WhatsApp links with the configured number
  document.querySelectorAll(`a[href*="YOUR_PHONE_NUMBER"]`).forEach(el => {
    el.href = el.href.replace("YOUR_PHONE_NUMBER", CONFIG.whatsappNumber);
  });
});
