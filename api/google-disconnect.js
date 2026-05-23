import { setCors } from "./_notion.js";
import { clearRefreshToken } from "./_google-tasks.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    await clearRefreshToken();
    return res.json({ ok: true });
  } catch (err) {
    console.error("google-disconnect error", err);
    return res.status(500).json({ error: err.message });
  }
}
