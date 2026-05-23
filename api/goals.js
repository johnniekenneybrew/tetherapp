import { notion, DB, ACC_MAP, ACC_REVERSE, P, p, queryAll, setCors } from "./_notion.js";
import { getGoalTasksDbId } from "./_goal-tasks-db.js";

const STATUS_MAP = {
  "in-progress": "In Progress",
  "completed":   "Completed",
};
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, k]));

// Ensure Goals DB has KPI and GoalTasks properties
let schemaReady = false;
async function ensureGoalSchema() {
  if (schemaReady) return;
  try {
    const [db, goalTasksDbId] = await Promise.all([
      notion.databases.retrieve({ database_id: DB.GOALS }),
      getGoalTasksDbId().catch(() => null),
    ]);
    const updates = {};
    if (!db.properties.KPI) updates.KPI = { rich_text: {} };
    if (!db.properties.GoalTasks && goalTasksDbId) {
      updates.GoalTasks = { relation: { database_id: goalTasksDbId, single_property: {} } };
    }
    if (Object.keys(updates).length > 0) {
      await notion.databases.update({ database_id: DB.GOALS, properties: updates });
    }
    schemaReady = true;
  } catch (e) {
    console.error("ensureGoalSchema failed", e);
    schemaReady = true;
  }
}

function toGoal(page) {
  const props = page.properties;
  return {
    _pageId:  page.id,
    id:       page.id,
    name:     p.title(props.Name),
    description: p.rich(props.Description) || "",
    kpi:      p.rich(props.KPI) || "",
    status:   STATUS_REVERSE[p.select(props.Status)] || "in-progress",
    account:  ACC_REVERSE[p.select(props.Account)] || "personal",
    target:   p.date(props["Target Date"]) || null,
    habitIds: p.relation(props.Habits),
    taskIds:  p.relation(props.GoalTasks),
  };
}

// ── Goal Tasks (merged to stay under Vercel Hobby 12-function limit) ─────────

function toGoalTask(page) {
  return {
    _pageId: page.id,
    id:      page.id,
    name:    p.title(page.properties.Name),
    done:    p.checkbox(page.properties.Done),
  };
}

async function handleGoalTasks(req, res) {
  const dbId = await getGoalTasksDbId();
  if (req.method === "GET") {
    const [active, done] = await Promise.all([
      queryAll(dbId, { property: "Done", checkbox: { equals: false } }),
      queryAll(dbId, { property: "Done", checkbox: { equals: true } }),
    ]);
    return res.json([...active, ...done].map(toGoalTask));
  }
  if (req.method === "POST") {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name required" });
    const page = await notion.pages.create({
      parent: { database_id: dbId },
      properties: { Name: P.title(name.trim()), Done: P.checkbox(false) },
    });
    return res.json(toGoalTask(page));
  }
  if (req.method === "PATCH") {
    const { id, ...patch } = req.body;
    if (!id) return res.status(400).json({ error: "id required" });
    const updates = {};
    if (patch.name !== undefined) updates.Name = P.title(patch.name);
    if (patch.done !== undefined) updates.Done = P.checkbox(!!patch.done);
    const page = await notion.pages.update({ page_id: id, properties: updates });
    return res.json(toGoalTask(page));
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "id required" });
    await notion.pages.update({ page_id: id, archived: true });
    return res.json({ ok: true });
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.query.tasks) return handleGoalTasks(req, res);

    await ensureGoalSchema();

    if (req.method === "GET") {
      const pages = await queryAll(DB.GOALS);
      return res.json(pages.map(toGoal));
    }

    if (req.method === "POST") {
      const { name, description, kpi, status, account, target, habitIds, taskIds } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.GOALS },
        properties: {
          Name:          P.title(name),
          Description:   P.rich(description || ""),
          KPI:           P.rich(kpi || ""),
          Status:        P.select(STATUS_MAP[status] || "In Progress"),
          Account:       P.select(ACC_MAP[account] || "Personal"),
          "Target Date": P.date(target || null),
          Habits:        P.relation(habitIds || []),
          GoalTasks:     P.relation(taskIds || []),
        },
      });
      return res.json(toGoal(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name        !== undefined) updates.Name           = P.title(patch.name);
      if (patch.description !== undefined) updates.Description    = P.rich(patch.description || "");
      if (patch.kpi         !== undefined) updates.KPI            = P.rich(patch.kpi || "");
      if (patch.status      !== undefined) updates.Status         = P.select(STATUS_MAP[patch.status] || "In Progress");
      if (patch.account     !== undefined) updates.Account        = P.select(ACC_MAP[patch.account] || "Personal");
      if (patch.target      !== undefined) updates["Target Date"] = P.date(patch.target || null);
      if (patch.habitIds    !== undefined) updates.Habits         = P.relation(patch.habitIds || []);
      if (patch.taskIds     !== undefined) updates.GoalTasks      = P.relation(patch.taskIds || []);

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toGoal(page));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("goals error", err);
    return res.status(500).json({ error: err.message });
  }
}
