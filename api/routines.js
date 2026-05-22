import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

function toRoutine(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    id: page.id,
    name: p.title(props.Name),
    icon: p.rich(props.Icon) || "✨",
    useIcon: p.checkbox(props["Use Icon"]),
    trackOnly: p.checkbox(props["Track Only"]),
    active: p.checkbox(props.Active),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const pages = await queryAll(DB.ROUTINES);
      return res.json(pages.map(toRoutine));
    }

    if (req.method === "POST") {
      const { name, icon, useIcon, trackOnly } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.ROUTINES },
        properties: {
          Name:         P.title(name),
          Icon:         P.rich(icon || "✨"),
          "Use Icon":   P.checkbox(useIcon ?? true),
          "Track Only": P.checkbox(trackOnly ?? false),
          Active:       P.checkbox(true),
        },
      });
      return res.json(toRoutine(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name      !== undefined) updates.Name           = P.title(patch.name);
      if (patch.icon      !== undefined) updates.Icon           = P.rich(patch.icon || "");
      if (patch.useIcon   !== undefined) updates["Use Icon"]    = P.checkbox(patch.useIcon);
      if (patch.trackOnly !== undefined) updates["Track Only"]  = P.checkbox(patch.trackOnly);
      if (patch.active    !== undefined) updates.Active         = P.checkbox(patch.active);

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toRoutine(page));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("routines error", err);
    return res.status(500).json({ error: err.message });
  }
}
