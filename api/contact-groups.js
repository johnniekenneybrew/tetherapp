import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

function toGroup(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    id: page.id,
    name: p.title(props.Name),
    icon: p.rich(props.Icon) || "👥",
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const pages = await queryAll(DB.CONTACT_GROUPS);
      return res.json(pages.map(toGroup));
    }

    if (req.method === "POST") {
      const { name, icon } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.CONTACT_GROUPS },
        properties: {
          Name: P.title(name),
          Icon: P.rich(icon || "👥"),
        },
      });
      return res.json(toGroup(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name !== undefined) updates.Name = P.title(patch.name);
      if (patch.icon !== undefined) updates.Icon = P.rich(patch.icon || "");

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toGroup(page));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("contact-groups error", err);
    return res.status(500).json({ error: err.message });
  }
}
