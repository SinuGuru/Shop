// ============================================================
//  api/refund-order.js — Issue a refund via Square API
//  POST { orderId, paymentId, amountPence, reason }
//  amountPence: integer pence (e.g. 600 for £6.00), or omit for full refund
// ============================================================
const { randomUUID } = require("crypto");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SQUARE_TOKEN = process.env.SQUARE_TOKEN;
  if (!SQUARE_TOKEN) return res.status(500).json({ error: "SQUARE_TOKEN not configured" });

  const { orderId, paymentId, amountPence, reason } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: "paymentId required" });

  const SQUARE_API = "https://connect.squareup.com/v2";
  const headers = {
    "Authorization": `Bearer ${SQUARE_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": "2024-01-18"
  };

  try {
    // If no amount specified, fetch the full payment amount
    let refundAmount = amountPence;
    if (!refundAmount) {
      const payRes  = await fetch(`${SQUARE_API}/payments/${paymentId}`, { headers });
      const payData = await payRes.json();
      if (!payRes.ok) return res.status(502).json({ error: payData.errors?.[0]?.detail || "Could not fetch payment" });
      refundAmount = payData.payment?.amount_money?.amount;
      if (!refundAmount) return res.status(400).json({ error: "Could not determine payment amount" });
    }

    const body = {
      idempotency_key: randomUUID(),
      payment_id: paymentId,
      amount_money: { amount: refundAmount, currency: "GBP" },
      reason: reason || "Refund requested via VeronikaK admin"
    };
    if (orderId) body.order_id = orderId;

    const refRes  = await fetch(`${SQUARE_API}/refunds`, {
      method: "POST", headers, body: JSON.stringify(body)
    });
    const refData = await refRes.json();
    if (!refRes.ok) return res.status(502).json({ error: refData.errors?.[0]?.detail || "Square refund error" });

    return res.status(200).json({
      success: true,
      refundId: refData.refund?.id,
      status:   refData.refund?.status,
      amount:   (refundAmount / 100).toFixed(2)
    });
  } catch (err) {
    console.error("Refund error:", err);
    return res.status(500).json({ error: err.message });
  }
};
