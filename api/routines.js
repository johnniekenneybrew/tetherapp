import supabase, { setCors, getUid } from "./_supabase.js";

function toRoutine(row) {
  return {
    _pageId:   row.id,
    id:        row.id,
    name:      row.name,
    icon:      row.icon,
    useIcon:   row.use_icon,
    trackOnly: row.track_only,
    active:    row.active,
  };
}

async function handleRoutineLog(req, res, uid) {
  if (req.method === "GET") {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to required" });

    const { data, error } = await supabase.from("routine_log").select("*")
      .eq("user_id", uid)
      .gte("log_date", from)
      .lte("log_date", to);
    if (error) throw error;

    const log = {};
    for (const row of (data || [])) {
      if (!log[row.log_date]) log[row.log_date] = {};
      log[row.log_date][row.routine_id] = row.done;
    }
    return res.json(log);
  }

  if (req.method === "PATCH") {
    const { date, routineId, done } = req.body;
    if (!date || !routineId) return res.status(400).json({ error: "date and routineId required" });

    const { error } = await supabase.from("routine_log").upsert(
      { user_id: uid, routine_id: routineId, log_date: date, done: !!done },
      { onConflict: "routine_id,log_date" }
    );
    if (error) throw error;
    return res.json({ date, routineId, done: !!done });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    if (req.query.log) return handleRoutineLog(req, res, uid);

    if (req.method === "GET") {
      const { data, error } = await supabase.from("routines").select("*")
        .eq("user_id", uid).order("created_at");
      if (error) throw error;
      return res.json((data || []).map(toRoutine));
    }

    if (req.method === "POST") {
      const { name, icon, useIcon, trackOnly } = req.body;
      const { data: row, error } = await supabase.from("routines")
        .insert({
          user_id: uid, name: name || "",
          icon: icon || "✨", use_icon: useIcon ?? true,
          track_only: trackOnly ?? false, active: true,
        })
        .select().single();
      if (error) throw error;
      return res.json(toRoutine(row));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name      !== undefined) updates.name       = patch.name;
      if (patch.icon      !== undefined) updates.icon       = patch.icon || "✨";
      if (patch.useIcon   !== undefined) updates.use_icon   = !!patch.useIcon;
      if (patch.trackOnly !== undefined) updates.track_only = !!patch.trackOnly;
      if (patch.active    !== undefined) updates.active     = !!patch.active;

      const { data: row, error } = await supabase.from("routines")
        .update(updates).eq("id", id).eq("user_id", uid).select().single();
      if (error) throw error;
      return res.json(toRoutine(row));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      const { error } = await supabase.from("routines").delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("routines error", err);
    return res.status(500).json({ error: err.message });
  }
}
