// api/creative-image.js
// Proxies Runway Gen-4 Image generation (text-to-image)
// POST { prompt, ratio, runwayKey }
// Polls until complete, returns { imageUrl }

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";

function runwayHeaders(key) {
  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    "X-Runway-Version": "2024-11-06"
  };
}

async function poll(taskId, key, attempts = 0) {
  if (attempts > 40) throw new Error("Image generation timed out. Please try again.");
  const res  = await fetch(`${RUNWAY_BASE}/tasks/${taskId}`, { headers: runwayHeaders(key) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Task fetch failed");
  if (data.status === "FAILED")    throw new Error(data.failure || "Generation failed");
  if (data.status === "SUCCEEDED") return data.output?.[0] || null;
  // Still running — wait 2s and retry
  await new Promise(r => setTimeout(r, 2000));
  return poll(taskId, key, attempts + 1);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { prompt, ratio = "1024:1024", runwayKey } = req.body;
  if (!runwayKey)  return res.status(400).json({ error: "Missing Runway API key" });
  if (!prompt)     return res.status(400).json({ error: "Missing prompt" });

  try {
    // Start task
    const startRes  = await fetch(`${RUNWAY_BASE}/text_to_image`, {
      method: "POST",
      headers: runwayHeaders(runwayKey),
      body: JSON.stringify({
        promptText:   prompt,
        model:        "gen4_image",
        ratio,
        outputFormat: "jpeg"
      })
    });
    const startData = await startRes.json();
    if (!startRes.ok) throw new Error(startData.message || JSON.stringify(startData));

    const taskId = startData.id;
    if (!taskId) throw new Error("No task ID returned");

    // Poll until done (server-side, images are fast ~5-15s)
    const imageUrl = await poll(taskId, runwayKey);
    if (!imageUrl) throw new Error("No image URL in response");

    return res.status(200).json({ imageUrl, taskId });
  } catch (err) {
    console.error("creative-image error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
