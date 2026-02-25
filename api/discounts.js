// ============================================================
//  api/discounts.js — Manage Square Discount Codes
//  GET    /api/discounts          → list all discounts
//  POST   /api/discounts          → create a discount
//  DELETE /api/discounts?id=xxx   → delete a discount
// ============================================================
const { randomUUID } = require("crypto");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const SQUARE_TOKEN = process.env.SQUARE_TOKEN;
  if (!SQUARE_TOKEN) return res.status(500).json({ error: "SQUARE_TOKEN not configured" });

  const SQUARE_API = "https://connect.squareup.com/v2";
  const headers = {
    "Authorization": `Bearer ${SQUARE_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": "2024-01-18"
  };

  try {
    // ── LIST ─────────────────────────────────────────────────
    if (req.method === "GET") {
      const r    = await fetch(`${SQUARE_API}/catalog/list?types=DISCOUNT`, { headers });
      const data = await r.json();
      const items = (data.objects || []).map(obj => {
        const d = obj.discount_data || {};
        return {
          id:         obj.id,
          version:    obj.version,
          name:       d.name || "",
          type:       d.discount_type,              // FIXED_AMOUNT or FIXED_PERCENTAGE
          amount:     d.amount_money ? (d.amount_money.amount / 100).toFixed(2) : null,
          percentage: d.percentage || null,
          code:       d.code || null,
          enabled:    !obj.is_deleted
        };
      });
      return res.status(200).json({ discounts: items });
    }

    // ── CREATE ────────────────────────────────────────────────
    if (req.method === "POST") {
      const { name, type, amount, percentage } = req.body || {};
      if (!name || !type) return res.status(400).json({ error: "name and type required" });

      const discountData = { name, discount_type: type };
      if (type === "FIXED_AMOUNT" && amount) {
        discountData.amount_money = { amount: Math.round(parseFloat(amount) * 100), currency: "GBP" };
      } else if (type === "FIXED_PERCENTAGE" && percentage) {
        discountData.percentage = String(percentage);
      } else {
        return res.status(400).json({ error: "amount required for FIXED_AMOUNT, percentage for FIXED_PERCENTAGE" });
      }

      const r    = await fetch(`${SQUARE_API}/catalog/batch-upsert`, {
        method: "POST", headers,
        body: JSON.stringify({
          idempotency_key: randomUUID(),
          batches: [{ objects: [{ type: "DISCOUNT", id: "#new", discount_data: discountData }] }]
        })
      });
      const data = await r.json();
      if (!r.ok) return res.status(502).json({ error: data.errors?.[0]?.detail || "Could not create discount" });
      return res.status(200).json({ success: true, id: Object.values(data.id_mappings || {})[0] });
    }

    // ── DELETE ────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id required" });
      const r    = await fetch(`${SQUARE_API}/catalog/object/${id}`, { method: "DELETE", headers });
      const data = await r.json();
      if (!r.ok) return res.status(502).json({ error: data.errors?.[0]?.detail || "Could not delete discount" });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Discounts error:", err);
    return res.status(500).json({ error: err.message });
  }
};
