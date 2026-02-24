// ============================================================
//  api/webhook.js — Square order notification (Vercel serverless)
//  Square calls this URL when an order is placed
//  Sends an email notification via Gmail SMTP (nodemailer)
// ============================================================

import nodemailer from "nodemailer";
import crypto    from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Verify Square webhook signature (security)
  const signature    = req.headers["x-square-hmacsha256-signature"];
  const webhookUrl   = process.env.WEBHOOK_URL;        // your full Vercel URL e.g. https://yourapp.vercel.app/api/webhook
  const squareSigKey = process.env.SQUARE_WEBHOOK_SIG; // from Square Developer Dashboard

  if (squareSigKey && signature && webhookUrl) {
    const body = JSON.stringify(req.body);
    const hmac = crypto.createHmac("sha256", squareSigKey)
      .update(webhookUrl + body)
      .digest("base64");
    if (hmac !== signature) {
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  const event = req.body;
  const type  = event?.type || "";

  // Only handle completed orders
  if (!type.includes("order") && !type.includes("payment")) {
    return res.status(200).json({ ok: true, skipped: type });
  }

  // Extract order details
  const order    = event?.data?.object?.order || event?.data?.object?.payment || {};
  const amount   = order.total_money
    ? `£${(order.total_money.amount / 100).toFixed(2)}`
    : "£6.00";
  const buyer    = order.fulfillments?.[0]?.shipment_details?.recipient?.display_name
                || order.buyer_email_address
                || "Customer";
  const itemList = (order.line_items || [])
    .map(i => `• ${i.name} × ${i.quantity}`)
    .join("\n") || "Items not listed";
  const orderId  = order.id || "N/A";
  const time     = new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });

  // Send email
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD; // Gmail App Password (not regular password)
  const notifyTo  = process.env.NOTIFY_EMAIL || gmailUser;

  if (!gmailUser || !gmailPass) {
    console.log("Email not configured — order received:", orderId);
    return res.status(200).json({ ok: true, note: "email not configured" });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass }
  });

  await transporter.sendMail({
    from:    `"VeronikaK Shop" <${gmailUser}>`,
    to:      notifyTo,
    subject: `🛍️ New Order! ${amount} — ${buyer}`,
    text: `
🌸 NEW ORDER — VeronikaK
========================
Time:     ${time}
Buyer:    ${buyer}
Amount:   ${amount}
Order ID: ${orderId}

Items:
${itemList}

View in Square: https://squareup.com/dashboard/orders
`.trim(),
    html: `
<div style="font-family:sans-serif;max-width:500px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#1a1a2e,#e91e8c);padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <h2 style="color:#fff;margin:0">🌸 New Order!</h2>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #eee;border-radius:0 0 12px 12px">
    <p><strong>Buyer:</strong> ${buyer}</p>
    <p><strong>Amount:</strong> <span style="color:#e91e8c;font-size:1.3rem;font-weight:700">${amount}</span></p>
    <p><strong>Time:</strong> ${time}</p>
    <p><strong>Order ID:</strong> <code>${orderId}</code></p>
    <hr/>
    <p><strong>Items:</strong></p>
    <pre style="background:#f9f9f9;padding:12px;border-radius:8px">${itemList}</pre>
    <a href="https://squareup.com/dashboard/orders"
       style="display:inline-block;background:linear-gradient(135deg,#1a1a2e,#e91e8c);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:12px">
      View in Square Dashboard
    </a>
  </div>
</div>`
  });

  return res.status(200).json({ ok: true });
}
