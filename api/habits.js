import { notion, DB, ACC_MAP, ACC_REVERSE, P, p, queryAll, setCors } from "./_notion.js";

function toHabit(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    id: page.id,
    name: p.title(props.Name),
    target: p.number(props["Target Per Week"]) ?? 5,
    account: ACC_REVERSE[p.select(props.Account)] || "personal",
    active: p.checkbox(props.Active),
    goals: p.relation(props.Goals),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const pages = await queryAll(DB.HABITS);
      return res.json(pages.map(toHabit));
    }

    if (req.method === "POST") {
      const { name, target, account, goals } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.HABITS },
        properties: {
          Name:              P.title(name),
          "Target Per Week": P.number(target ?? 5),
          Account:           P.select(ACC_MAP[account] || "Personal"),
          Active:            P.checkbox(true),
          Goals:             P.relation(goals || []),
        },
      });
      return res.json(toHabit(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name    !== undefined) updates.Name               = P.title(patch.name);
      if (patch.target  !== undefined) updates["Target Per Week"] = P.number(patch.target);
      if (patch.account !== undefined) updates.Account            = P.select(ACC_MAP[patch.account] || "Personal");
      if (patch.active  !== undefined) updates.Active             = P.checkbox(patch.active);
      if (patch.goals   !== undefined) updates.Goals              = P.relation(patch.goals || []);

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toHabit(page));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("habits error", err);
    return res.status(500).json({ error: err.message });
  }
}
