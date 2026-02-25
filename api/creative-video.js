// api/creative-video.js
// Starts a Runway Gen-4 Turbo text-to-video task and returns taskId.
// The client polls /api/creative-task to check status.
// POST { prompt, ratio, duration, runwayKey }

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const runwayKey = process.env.RUNWAY_API_KEY;
  if (!runwayKey) return res.status(500).json({ error: "RUNWAY_API_KEY not configured on server" });

  const { prompt, ratio = "1280:720", duration = 5 } = req.body;
  if (!prompt)    return res.status(400).json({ error: "Missing prompt" });

  try {
    const startRes  = await fetch(`${RUNWAY_BASE}/text_to_video`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${runwayKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06"
      },
      body: JSON.stringify({
        promptText: prompt,
        model:      "gen4_turbo",
        ratio,
        duration:   parseInt(duration)
      })
    });

    const data = await startRes.json();
    if (!startRes.ok) throw new Error(data.message || JSON.stringify(data));
    if (!data.id) throw new Error("No task ID returned from Runway");

    return res.status(200).json({ taskId: data.id, status: data.status || "PENDING" });
  } catch (err) {
    console.error("creative-video error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
