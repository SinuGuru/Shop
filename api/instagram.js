// ============================================================
//  api/instagram.js — Auto-post to Instagram (Vercel serverless)
//  Uses Instagram Graph API (requires Facebook Business setup)
// ============================================================

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") return res.status(405).end();

  const { imageUrl, caption } = req.body || {};
  if (!imageUrl || !caption) {
    return res.status(400).json({ error: "imageUrl and caption required" });
  }

  const igUserId   = process.env.INSTAGRAM_USER_ID;    // Your Instagram User ID
  const igToken    = process.env.INSTAGRAM_TOKEN;      // Long-lived access token

  if (!igUserId || !igToken) {
    return res.status(500).json({
      error: "Instagram not configured",
      setup: "Add INSTAGRAM_USER_ID and INSTAGRAM_TOKEN to Vercel environment variables"
    });
  }

  try {
    // Step 1: Create media container
    const createRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media` +
      `?image_url=${encodeURIComponent(imageUrl)}` +
      `&caption=${encodeURIComponent(caption)}` +
      `&access_token=${igToken}`,
      { method: "POST" }
    );
    const createData = await createRes.json();
    if (createData.error) throw new Error(createData.error.message);

    const containerId = createData.id;

    // Step 2: Wait for container to process (Instagram needs a moment)
    await new Promise(r => setTimeout(r, 3000));

    // Step 3: Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media_publish` +
      `?creation_id=${containerId}` +
      `&access_token=${igToken}`,
      { method: "POST" }
    );
    const publishData = await publishRes.json();
    if (publishData.error) throw new Error(publishData.error.message);

    return res.status(200).json({
      ok:      true,
      post_id: publishData.id,
      message: "Posted to Instagram successfully!"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
