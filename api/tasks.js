import { notion, DB, ACC_MAP, ACC_REVERSE, P, p, queryAll, setCors } from "./_notion.js";

// ============================================================
// Map Notion page -> app task object
// ============================================================
function toTask(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    id: page.id,
    title: p.title(props.Name),
    account: ACC_REVERSE[p.select(props.Account)] || "personal",
    done: p.checkbox(props.Done),
    priority: p.checkbox(props.Priority),
    details: p.rich(props.Details) || null,
    due: p.number(props.DueDays),
    completedDay: p.rich(props.CompletedDay) || null,
    completedAgo: p.rich(props.CompletedAgo) || null,
    subtasks: (() => {
      try { return JSON.parse(p.rich(props.Subtasks) || "[]"); } catch { return []; }
    })(),
  };
}

// ============================================================
// Handler
// ============================================================
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // GET — list all tasks
    if (req.method === "GET") {
      const pages = await queryAll(DB.TASKS);
      return res.json(pages.map(toTask));
    }

    // POST — create task
    if (req.method === "POST") {
      const { title, account, done, priority, details, due, subtasks } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.TASKS },
        properties: {
          Name:         P.title(title),
          Account:      P.select(ACC_MAP[account] || "Personal"),
          Done:         P.checkbox(done),
          Priority:     P.checkbox(priority),
          Details:      P.rich(details || ""),
          DueDays:      P.number(due ?? null),
          CompletedDay: P.rich(""),
          CompletedAgo: P.rich(""),
          Subtasks:     P.rich(JSON.stringify(subtasks || [])),
        },
      });
      return res.json(toTask(page));
    }

    // PATCH — update task
    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.title     !== undefined) updates.Name         = P.title(patch.title);
      if (patch.account   !== undefined) updates.Account      = P.select(ACC_MAP[patch.account] || "Personal");
      if (patch.done      !== undefined) updates.Done         = P.checkbox(patch.done);
      if (patch.priority  !== undefined) updates.Priority     = P.checkbox(patch.priority);
      if (patch.details   !== undefined) updates.Details      = P.rich(patch.details || "");
      if (patch.due       !== undefined) updates.DueDays      = P.number(patch.due ?? null);
      if (patch.completedDay !== undefined) updates.CompletedDay = P.rich(patch.completedDay || "");
      if (patch.completedAgo !== undefined) updates.CompletedAgo = P.rich(patch.completedAgo || "");
      if (patch.subtasks  !== undefined) updates.Subtasks     = P.rich(JSON.stringify(patch.subtasks || []));

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toTask(page));
    }

    // DELETE — archive task
    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("tasks error", err);
    return res.status(500).json({ error: err.message });
  }
}
