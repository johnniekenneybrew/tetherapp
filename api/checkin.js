import supabase, { setCors, getUid } from "./_supabase.js";

function toCheckin(row) {
  return {
    _pageId:                row.id,
    date:                   row.date,
    gratitude:              row.gratitude || ["", "", ""],
    learnings:              row.learnings || ["", "", ""],
    completed:              row.completed,
    sectionsDone:           row.sections_done || {},
    habitsUpdatedConfirmed: row.habits_updated_confirmed,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") {
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: "date required" });

      const { data: existing } = await supabase.from("checkins").select("*")
        .eq("user_id", uid).eq("date", date).maybeSingle();

      if (existing) return res.json(toCheckin(existing));

      // Create new checkin for today
      const { data: created, error } = await supabase.from("checkins")
        .insert({
          user_id: uid, date,
          gratitude: ["", "", ""], learnings: ["", "", ""],
          sections_done: {}, completed: false, habits_updated_confirmed: false,
        })
        .select().single();
      if (error) throw error;
      return res.json(toCheckin(created));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.gratitude              !== undefined) updates.gratitude               = patch.gratitude;
      if (patch.learnings              !== undefined) updates.learnings               = patch.learnings;
      if (patch.completed              !== undefined) updates.completed               = !!patch.completed;
      if (patch.sectionsDone           !== undefined) updates.sections_done           = patch.sectionsDone || {};
      if (patch.habitsUpdatedConfirmed !== undefined) updates.habits_updated_confirmed = !!patch.habitsUpdatedConfirmed;

      const { data: row, error } = await supabase.from("checkins")
        .update(updates).eq("id", id).eq("user_id", uid).select().single();
      if (error) throw error;
      return res.json(toCheckin(row));
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("checkin error", err);
    return res.status(500).json({ error: err.message });
  }
}
