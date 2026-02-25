// ============================================================
//  api/ship-order.js — Mark a Square order as shipped
//  POST { orderId, version, trackingNumber, carrier }
// ============================================================

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SQUARE_TOKEN = process.env.SQUARE_TOKEN;
  if (!SQUARE_TOKEN) return res.status(500).json({ error: "SQUARE_TOKEN not configured" });

  const { orderId, version, trackingNumber, carrier } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId required" });

  const SQUARE_API = "https://connect.squareup.com/v2";
  const headers = {
    "Authorization": `Bearer ${SQUARE_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": "2024-01-18"
  };

  try {
    // Fetch current order to get fulfillment ID and version
    const getRes  = await fetch(`${SQUARE_API}/orders/${orderId}`, { headers });
    const getData = await getRes.json();
    if (!getRes.ok) return res.status(502).json({ error: getData.errors?.[0]?.detail || "Could not fetch order" });

    const order          = getData.order;
    const orderVersion   = version ?? order.version ?? 1;
    const fulfillments   = order.fulfillments || [];
    const fulfillmentId  = fulfillments[0]?.uid;

    // Build fulfillment update — mark COMPLETED and add tracking
    const fulfillmentUpdate = {
      uid:   fulfillmentId || "fulfillment-1",
      type:  "SHIPMENT",
      state: "COMPLETED",
      shipment_details: {
        carrier:         carrier || "Royal Mail",
        tracking_number: trackingNumber || "",
        shipped_at:      new Date().toISOString()
      }
    };

    const updateRes = await fetch(`${SQUARE_API}/orders/${orderId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        order: {
          id:           orderId,
          location_id:  order.location_id,
          version:      orderVersion,
          fulfillments: [fulfillmentUpdate],
          state:        "COMPLETED"
        },
        idempotency_key: `ship-${orderId}-${Date.now()}`
      })
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok) return res.status(502).json({ error: updateData.errors?.[0]?.detail || "Could not update order" });

    return res.status(200).json({
      success:        true,
      state:          updateData.order?.state,
      trackingNumber: trackingNumber || "",
      carrier:        carrier || "Royal Mail"
    });
  } catch (err) {
    console.error("Ship order error:", err);
    return res.status(500).json({ error: err.message });
  }
};
