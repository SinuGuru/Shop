// ============================================================
//  api/gpt.js — Secure OpenAI proxy (Vercel serverless)
//  Keys stored in Vercel environment variables, never in browser
// ============================================================

export default async function handler(req, res) {
  // CORS — only allow requests from our own domain
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, systemPrompt, model = "gpt-4o-mini", max_tokens = 600 } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  const apiKey = process.env.OPENAI_KEY;
  if (!apiKey) return res.status(500).json({ error: "OpenAI key not configured on server" });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages: [
          { role: "system", content: systemPrompt || 'You are a content creator for "VeronikaK", a UK handmade jewellery shop. All items £6.' },
          { role: "user",   content: prompt }
        ]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    return res.status(200).json({ result: data.choices[0].message.content.trim() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
