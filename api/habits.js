import supabase, { setCors, getUid } from "./_supabase.js";

function toHabit(row) {
  return {
    _pageId: row.id,
    id:      row.id,
    name:    row.name,
    target:  row.target,
    account: row.account,
    active:  row.active,
  };
}

async function handleHabitLog(req, res, uid) {
  if (req.method === "GET") {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to required" });

    const { data, error } = await supabase.from("habit_log").select("*")
      .eq("user_id", uid)
      .gte("log_date", from)
      .lte("log_date", to);
    if (error) throw error;

    const log = {};
    for (const row of (data || [])) {
      if (!log[row.log_date]) log[row.log_date] = {};
      log[row.log_date][row.habit_id] = row.done;
    }
    return res.json(log);
  }

  if (req.method === "PATCH") {
    const { date, habitId, done } = req.body;
    if (!date || !habitId) return res.status(400).json({ error: "date and habitId required" });

    const { error } = await supabase.from("habit_log").upsert(
      { user_id: uid, habit_id: habitId, log_date: date, done: !!done },
      { onConflict: "habit_id,log_date" }
    );
    if (error) throw error;
    return res.json({ date, habitId, done: !!done });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    if (req.query.log) return handleHabitLog(req, res, uid);

    if (req.method === "GET") {
      const { data, error } = await supabase.from("habits").select("*")
        .eq("user_id", uid).order("created_at");
      if (error) throw error;
      return res.json((data || []).map(toHabit));
    }

    if (req.method === "POST") {
      const { name, target, account, active } = req.body;
      const { data: row, error } = await supabase.from("habits")
        .insert({ user_id: uid, name: name || "", target: target ?? 5, account: account || "personal", active: active ?? true })
        .select().single();
      if (error) throw error;
      return res.json(toHabit(row));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name    !== undefined) updates.name    = patch.name;
      if (patch.target  !== undefined) updates.target  = patch.target;
      if (patch.account !== undefined) updates.account = patch.account;
      if (patch.active  !== undefined) updates.active  = !!patch.active;

      const { data: row, error } = await supabase.from("habits")
        .update(updates).eq("id", id).eq("user_id", uid).select().single();
      if (error) throw error;
      return res.json(toHabit(row));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      const { error } = await supabase.from("habits").delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("habits error", err);
    return res.status(500).json({ error: err.message });
  }
}
