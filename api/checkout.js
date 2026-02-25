// ============================================================
//  api/checkout.js — Square Checkout Link Creator
//  Called by the frontend "Buy Now" modal
//  Creates a Square payment link and returns the URL
// ============================================================

const { randomUUID } = require("crypto");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { productName, price = 600 } = req.body || {};
  if (!productName) return res.status(400).json({ error: "productName required" });

  const SQUARE_TOKEN = process.env.SQUARE_TOKEN;
  if (!SQUARE_TOKEN) return res.status(500).json({ error: "SQUARE_TOKEN not configured" });

  const LOCATION_ID = "LSQB82FGA4ETY";
  const REDIRECT_URL = (process.env.SHOP_URL || "https://shop-sandy-theta.vercel.app") + "/?order=success";

  try {
    const response = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SQUARE_TOKEN}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-01-18"
      },
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        order: {
          location_id: LOCATION_ID,
          line_items: [{
            name: productName,
            quantity: "1",
            base_price_money: { amount: price, currency: "GBP" }
          }]
        },
        checkout_options: {
          redirect_url: REDIRECT_URL,
          ask_for_shipping_address: true
        },
        payment_note: `VeronikaK shop order — ${productName}`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Square error:", JSON.stringify(data));
      return res.status(502).json({ error: data.errors?.[0]?.detail || "Square API error" });
    }

    return res.status(200).json({ url: data.payment_link.url });

  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
