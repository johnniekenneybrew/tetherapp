import { notion, DB, ACC_MAP, ACC_REVERSE, P, p, queryAll, setCors } from "./_notion.js";

const TODAY_ISO = "2026-05-22";
const TODAY_MS = new Date(2026, 4, 22).getTime();

function isoToDue(iso) {
  if (!iso) return null;
  const ms = new Date(iso + "T12:00:00").getTime();
  return Math.round((ms - TODAY_MS) / 86400000);
}

function dueToIso(days) {
  if (days == null) return null;
  const d = new Date(TODAY_MS + days * 86400000);
  return d.toISOString().slice(0, 10);
}

function completedDayLabel(iso) {
  if (!iso) return null;
  if (iso === TODAY_ISO) return "today";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(iso + "T12:00:00").getDay()];
}

function toTask(page, subtasksMap) {
  const props = page.properties;
  const completedDate = p.date(props["Completed Date"]);
  return {
    _pageId: page.id,
    id: page.id,
    title: p.title(props.Title),
    account: ACC_REVERSE[p.select(props.Account)] || "personal",
    done: p.checkbox(props.Done),
    priority: p.checkbox(props.Priority),
    details: p.rich(props.Details) || null,
    due: isoToDue(p.date(props["Due Date"])),
    completedDay: completedDayLabel(completedDate),
    completedAgo: null,
    subtasks: subtasksMap ? (subtasksMap[page.id] || []) : [],
    _parentIds: p.relation(props["Parent Task"]),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const pages = await queryAll(DB.TASKS);

      // Build subtask map: parentId -> [{ id, text, done }]
      const subtasksMap = {};
      for (const page of pages) {
        const parentIds = p.relation(page.properties["Parent Task"]);
        if (parentIds.length > 0) {
          const parentId = parentIds[0];
          if (!subtasksMap[parentId]) subtasksMap[parentId] = [];
          subtasksMap[parentId].push({
            id: page.id,
            text: p.title(page.properties.Title),
            done: p.checkbox(page.properties.Done),
          });
        }
      }

      // Return only top-level tasks (no parent)
      const result = pages
        .filter(page => p.relation(page.properties["Parent Task"]).length === 0)
        .map(page => {
          const t = toTask(page, subtasksMap);
          delete t._parentIds;
          return t;
        });

      return res.json(result);
    }

    if (req.method === "POST") {
      const { title, account, done, priority, details, due } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.TASKS },
        properties: {
          Title:      P.title(title),
          Account:    P.select(ACC_MAP[account] || "Personal"),
          Done:       P.checkbox(done ?? false),
          Priority:   P.checkbox(priority ?? false),
          Details:    P.rich(details || ""),
          "Due Date": P.date(dueToIso(due)),
        },
      });
      const t = toTask(page, {});
      delete t._parentIds;
      return res.json(t);
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.title    !== undefined) updates.Title      = P.title(patch.title);
      if (patch.account  !== undefined) updates.Account    = P.select(ACC_MAP[patch.account] || "Personal");
      if (patch.done     !== undefined) updates.Done       = P.checkbox(patch.done);
      if (patch.priority !== undefined) updates.Priority   = P.checkbox(patch.priority);
      if (patch.details  !== undefined) updates.Details    = P.rich(patch.details || "");
      if (patch.due      !== undefined) updates["Due Date"] = P.date(dueToIso(patch.due));
      if (patch.completedDay !== undefined) {
        updates["Completed Date"] = P.date(patch.completedDay === "today" ? TODAY_ISO : null);
      }
      // subtasks patch: skip Notion sync (managed via Parent Task relation)

      const page = await notion.pages.update({ page_id: id, properties: updates });
      const t = toTask(page, null);
      delete t._parentIds;
      return res.json(t);
    }

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
