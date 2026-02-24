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
    <div class="product-card" onclick="goToProduct('${p.url}')">
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
          <button class="product-order-btn" onclick="event.stopPropagation(); goToProduct('${p.url}')">
            Buy Now
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function goToProduct(url) {
  window.open(url, "_blank");
}

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
