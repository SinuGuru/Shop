// ============================================================
//  api/cancel-order.js — Cancel a Square order
//  POST /api/cancel-order   { orderId, version }
// ============================================================

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SQUARE_TOKEN = process.env.SQUARE_TOKEN;
  if (!SQUARE_TOKEN) return res.status(500).json({ error: "SQUARE_TOKEN not configured" });

  const { orderId, version } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId required" });

  const SQUARE_API = "https://connect.squareup.com/v2";
  const headers = {
    "Authorization": `Bearer ${SQUARE_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": "2024-01-18"
  };

  try {
    // First fetch the current order version if not provided
    let orderVersion = version;
    if (!orderVersion) {
      const getRes  = await fetch(`${SQUARE_API}/orders/${orderId}`, { headers });
      const getData = await getRes.json();
      if (!getRes.ok) return res.status(502).json({ error: getData.errors?.[0]?.detail || "Could not fetch order" });
      orderVersion = getData.order?.version ?? 1;
    }

    const cancelRes = await fetch(`${SQUARE_API}/orders/${orderId}/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify({ version: orderVersion })
    });
    const cancelData = await cancelRes.json();

    if (!cancelRes.ok) {
      return res.status(502).json({ error: cancelData.errors?.[0]?.detail || "Square cancel error" });
    }

    return res.status(200).json({ success: true, state: cancelData.order?.state });
  } catch (err) {
    console.error("Cancel order error:", err);
    return res.status(500).json({ error: err.message });
  }
};
