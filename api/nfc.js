import supabase, { setCors } from "./_supabase.js";
import { getPref, setPref } from "./_prefs.js";
import crypto from "crypto";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function tapHtml(title, message, isError = false) {
  const icon = isError ? "⚠️" : "✅";
  const color = isError ? "#ef4444" : "#10b981";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #F9FAFB; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fff; border-radius: 20px; padding: 48px 32px; max-width: 360px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 64px; margin-bottom: 20px; display: block; line-height: 1; }
    h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
    p { font-size: 15px; color: #666; line-height: 1.5; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 6px; }
    .status { margin-top: 20px; font-size: 13px; color: #999; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">${icon}</span>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="status"><span class="dot"></span>${isError ? "Not logged" : "Saved"}</div>
  </div>
</body>
</html>`;
}

async function logRoutine(id, date, uid) {
  const { error } = await supabase.from("routine_log").upsert(
    { user_id: uid, routine_id: id, log_date: date, done: true },
    { onConflict: "routine_id,log_date" }
  );
  if (error) throw error;
}

async function logHabit(id, date, uid) {
  const { error } = await supabase.from("habit_log").upsert(
    { user_id: uid, habit_id: id, log_date: date, done: true },
    { onConflict: "habit_id,log_date" }
  );
  if (error) throw error;
}

async function handleTap(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const { type, id, uid, token } = req.query;

  if (!type || !id || !uid || !token) {
    return res.status(400).send(tapHtml("Invalid Link", "This NFC tag link is missing required parameters. Re-generate it in Settings.", true));
  }

  let storedToken;
  try {
    storedToken = await getPref("nfc-token", uid);
  } catch (err) {
    return res.status(500).send(tapHtml("Error", "Could not verify token. Try again.", true));
  }

  if (!storedToken || storedToken !== token) {
    return res.status(401).send(tapHtml("Invalid Token", "This NFC tag is no longer valid. Regenerate the URL in Settings.", true));
  }

  let itemName = type === "routine" ? "Routine" : "Habit";
  try {
    const items = await getPref("nfc-items", uid);
    if (Array.isArray(items)) {
      const found = items.find((i) => i.id === id && i.type === type);
      if (found) itemName = found.name;
    }
  } catch {}

  const date = todayISO();

  try {
    if (type === "routine") {
      await logRoutine(id, date, uid);
    } else if (type === "habit") {
      await logHabit(id, date, uid);
    } else {
      return res.status(400).send(tapHtml("Invalid Type", "Type must be routine or habit.", true));
    }
  } catch (err) {
    console.error("nfc tap log error", err);
    return res.status(500).send(tapHtml("Error", "Failed to log entry. Please try again.", true));
  }

  const dateStr = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  return res.status(200).send(tapHtml(itemName, `Logged for ${dateStr}`));
}

async function handleSettings(req, res) {
  setCors(res);
  const uid = req.query.uid || req.body?.uid;
  if (!uid) return res.status(400).json({ error: "uid required" });

  if (req.method === "GET") {
    const [token, items] = await Promise.all([
      getPref("nfc-token", uid),
      getPref("nfc-items", uid),
    ]);
    return res.json({ token: token || null, items: items || [] });
  }

  if (req.method === "POST") {
    const { action, items } = req.body || {};

    if (action === "regenerate") {
      const token = crypto.randomBytes(16).toString("hex");
      await setPref("nfc-token", token, uid);
      return res.json({ token });
    }

    if (items !== undefined) {
      await setPref("nfc-items", items, uid);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "action or items required" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res);
    return res.status(200).end();
  }

  try {
    if (req.query.tap) return handleTap(req, res);
    return handleSettings(req, res);
  } catch (err) {
    console.error("nfc error", err);
    if (req.query.tap) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(500).send(tapHtml("Error", err.message, true));
    }
    return res.status(500).json({ error: err.message });
  }
}
