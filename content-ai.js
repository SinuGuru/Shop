// ============================================================
//  BELLA BEADS – AI CONTENT MANAGER ENGINE
//  Works standalone (built-in templates) OR with OpenAI API
// ============================================================

let savedApiKey = localStorage.getItem("bella_openai_key") || "";
let savedContent = JSON.parse(localStorage.getItem("bella_saved_content") || "[]");

// -------------------------------------------------------
//  API KEY
// -------------------------------------------------------
function saveApiKey() {
  const val = document.getElementById("api-key-input").value.trim();
  if (!val || !val.startsWith("sk-")) {
    document.getElementById("api-status").textContent = "❌ Invalid key format";
    document.getElementById("api-status").style.color = "#dc2626";
    return;
  }
  savedApiKey = val;
  localStorage.setItem("bella_openai_key", val);
  document.getElementById("api-status").textContent = "✅ Key saved! AI mode active.";
  document.getElementById("api-status").style.color = "#25d366";
}

// Load saved key on page load
if (savedApiKey) {
  document.getElementById("api-key-input").value = savedApiKey;
  document.getElementById("api-status").textContent = "✅ API key loaded.";
  document.getElementById("api-status").style.color = "#25d366";
}

// -------------------------------------------------------
//  TAB SWITCHING
// -------------------------------------------------------
function switchTab(tab, btn) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("tab-" + tab).classList.add("active");
}

// -------------------------------------------------------
//  COPY TO CLIPBOARD
// -------------------------------------------------------
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    btn.style.background = "var(--pink)";
    btn.style.color = "white";
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ""; btn.style.color = ""; }, 2000);
  });
}

// -------------------------------------------------------
//  SAVE CONTENT
// -------------------------------------------------------
function saveToLibrary(type, text) {
  savedContent.unshift({ type, text, date: new Date().toLocaleDateString() });
  if (savedContent.length > 30) savedContent = savedContent.slice(0, 30);
  localStorage.setItem("bella_saved_content", JSON.stringify(savedContent));
  renderSaved();
  document.getElementById("saved-section").style.display = "block";
}

function renderSaved() {
  const grid = document.getElementById("saved-grid");
  const section = document.getElementById("saved-section");
  if (!savedContent.length) { section.style.display = "none"; return; }
  section.style.display = "block";
  grid.innerHTML = savedContent.map((item, i) => `
    <div class="saved-item">
      <div class="saved-item-type">${item.type} · ${item.date}</div>
      <pre>${item.text.substring(0, 220)}${item.text.length > 220 ? '...' : ''}</pre>
      <div class="saved-item-actions">
        <button class="saved-copy-btn" onclick="copyText(${JSON.stringify(item.text)}, this)">
          <i class="fas fa-copy"></i> Copy
        </button>
        <button class="saved-delete-btn" onclick="deleteSaved(${i})">✕</button>
      </div>
    </div>
  `).join("");
}

function deleteSaved(index) {
  savedContent.splice(index, 1);
  localStorage.setItem("bella_saved_content", JSON.stringify(savedContent));
  renderSaved();
}

function clearSaved() {
  savedContent = [];
  localStorage.removeItem("bella_saved_content");
  renderSaved();
}

// -------------------------------------------------------
//  LOADING STATE
// -------------------------------------------------------
function showLoading(containerId) {
  document.getElementById(containerId).innerHTML = `
    <div class="loading-card">
      <div class="spinner"></div>
      <p>✨ AI is crafting your content...</p>
    </div>`;
}

// -------------------------------------------------------
//  OPENAI API CALL
// -------------------------------------------------------
async function callGPT(prompt) {
  if (!savedApiKey) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${savedApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a social media marketing expert for "VeronikaK" (sinuguru.square.site), a small UK business selling handmade jewellery including beaded bracelets, braided bracelets, kids bracelets, and earrings. Everything is £6. You write content for Instagram and TikTok to drive sales. Always be enthusiastic, use emojis, mention the £6 price point as a selling advantage, and write in a personal, authentic tone.`
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 900,
        temperature: 0.88
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices[0].message.content;
  } catch { return null; }
}

// -------------------------------------------------------
//  OUTPUT CARD BUILDER
// -------------------------------------------------------
function buildOutputCard(label, content, type = "text") {
  const id = "card-" + Math.random().toString(36).substr(2, 8);
  return `
    <div class="output-card" id="${id}">
      <div class="output-card-header">
        <span>${label}</span>
        <div class="output-card-actions">
          <button class="copy-btn" onclick="copyText(document.querySelector('#${id} pre')?.innerText || document.querySelector('#${id} .card-raw-text')?.dataset.text || '', this)">
            <i class="fas fa-copy"></i> Copy
          </button>
          <button class="save-btn" onclick="saveToLibrary('${label}', document.querySelector('#${id} pre')?.innerText || document.querySelector('#${id} .card-raw-text')?.dataset.text || '')">
            <i class="fas fa-bookmark"></i> Save
          </button>
        </div>
      </div>
      <div class="output-card-body">${content}</div>
    </div>`;
}

// ================================================================
//  ① CAPTION GENERATOR
// ================================================================
const captionTemplates = {
  fun: [
    (p, price, extra) => `okay so I'm OBSESSED with this ${p} 😭✨\n\nHandmade by me with so much love — and yes, it's only ${price || "super affordable"}! 🌈\n\n${extra ? extra + " ✨\n\n" : ""}Perfect for everyday wear, gifting, or just treating yourself because you deserve it! 💅\n\n👇 Drop a 💜 if you want one!\n\nLink in bio to order or DM me "I WANT THIS"!`,
    (p, price, extra) => `POV: you just found the cutest bracelet for ${price || "an amazing price"} 🫶\n\nThis is my ${p} and I can't stop wearing it 😍\n\n${extra ? "✨ " + extra + "\n\n" : ""}Come on, treat yourself! 🌸 Custom colors available too!\n\n💌 DM or order via link in bio!`,
  ],
  elegant: [
    (p, price, extra) => `Introducing the ${p} ✨\n\nCrafted by hand, designed with intention. Every bead placed with care.\n\n${extra ? extra + "\n\n" : ""}Priced at ${price || "accessible for everyone"} — because beautiful things shouldn't be out of reach. 🌿\n\n📦 Order via link in bio. Custom requests welcome.`,
    (p, price, extra) => `Some things are made to be noticed ✨\n\nOur ${p} is one of them.\n\n${extra ? extra + "\n\n" : ""}Handmade with love. Worn with pride. Starting at ${price || "an unbeatable price"}.\n\n→ Shop the link in bio.`,
  ],
  urgent: [
    (p, price, extra) => `⚠️ Almost SOLD OUT — ${p}!\n\n🔥 Only a few left and they're flying!\n\n${extra ? "✨ " + extra + "\n\n" : ""}Price: ${price || "grab it before it's gone!"}\n\nDon't wait — DM me NOW or click the link in bio! ⏰`,
    (p, price, extra) => `Last chance alert! 🚨\n\nThe ${p} is almost gone and I can't guarantee restocking soon!\n\n${extra ? extra + "\n\n" : ""}${price ? "Only " + price + " — " : ""}Drop everything and order NOW 😭\n\n💌 Link in bio or DM me!`,
  ],
  emotional: [
    (p, price, extra) => `I made this ${p} thinking of all of you who deserve something special 💕\n\nSometimes the smallest things carry the biggest meaning. Every bead I place, I think about the person who'll wear it.\n\n${extra ? extra + "\n\n" : ""}${price ? price + " — " : ""}Because you deserve to feel beautiful every single day. 🌸\n\n💌 Order via link in bio. I ship with love!`,
  ],
  promo: [
    (p, price, extra) => `🎉 SALE ALERT! The ${p} is now ${price || "on discount"}!\n\n✅ Handmade quality\n✅ Custom colors available\n✅ Fast shipping\n✅ Gift wrapping included\n\n${extra ? "🌟 " + extra + "\n\n" : ""}Don't miss this! 🛍️ Link in bio to order!\n\n📲 DM me for bulk or custom orders!`,
  ]
};

async function generateCaptions() {
  const product = document.getElementById("cap-product").value.trim() || "Handmade Beaded Bracelet";
  const audience = document.getElementById("cap-audience").value;
  const tone = document.getElementById("cap-tone").value;
  const price = document.getElementById("cap-price").value.trim();
  const details = document.getElementById("cap-details").value.trim();

  showLoading("cap-output");

  // Try GPT first
  if (savedApiKey) {
    const prompt = `Generate exactly 3 different Instagram captions for selling this product:
Product: ${product}
Price: ${price || "not specified"}
Tone: ${tone}
Target audience: ${audience}
Special details: ${details || "none"}

Requirements:
- Each caption must be markedly different in style
- Include emojis throughout
- End with a clear CTA (link in bio / DM to order)
- Hashtags NOT included (those are separate)
- Number them as Caption 1:, Caption 2:, Caption 3:`;

    const result = await callGPT(prompt);
    if (result) {
      const captions = result.split(/Caption \d+:/i).filter(c => c.trim());
      document.getElementById("cap-output").innerHTML = captions.map((cap, i) =>
        buildOutputCard(`Caption Option ${i + 1}`, `<pre>${cap.trim()}</pre>`)
      ).join("");
      return;
    }
  }

  // Fallback: built-in templates
  await new Promise(r => setTimeout(r, 700));
  const templates = captionTemplates[tone] || captionTemplates.fun;
  const captions = [...templates];
  // Always add at least 3
  while (captions.length < 3) captions.push(...captionTemplates.fun);

  document.getElementById("cap-output").innerHTML = captions.slice(0, 3).map((fn, i) =>
    buildOutputCard(`Caption Option ${i + 1}`, `<pre>${fn(product, price, details)}</pre>`)
  ).join("");
}

// ================================================================
//  ② REELS SCRIPT GENERATOR
// ================================================================
const reelScripts = {
  making: (product, duration) => ({
    title: `✨ Satisfying Making Process — ${product}`,
    steps: [
      { label: "HOOK (0–2s)", text: `Start mid-action — hands already threading beads. No intro, no talking. Let the ASMR sounds do the work. Add text overlay: "Making your new obsession 🌸"` },
      { label: "PROCESS (3–${duration - 5}s)", text: `Show satisfying close-up of beads going on the string. Use slow motion at 1–2 key moments. Add trending instrumental audio at medium volume.` },
      { label: "REVEAL (last 5s)", text: `Hold the finished ${product} up to camera. Big smile. Text overlay: "${product} — now available! 🌈 Link in bio 💕" Clap on the last beat of the music.` },
      { label: "CAPTION", text: `POV: watching me make your next favorite bracelet 🫶 [use hashtag set]` },
      { label: "AUDIO TIP", text: `Search "aesthetic beads ASMR" or use any viral trending audio from your Reels explore page.` }
    ]
  }),
  reveal: (product, duration) => ({
    title: `🎁 Product Reveal — ${product}`,
    steps: [
      { label: "HOOK (0–2s)", text: `Text on screen: "wait for it… 👀" while product is hidden in your hand or a small pouch.` },
      { label: "BUILD-UP (3–8s)", text: `Slowly open your hand or pull out the bracelet. Tease it. Pan the camera close.` },
      { label: "REVEAL (9–20s)", text: `Full reveal on wrist! Show it from multiple angles. Add sparkle effect if available. Text: "${product} ✨ only $X"` },
      { label: "CTA (last 3s)", text: `Point at camera. Text: "Order this NOW — link in bio 💌"` },
      { label: "CAPTION", text: `New drop just landed 😍 Who's getting one? 👇 [add hashtags]` }
    ]
  }),
  styling: (product, duration) => ({
    title: `💅 How to Style — ${product}`,
    steps: [
      { label: "HOOK (0–2s)", text: `Text: "3 ways to wear this $X bracelet 🌸" — bare wrist shown first.` },
      { label: "LOOK 1 (3–10s)", text: `Casual: bracelet + simple tee. Text: "Everyday casual 🤍"` },
      { label: "LOOK 2 (11–20s)", text: `Stacked: bracelet with 2–3 others. Text: "Stack it up ✨"` },
      { label: "LOOK 3 (21–${duration - 3}s)", text: `Dressed up: bracelet + evening outfit. Text: "Date night ready 💕"` },
      { label: "CTA (last 3s)", text: `Text: "Get yours — link in bio 💌" + wink at camera.` }
    ]
  }),
  gifting: (product, duration) => ({
    title: `🎁 Gift Idea — ${product}`,
    steps: [
      { label: "HOOK (0–3s)", text: `Text: "The best gift under $15 🎁😭" — show bracelet in gift wrapping.` },
      { label: "STORY (4–20s)", text: `"My [mom/friend/sister] cried when I gave her this custom bracelet 😭💕" — show reaction clip or photo if you have one.` },
      { label: "FEATURES (21–${duration - 5}s)", text: `Quick cuts showing: custom name option, colors, packaging. Text overlays: "Custom Name ✅ Gift Box ✅ Fast Ship ✅"` },
      { label: "CTA (last 5s)", text: `"Order yours — she will LOVE it 💖 Link in bio!"` },
      { label: "TIMING TIP", text: `Post this near birthdays, Valentine's Day, Mother's Day, Christmas for maximum impact.` }
    ]
  }),
  pov: (product, duration) => ({
    title: `👀 POV Customer Story — ${product}`,
    steps: [
      { label: "HOOK (0–2s)", text: `Text: "POV: you ordered a bracelet and it changed your day 🌸"` },
      { label: "SCENE 1 (3–10s)", text: `Order confirmation screen / phone notification. Text: "ordered Friday night 📱"` },
      { label: "SCENE 2 (11–18s)", text: `Show package arriving. Text: "came on Monday 🎁 fastest shipping ever"` },
      { label: "SCENE 3 (19–${duration - 3}s)", text: `Opening the package — bracelet reveal — put it on and show wrist. Text: "I'm never taking this off 😭💕"` },
      { label: "CTA", text: `"Experience this yourself → link in bio 💌"` }
    ]
  }),
  trending: (product, duration) => ({
    title: `🔥 Trending Audio Hook — ${product}`,
    steps: [
      { label: "PREPARATION", text: `Go to your Instagram Explore page → find a trending audio with the 📈 arrow. Use that audio for this video.` },
      { label: "HOOK (0–3s)", text: `Sync your first visual CUT to the first beat drop. Start with a close-up of the bracelet.` },
      { label: "MAIN CONTENT (4–${duration - 5}s)", text: `Quick cuts timed exactly to the beats: bead close-up → full bracelet → on wrist → packaging → happy face. Each cut = 1 beat.` },
      { label: "TEXT OVERLAY", text: `Keep it minimal: "${product} ✨" + price + "link in bio 💕"` },
      { label: "POSTING TIP", text: `Post within 24–48 hours of the audio trending for maximum boost from the algorithm.` }
    ]
  })
};

async function generateReelScript() {
  const type = document.getElementById("reel-type").value;
  const duration = parseInt(document.getElementById("reel-duration").value);
  const product = document.getElementById("reel-product").value.trim() || "Handmade Beaded Bracelet";

  showLoading("reel-output");

  if (savedApiKey) {
    const prompt = `Create a detailed Reels/TikTok video script for selling this product:
Product: ${product}
Video type: ${type}
Duration: ${duration} seconds

Format the response with clear sections:
- VIDEO TITLE
- HOOK (0-2 seconds): what to film/show
- MIDDLE CONTENT: step by step with timestamps
- CTA (last 3 seconds): call to action
- CAPTION: short caption to use
- AUDIO TIP: what audio to use

Make it super practical and filmable without professional equipment. Use emojis.`;

    const result = await callGPT(prompt);
    if (result) {
      document.getElementById("reel-output").innerHTML =
        buildOutputCard(`🎬 ${type.toUpperCase()} Script — ${duration}s`, `<pre>${result}</pre>`);
      return;
    }
  }

  await new Promise(r => setTimeout(r, 700));
  const scriptFn = reelScripts[type] || reelScripts.making;
  const script = scriptFn(product, duration);
  const stepsHTML = script.steps.map((s, i) => `
    <div class="script-step">
      <div class="step-num">${i + 1}</div>
      <div class="step-content">
        <div class="step-label">${s.label}</div>
        <div class="step-text">${s.text}</div>
      </div>
    </div>`).join("");

  const rawText = script.steps.map(s => `${s.label}\n${s.text}`).join("\n\n");
  document.getElementById("reel-output").innerHTML =
    buildOutputCard(`🎬 ${script.title}`,
      `<div class="card-raw-text" data-text="${rawText.replace(/"/g, '&quot;')}"></div>${stepsHTML}`
    );
}

// ================================================================
//  ③ HASHTAG GENERATOR
// ================================================================
const hashtagSets = {
  bracelet: {
    big: ["#bracelet", "#braceletstack", "#jewelry", "#handmadejewelry", "#accessories"],
    medium: ["#beadedbracelet", "#beadedjewelry", "#stretchbracelet", "#braceletsofinstagram", "#jewelrymaker"],
    small: ["#handmadebracelet", "#braceletlover", "#beadwork", "#braceletoftheday", "#customjewelry"]
  },
  custom: {
    big: ["#custombracelet", "#personalized", "#customjewelry", "#namebracelet", "#handmade"],
    medium: ["#personalizedjewelry", "#customname", "#uniquegifts", "#handmadewithlove", "#braceletmaker"],
    small: ["#custommade", "#namejewelry", "#personalizedgifts", "#madetoorder", "#uniquebracelet"]
  },
  gift: {
    big: ["#giftideas", "#giftforher", "#handmadegifts", "#birthdaygift", "#jewelry"],
    medium: ["#giftbox", "#giftsforwomen", "#birthdaypresent", "#giftshe'lllove", "#thoughtfulgifts"],
    small: ["#giftwrapping", "#giftguide", "#giftsunder20", "#braceletgift", "#handmadewithlove"]
  },
  handmade: {
    big: ["#handmade", "#handmadewithlove", "#smallbusiness", "#shopsmall", "#craft"],
    medium: ["#handmadejewelry", "#supportsmallbusiness", "#makersgonnamake", "#handcrafted", "#artisan"],
    small: ["#handmadeshop", "#smallbiz", "#supportlocal", "#womanowned", "#homemade"]
  },
  fashion: {
    big: ["#fashion", "#style", "#ootd", "#accessories", "#jewelry"],
    medium: ["#jewelrystyle", "#accessoriesoftheday", "#fashionjewelry", "#jewelryoftheday", "#wristgame"],
    small: ["#stackingstyle", "#layeredbracelets", "#wristselfie", "#jewelryaddict", "#accessorize"]
  },
  sale: {
    big: ["#sale", "#discount", "#shopnow", "#deal", "#offer"],
    medium: ["#jewelry sale", "#handmadesale", "#limitedstock", "#buynow", "#affordablejewelry"],
    small: ["#salealert", "#dealsoftheday", "#buyjewelry", "#braceletsale", "#getitbeforeitsgone"]
  }
};

async function generateHashtags() {
  const topic = document.getElementById("hash-topic").value;
  const location = document.getElementById("hash-location").value.trim();
  const shop = document.getElementById("hash-shop").value.trim();

  showLoading("hash-output");

  if (savedApiKey) {
    const prompt = `Generate an optimized Instagram hashtag set for a handmade beaded bracelet business.
Topic: ${topic}
Location: ${location || "general/worldwide"}
Shop: ${shop || "bella beads"}

Provide:
1. REACH SET (30 hashtags) - mix of big, medium, small
2. NICHE SET (15 hashtags) - very specific, less competition
3. LOCAL SET (10 hashtags) - location specific${location ? " for " + location : ""}

Format cleanly. Include branded hashtag using shop name.`;

    const result = await callGPT(prompt);
    if (result) {
      document.getElementById("hash-output").innerHTML =
        buildOutputCard("🏷️ Your Hashtag Sets", `<pre>${result}</pre>`);
      return;
    }
  }

  await new Promise(r => setTimeout(r, 600));
  const set = hashtagSets[topic] || hashtagSets.bracelet;
  const locationTags = location ? [
    `#${location.toLowerCase().replace(/\s+/g, "")}`,
    `#shopIn${location.replace(/\s+/g, "")}`,
    `#${location.toLowerCase().replace(/\s+/g, "")}business`,
    `#${location.toLowerCase().replace(/\s+/g, "")}jewelry`,
    `#${location.toLowerCase().replace(/\s+/g, "")}shop`
  ] : [];
  const shopTags = shop ? [`#${shop.replace(/\s+/g, "").toLowerCase()}`, `#${shop.replace(/\s+/g, "").toLowerCase()}bracelets`] : ["#bellabeads", "#bellabeadsofficial"];

  const allTags = [...set.big, ...set.medium, ...set.small, ...locationTags, ...shopTags];

  const bigHTML = set.big.map(h => `<span class="hashtag-pill" onclick="copyText('${h}', this)">${h}</span>`).join("");
  const medHTML = set.medium.map(h => `<span class="hashtag-pill" onclick="copyText('${h}', this)">${h}</span>`).join("");
  const smallHTML = set.small.map(h => `<span class="hashtag-pill" onclick="copyText('${h}', this)">${h}</span>`).join("");
  const locHTML = locationTags.map(h => `<span class="hashtag-pill" onclick="copyText('${h}', this)">${h}</span>`).join("");
  const shopHTML = shopTags.map(h => `<span class="hashtag-pill" onclick="copyText('${h}', this)">${h}</span>`).join("");

  const fullCopyText = allTags.join(" ");

  document.getElementById("hash-output").innerHTML = `
    <div class="output-card">
      <div class="output-card-header">
        <span>🏷️ Full Hashtag Set (${allTags.length} tags)</span>
        <div class="output-card-actions">
          <button class="copy-btn" onclick="copyText('${fullCopyText}', this)"><i class="fas fa-copy"></i> Copy All</button>
          <button class="save-btn" onclick="saveToLibrary('Hashtags', '${fullCopyText}')"><i class="fas fa-bookmark"></i> Save</button>
        </div>
      </div>
      <div class="output-card-body">
        <div class="hashtag-section"><div class="hashtag-section-label">🔴 High Reach (use 2-3)</div><div class="hashtag-container">${bigHTML}</div></div>
        <div class="hashtag-section"><div class="hashtag-section-label">🟡 Medium Reach (use 5-8)</div><div class="hashtag-container">${medHTML}</div></div>
        <div class="hashtag-section"><div class="hashtag-section-label">🟢 Niche / Low Competition (use 10+)</div><div class="hashtag-container">${smallHTML}</div></div>
        ${locHTML ? `<div class="hashtag-section"><div class="hashtag-section-label">📍 Location Tags</div><div class="hashtag-container">${locHTML}</div></div>` : ""}
        <div class="hashtag-section"><div class="hashtag-section-label">🌸 Branded Tags</div><div class="hashtag-container">${shopHTML}</div></div>
        <div style="padding:12px 16px;font-size:0.78rem;color:var(--gray);background:var(--pink-soft);margin:8px 16px;border-radius:10px;">
          💡 Tip: Click any hashtag to copy it. Use 15–25 hashtags per post for best results. Rotate sets to avoid looking spammy.
        </div>
      </div>
    </div>`;
}

// ================================================================
//  ④ CONTENT CALENDAR
// ================================================================
const calendarPlans = {
  daily: {
    awareness: [
      { day: "Monday", type: "Reel 🎬", content: "Satisfying bracelet-making process video. No talking needed — let the ASMR sounds hook people. Text: 'Made this in 20 minutes ✨'" },
      { day: "Tuesday", type: "Photo 📸", content: "Flat lay of 3 different bracelets with a clean background. Caption: introduce your brand story — why you started making bracelets." },
      { day: "Wednesday", type: "Story 💬", content: "Poll: 'Which color do you prefer? 💕' [Pink vs Blue]. Builds engagement + gives you product insights." },
      { day: "Thursday", type: "Reel 🎬", content: "Before & after: pile of beads → finished bracelet. Trending audio. Text: 'From this… to THIS 😍'" },
      { day: "Friday", type: "Collab Post 🤝", content: "Tag a friend who would love this! Increases reach to new audiences for free." },
      { day: "Saturday", type: "Customer Reel 🌟", content: "If you have a happy customer, share their photo/video as a testimonial. Social proof = trust = sales." },
      { day: "Sunday", type: "Behind Scenes 🏠", content: "Show your workspace, your bead collection, your packaging materials. People love seeing the human behind the brand." }
    ],
    sales: [
      { day: "Monday", type: "Product Reel 🎬", content: "Feature your best-selling bracelet. Show it on wrist. Clear price. Direct CTA: 'Order via link in bio 💌'" },
      { day: "Tuesday", type: "Limited Offer 🔥", content: "Flash deal post: '48-hour discount on [product]!' Creates urgency. Use countdown sticker in stories." },
      { day: "Wednesday", type: "Testimonial 💬", content: "Share a customer review or DM screenshot (with permission). Caption: 'This is why I love what I do 💕'" },
      { day: "Thursday", type: "Gift Idea Reel 🎁", content: "'Perfect gift under $15 🎁' — show bracelet being gift-wrapped. Great for gifting occasions." },
      { day: "Friday", type: "New Drop Tease 👀", content: "Blur or partially hide a new product. 'Dropping this tomorrow… 👀' — builds anticipation." },
      { day: "Saturday", type: "New Drop Launch 🚀", content: "Full reveal of the product teased yesterday. Price, how to order, limited stock warning." },
      { day: "Sunday", type: "Weekly Wrap-up 📦", content: "Show orders packed and ready to ship. Creates FOMO. 'Packing this week's orders 🥹💕 Yours could be next!'" }
    ]
  }
};

async function generateCalendar() {
  const freq = document.getElementById("cal-freq").value;
  const goal = document.getElementById("cal-goal").value;

  showLoading("cal-output");

  if (savedApiKey) {
    const prompt = `Create a detailed 7-day Instagram content calendar for a handmade beaded bracelet small business.
Posting frequency: ${freq === "daily" ? "every day" : freq === "5" ? "5 days a week" : "3 days a week"}
Main goal: ${goal}

For each day provide:
- Day name
- Post type (Reel/Photo/Story/Carousel)
- Exact content idea (what to film/photograph and caption direction)
- Best posting time

Make it very practical, specific, and actionable. Focus on content that actually gets results for a small jewelry business. Use emojis.`;

    const result = await callGPT(prompt);
    if (result) {
      document.getElementById("cal-output").innerHTML =
        buildOutputCard("📅 Your 7-Day Content Plan", `<pre>${result}</pre>`);
      return;
    }
  }

  await new Promise(r => setTimeout(r, 800));
  const plan = calendarPlans.daily?.[goal] || calendarPlans.daily.sales;

  const daysHTML = plan.map(d => `
    <div class="cal-day">
      <div class="cal-day-header">
        <span class="cal-day-name">📅 ${d.day}</span>
        <span class="cal-day-type">${d.type}</span>
      </div>
      <p>${d.content}</p>
    </div>`).join("");

  const rawText = plan.map(d => `${d.day} — ${d.type}\n${d.content}`).join("\n\n");

  document.getElementById("cal-output").innerHTML = `
    <div class="output-card">
      <div class="output-card-header">
        <span>📅 7-Day Content Plan</span>
        <div class="output-card-actions">
          <button class="copy-btn" onclick="copyText(\`${rawText.replace(/`/g, "'")}\`, this)"><i class="fas fa-copy"></i> Copy</button>
          <button class="save-btn" onclick="saveToLibrary('Content Calendar', \`${rawText.replace(/`/g, "'")}\`)"><i class="fas fa-bookmark"></i> Save</button>
        </div>
      </div>
      <div class="output-card-body">${daysHTML}</div>
    </div>
    <div class="output-card" style="border-left-color:var(--purple)">
      <div class="output-card-header"><span style="color:var(--purple)">⏰ Best Posting Times</span></div>
      <div class="output-card-body">
        <pre>🌅 Morning: 7:00 AM – 9:00 AM (people checking phones in bed)
🌆 Evening: 7:00 PM – 10:00 PM (after work/dinner, peak scrolling time)

📊 Post Reels at 8 PM for 3x more reach
📲 Post Stories all day to stay at the top of followers' feeds
🔁 Engage with comments within the first 30 mins of posting — the algorithm rewards this!</pre>
      </div>
    </div>`;
}

// ================================================================
//  ⑤ STORY IDEAS
// ================================================================
const storyIdeas = {
  engagement: [
    { title: "This or That Poll 🗳️", desc: "Two bracelet options. 'Which would YOU wear?' — super easy to vote on, massive engagement boost." },
    { title: "Question Box ❓", desc: "'Ask me anything about my bracelets!' — turns followers into conversations and creates content ideas." },
    { title: "Quiz: Guess the Price 💰", desc: "Show bracelet, ask 'How much do you think this costs?' Options: $5 / $10 / $20. Reveal answer + link to buy." },
    { title: "Emoji Slider 🎚️", desc: "'How much do you love this color? 💕' with the heart emoji slider — people love tapping it." },
    { title: "Countdown Timer ⏰", desc: "'SALE ends in:' with a countdown sticker. Creates urgency even with 0 budget." }
  ],
  sales: [
    { title: "Swipe Up / Link Sticker 🔗", desc: "Product photo + price + 'Tap to order!' sticker linking to your website or WhatsApp. Keep it simple." },
    { title: "Limited Stock Alert 🚨", desc: "'Only 3 left! 😭' — scarcity drives immediate action. Real or creating urgency, it works." },
    { title: "Bundle Deal 🎁", desc: "'Buy 3 get 1 FREE today only!' — use stories for flash deals not on your main feed." },
    { title: "DM Me Trigger 💌", desc: "'DM me the word BRACELET to get our full catalog!' — drives DMs and starts sales conversations." },
    { title: "Customer Order Process 📦", desc: "Show an order being packed in real time: 'Packing [Name]'s order right now 🥹💕' — shows activity = builds trust." }
  ],
  trust: [
    { title: "My Workspace Tour 🏠", desc: "Show your bead collection and where you work. Raw and authentic content builds huge trust." },
    { title: "A Day in My Life 📱", desc: "Quick clips of your day + making bracelets. Makes followers feel connected to you personally." },
    { title: "Time-Lapse Making 🎬", desc: "Film yourself making a bracelet start to finish, speed it up 10x. Hypnotic and satisfying." },
    { title: "Customer Unboxing 📦", desc: "Screenshot a customer's story when they receive their order. Real reactions = real trust." },
    { title: "Behind My Process 🔍", desc: "'Did you know I test every bracelet 3 times before shipping? 💪' — facts about your quality build confidence." }
  ],
  fun: [
    { title: "Color Drop Reveal 🎨", desc: "Pan from beads in a bowl to finished bracelet in matching colors on wrist. Satisfying color match video." },
    { title: "Would You Rather? 🤔", desc: "'Rainbow or Pastel?' Make it a poll. Fun + free market research." },
    { title: "My Followers Choose! 🗳️", desc: "'Voting on which one to make next! 💕' — involve your audience in your products." },
    { title: "Bead Drop ASMR 🎵", desc: "Just pour beads into a bowl in front of the camera. The sound alone gets insane views." },
    { title: "Packaging ASMR 📦", desc: "Wrap a bracelet in tissue paper, hear the crinkle, place in box, tie ribbon. Very satisfying to watch." }
  ]
};

async function generateStoryIdeas() {
  const goal = document.getElementById("story-goal").value;
  showLoading("story-output");

  if (savedApiKey) {
    const prompt = `Generate 5 creative and practical Instagram Story ideas for a handmade beaded bracelet small business.
Goal: ${goal}

For each idea:
- Story title/concept
- Exactly what to post (text, stickers, interactive elements)
- Why it works (algorithm/psychology reason)

Make them immediately executable with a phone camera, no professional equipment needed. Use emojis.`;

    const result = await callGPT(prompt);
    if (result) {
      document.getElementById("story-output").innerHTML =
        buildOutputCard("💡 5 Story Ideas", `<pre>${result}</pre>`);
      return;
    }
  }

  await new Promise(r => setTimeout(r, 600));
  const ideas = storyIdeas[goal] || storyIdeas.engagement;

  document.getElementById("story-output").innerHTML = ideas.map((idea, i) =>
    buildOutputCard(`Story Idea ${i + 1}: ${idea.title}`, `<pre>${idea.desc}</pre>`)
  ).join("");
}

// ================================================================
//  ⑥ BIO GENERATOR
// ================================================================
async function generateBio() {
  const name = document.getElementById("bio-name").value.trim() || "Bella Beads";
  const location = document.getElementById("bio-location").value.trim();
  const special = document.getElementById("bio-special").value.trim();
  const cta = document.getElementById("bio-cta").value;

  showLoading("bio-output");

  const ctaText = {
    order: "👇 Order via WhatsApp",
    shop: "👇 Shop now →",
    dm: "💌 DM to order",
    link: "👇 Tap link to shop"
  }[cta];

  if (savedApiKey) {
    const prompt = `Write 3 different Instagram bio options for this handmade bracelet business:
Name: ${name}
Location: ${location || "not specified"}
What's special: ${special || "handmade, custom colors, name beads"}
CTA: ${ctaText}

Requirements:
- Max 150 characters each
- Use emojis
- Include what they sell + unique angle + location (if given) + CTA
- Each bio should have a different personality/style
- Number them Bio 1:, Bio 2:, Bio 3:`;

    const result = await callGPT(prompt);
    if (result) {
      const bios = result.split(/Bio \d+:/i).filter(b => b.trim());
      document.getElementById("bio-output").innerHTML = bios.map((bio, i) =>
        buildOutputCard(`Bio Option ${i + 1}`, `<pre>${bio.trim()}</pre>`)
      ).join("");
      return;
    }
  }

  await new Promise(r => setTimeout(r, 700));
  const loc = location ? `📍 ${location}` : "";
  const bios = [
    `🌸 Handmade beaded bracelets\n✨ ${special || "Custom colors & name beads"}\n${loc}\n${ctaText}`,
    `💕 Making bracelets with love since day one\n🎨 Every piece is unique & custom made\n${loc ? loc + "\n" : ""}${ctaText} 👇`,
    `Your new favorite jewelry obsession 💎\n🌈 ${special || "100% handmade | Custom orders welcome"}\n${loc ? loc + " | " : ""}${ctaText}`
  ];

  document.getElementById("bio-output").innerHTML = bios.map((bio, i) => {
    const charCount = bio.replace(/\n/g, " ").length;
    const countColor = charCount > 150 ? "#dc2626" : "#25d366";
    return buildOutputCard(`Bio Option ${i + 1} — <span style="color:${countColor}">${charCount}/150 chars</span>`,
      `<pre>${bio}</pre>`);
  }).join("");
}

// -------------------------------------------------------
//  INIT
// -------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderSaved();
});
