import { setCors } from "./_notion.js";
import { isConnected } from "./_google-tasks.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const connected = await isConnected();
    return res.json({ connected });
  } catch (err) {
    console.error("google-status error", err);
    return res.status(500).json({ error: err.message });
  }
}
