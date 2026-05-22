import { notion, DB, ACC_MAP, ACC_REVERSE, P, p, queryAll, setCors } from "./_notion.js";

// Goal status mapping
const STATUS_MAP = {
  "in-progress": "In Progress",
  "completed":   "Completed",
};
const STATUS_REVERSE = Object.fromEntries(Object.entries(STATUS_MAP).map(([k, v]) => [v, k]));

function toGoal(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    id: page.id,
    name: p.title(props.Name),
    description: p.rich(props.Description) || "",
    status: STATUS_REVERSE[p.select(props.Status)] || "in-progress",
    account: ACC_REVERSE[p.select(props.Account)] || "personal",
    target: p.rich(props.Target) || null,
    weekPct: p.number(props.WeekPct) ?? 0,
    prevPct: p.number(props.PrevPct) ?? 0,
    habitIds: (() => {
      try { return JSON.parse(p.rich(props.HabitIds) || "[]"); } catch { return []; }
    })(),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const pages = await queryAll(DB.GOALS);
      return res.json(pages.map(toGoal));
    }

    if (req.method === "POST") {
      const { name, description, status, account, target, weekPct, prevPct, habitIds } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.GOALS },
        properties: {
          Name:        P.title(name),
          Description: P.rich(description || ""),
          Status:      P.select(STATUS_MAP[status] || "In Progress"),
          Account:     P.select(ACC_MAP[account] || "Personal"),
          Target:      P.rich(target || ""),
          WeekPct:     P.number(weekPct ?? 0),
          PrevPct:     P.number(prevPct ?? 0),
          HabitIds:    P.rich(JSON.stringify(habitIds || [])),
        },
      });
      return res.json(toGoal(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name        !== undefined) updates.Name        = P.title(patch.name);
      if (patch.description !== undefined) updates.Description = P.rich(patch.description || "");
      if (patch.status      !== undefined) updates.Status      = P.select(STATUS_MAP[patch.status] || "In Progress");
      if (patch.account     !== undefined) updates.Account     = P.select(ACC_MAP[patch.account] || "Personal");
      if (patch.target      !== undefined) updates.Target      = P.rich(patch.target || "");
      if (patch.weekPct     !== undefined) updates.WeekPct     = P.number(patch.weekPct ?? 0);
      if (patch.prevPct     !== undefined) updates.PrevPct     = P.number(patch.prevPct ?? 0);
      if (patch.habitIds    !== undefined) updates.HabitIds    = P.rich(JSON.stringify(patch.habitIds || []));

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
