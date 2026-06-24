import supabase, { setCors, getUid } from "./_supabase.js";

function toGoal(row, habitIds = [], taskIds = []) {
  return {
    _pageId:     row.id,
    id:          row.id,
    name:        row.name,
    description: row.description,
    kpi:         row.kpi,
    status:      row.status,
    account:     row.account,
    target:      row.target_date || null,
    habitIds,
    taskIds,
  };
}

function toGoalTask(row) {
  return {
    _pageId: row.id,
    id:      row.id,
    name:    row.name,
    done:    row.done,
  };
}

async function handleGoalTasks(req, res, uid) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("goal_tasks")
      .select("*").eq("user_id", uid).order("created_at");
    if (error) throw error;
    return res.json((data || []).map(toGoalTask));
  }

  if (req.method === "POST") {
    const { name, goalId } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name required" });
    const { data: row, error } = await supabase.from("goal_tasks")
      .insert({ user_id: uid, name: name.trim(), done: false, goal_id: goalId || null })
      .select().single();
    if (error) throw error;
    return res.json(toGoalTask(row));
  }

  if (req.method === "PATCH") {
    const { id, ...patch } = req.body;
    if (!id) return res.status(400).json({ error: "id required" });
    const updates = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.done !== undefined) updates.done = !!patch.done;
    const { data: row, error } = await supabase.from("goal_tasks")
      .update(updates).eq("id", id).eq("user_id", uid).select().single();
    if (error) throw error;
    return res.json(toGoalTask(row));
  }

  if (req.method === "DELETE") {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "id required" });
    const { error } = await supabase.from("goal_tasks")
      .delete().eq("id", id).eq("user_id", uid);
    if (error) throw error;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    if (req.query.tasks) return handleGoalTasks(req, res, uid);

    if (req.method === "GET") {
      const { data: goals, error: goalsErr } = await supabase.from("goals")
        .select("*").eq("user_id", uid).order("created_at");
      if (goalsErr) throw goalsErr;

      if (!goals?.length) return res.json([]);

      const goalIds = goals.map((g) => g.id);
      const [{ data: links }, { data: tasks }] = await Promise.all([
        supabase.from("goal_habit_links").select("goal_id, habit_id").in("goal_id", goalIds),
        supabase.from("goal_tasks").select("id, goal_id").eq("user_id", uid).in("goal_id", goalIds),
      ]);

      const habitIdsByGoal = {};
      for (const link of (links || [])) {
        if (!habitIdsByGoal[link.goal_id]) habitIdsByGoal[link.goal_id] = [];
        habitIdsByGoal[link.goal_id].push(link.habit_id);
      }

      const taskIdsByGoal = {};
      for (const task of (tasks || [])) {
        if (task.goal_id) {
          if (!taskIdsByGoal[task.goal_id]) taskIdsByGoal[task.goal_id] = [];
          taskIdsByGoal[task.goal_id].push(task.id);
        }
      }

      return res.json(goals.map((g) =>
        toGoal(g, habitIdsByGoal[g.id] || [], taskIdsByGoal[g.id] || [])
      ));
    }

    if (req.method === "POST") {
      const { name, description, kpi, status, account, target, habitIds, taskIds } = req.body;
      const { data: row, error } = await supabase.from("goals")
        .insert({
          user_id: uid, name: name || "", description: description || "",
          kpi: kpi || "", status: status || "in-progress",
          account: account || "personal", target_date: target || null,
        })
        .select().single();
      if (error) throw error;

      if (habitIds?.length > 0) {
        await supabase.from("goal_habit_links")
          .insert(habitIds.map((hid) => ({ goal_id: row.id, habit_id: hid })));
      }

      if (taskIds?.length > 0) {
        await supabase.from("goal_tasks").update({ goal_id: row.id })
          .in("id", taskIds).eq("user_id", uid);
      }

      return res.json(toGoal(row, habitIds || [], taskIds || []));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name        !== undefined) updates.name        = patch.name;
      if (patch.description !== undefined) updates.description = patch.description || "";
      if (patch.kpi         !== undefined) updates.kpi         = patch.kpi || "";
      if (patch.status      !== undefined) updates.status      = patch.status;
      if (patch.account     !== undefined) updates.account     = patch.account;
      if (patch.target      !== undefined) updates.target_date = patch.target || null;

      let row;
      if (Object.keys(updates).length > 0) {
        const { data, error } = await supabase.from("goals")
          .update(updates).eq("id", id).eq("user_id", uid).select().single();
        if (error) throw error;
        row = data;
      } else {
        const { data, error } = await supabase.from("goals")
          .select("*").eq("id", id).eq("user_id", uid).single();
        if (error) throw error;
        row = data;
      }

      if (patch.habitIds !== undefined) {
        await supabase.from("goal_habit_links").delete().eq("goal_id", id);
        if (patch.habitIds.length > 0) {
          await supabase.from("goal_habit_links")
            .insert(patch.habitIds.map((hid) => ({ goal_id: id, habit_id: hid })));
        }
      }

      if (patch.taskIds !== undefined) {
        await supabase.from("goal_tasks").update({ goal_id: null })
          .eq("goal_id", id).eq("user_id", uid);
        if (patch.taskIds.length > 0) {
          await supabase.from("goal_tasks").update({ goal_id: id })
            .in("id", patch.taskIds).eq("user_id", uid);
        }
      }

      // Return fresh link counts
      const [{ data: links }, { data: tasks }] = await Promise.all([
        supabase.from("goal_habit_links").select("habit_id").eq("goal_id", id),
        supabase.from("goal_tasks").select("id").eq("goal_id", id).eq("user_id", uid),
      ]);

      return res.json(toGoal(
        row,
        (links || []).map((l) => l.habit_id),
        (tasks || []).map((t) => t.id),
      ));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      const { error } = await supabase.from("goals")
        .delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("goals error", err);
    return res.status(500).json({ error: err.message });
  }
}
