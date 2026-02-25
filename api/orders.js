// ============================================================
//  api/orders.js — Square Orders + Inventory Fetcher
//  GET  /api/orders?type=orders      → recent orders + fulfillments
//  GET  /api/orders?type=inventory   → stock counts per product
//  GET  /api/orders?type=all         → both combined
// ============================================================

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const SQUARE_TOKEN = process.env.SQUARE_TOKEN;
  if (!SQUARE_TOKEN) return res.status(500).json({ error: "SQUARE_TOKEN not configured on Vercel" });

  const LOCATION_ID = "LSQB82FGA4ETY";
  const SQUARE_API  = "https://connect.squareup.com/v2";
  const type        = req.query.type || "all";
  const headers     = {
    "Authorization": `Bearer ${SQUARE_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": "2024-01-18"
  };

  try {
    const result = {};

    // ── ORDERS ────────────────────────────────────────────────
    if (type === "orders" || type === "all") {
      const ordersRes = await fetch(`${SQUARE_API}/orders/search`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          location_ids: [LOCATION_ID],
          query: {
            sort: { sort_field: "CREATED_AT", sort_order: "DESC" }
          },
          limit: 100
        })
      });
      const ordersData = await ordersRes.json();
      const orders = (ordersData.orders || []).map(o => {
        const fulfillment = (o.fulfillments || [])[0];
        const shipDetails = fulfillment?.shipment_details || fulfillment?.delivery_details || null;
        const recipient   = shipDetails?.recipient || null;
        const addr        = recipient?.address || null;
        return {
          id:         o.id,
          version:    o.version,
          created_at: o.created_at,
          state:      o.state,           // OPEN, COMPLETED, CANCELED
          total:      o.total_money ? (o.total_money.amount / 100).toFixed(2) : "0.00",
          totalPence: o.total_money?.amount || 0,
          currency:   o.total_money?.currency || "GBP",
          paymentIds: o.tender_ids || [],
          tracking: {
            carrier: shipDetails?.carrier || "",
            number:  shipDetails?.tracking_number || "",
            shipped: shipDetails?.shipped_at || ""
          },
          customer: {
            name:  recipient?.display_name || o.customer_id || "Unknown",
            email: recipient?.email_address || "",
            phone: recipient?.phone_number  || ""
          },
          address: addr ? [
            addr.address_line_1,
            addr.address_line_2,
            addr.locality,
            addr.postal_code,
            addr.country
          ].filter(Boolean).join(", ") : "",
          items: (o.line_items || []).map(li => ({
            name:     li.name,
            qty:      li.quantity,
            price:    li.base_price_money ? (li.base_price_money.amount / 100).toFixed(2) : "0.00"
          }))
        };
      });
      result.orders = orders;
      result.stats = {
        total:     orders.length,
        revenue:   orders.reduce((s, o) => s + parseFloat(o.total), 0).toFixed(2),
        completed: orders.filter(o => o.state === "COMPLETED").length,
        open:      orders.filter(o => o.state === "OPEN").length,
        items_sold: orders.reduce((s, o) => s + o.items.reduce((a, i) => a + parseInt(i.qty || 1), 0), 0)
      };
    }

    // ── INVENTORY ─────────────────────────────────────────────
    if (type === "inventory" || type === "all") {
      // First get all catalog items to map IDs to names
      let catalogItems = [];
      let cursor = null;
      do {
        const params = new URLSearchParams({ types: "ITEM_VARIATION", limit: "100" });
        if (cursor) params.set("cursor", cursor);
        const catRes  = await fetch(`${SQUARE_API}/catalog/list?${params}`, { headers });
        const catData = await catRes.json();
        if (catData.objects) catalogItems.push(...catData.objects);
        cursor = catData.cursor || null;
      } while (cursor);

      // Batch-retrieve inventory counts for all variation IDs
      const varIds = catalogItems.map(v => v.id);
      let inventory = [];
      if (varIds.length) {
        // Square allows max 1000 IDs per call
        for (let i = 0; i < varIds.length; i += 500) {
          const invRes = await fetch(`${SQUARE_API}/inventory/counts/batch-retrieve`, {
            method: "POST",
            headers,
            body: JSON.stringify({ catalog_object_ids: varIds.slice(i, i + 500) })
          });
          const invData = await invRes.json();
          if (invData.counts) inventory.push(...invData.counts);
        }
      }

      // Map variation ID → parent item name
      const varMap = {};
      for (const v of catalogItems) {
        const parentId = v.item_variation_data?.item_id;
        varMap[v.id] = { variationId: v.id, parentId, name: v.item_variation_data?.name || "" };
      }
      // Fetch parent item names
      const parentIds = [...new Set(catalogItems.map(v => v.item_variation_data?.item_id).filter(Boolean))];
      let parentNames = {};
      if (parentIds.length) {
        const batchRes = await fetch(`${SQUARE_API}/catalog/batch-retrieve`, {
          method: "POST",
          headers,
          body: JSON.stringify({ object_ids: parentIds })
        });
        const batchData = await batchRes.json();
        for (const obj of (batchData.objects || [])) {
          parentNames[obj.id] = obj.item_data?.name || obj.id;
        }
      }

      result.inventory = inventory.map(c => ({
        product_name: parentNames[varMap[c.catalog_object_id]?.parentId] || c.catalog_object_id,
        variation:    varMap[c.catalog_object_id]?.name || "",
        quantity:     parseInt(c.quantity || "0"),
        state:        c.state   // IN_STOCK, SOLD, etc.
      })).filter(c => c.state === "IN_STOCK")
        .sort((a, b) => a.quantity - b.quantity);
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error("Orders API error:", err);
    return res.status(500).json({ error: err.message });
  }
};
