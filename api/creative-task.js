// api/creative-task.js
// Poll a Runway task by ID.
// GET ?taskId=xxx  — runwayKey sent as Authorization header
// Returns { status, output: [url], progress }

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";

module.exports = async function handler(req, res) {
  const { taskId } = req.query;
  const runwayKey  = process.env.RUNWAY_API_KEY;
  if (!taskId)    return res.status(400).json({ error: "Missing taskId" });
  if (!runwayKey) return res.status(500).json({ error: "RUNWAY_API_KEY not configured on server" });

  try {
    const r    = await fetch(`${RUNWAY_BASE}/tasks/${taskId}`, {
      headers: {
        "Authorization": `Bearer ${runwayKey}`,
        "X-Runway-Version": "2024-11-06"
      }
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Task fetch failed");

    return res.status(200).json({
      status:   data.status,
      output:   data.output || [],
      progress: data.progress || null,
      failure:  data.failure  || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
