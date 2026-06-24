import supabase, { setCors, getUid } from "./_supabase.js";
import { getPref, setPref } from "./_prefs.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Accept uid from header (normal app flow) or query/body (legacy explicit pass)
    const uid = getUid(req) || req.query.userId || req.body?.userId || "";

    if (req.method === "GET") {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: "key required" });
      const value = await getPref(key, uid);
      return res.json({ value });
    }

    if (req.method === "POST") {
      const { key, value, userId } = req.body;
      if (!key) return res.status(400).json({ error: "key required" });
      const effectiveUid = uid || userId || "";
      await setPref(key, value, effectiveUid);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("prefs error", err);
    return res.status(500).json({ error: err.message });
  }
}
