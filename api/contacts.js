import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

function toContact(page) {
  const props = page.properties;
  const groupIds = p.relation(props.Group);
  return {
    _pageId: page.id,
    id: page.id,
    name: p.title(props.Name),
    city: p.rich(props.City) || "",
    birthday: p.date(props.Birthday) || null,
    group: groupIds[0] || "",
    lastSeen: p.rich(props["Last Seen"]) || "",
    giftIdeas: p.rich(props["Gift Ideas"]) || "",
    tags: p.mselect(props.Tags),
    notes: [],
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const pages = await queryAll(DB.CONTACTS);
      return res.json(pages.map(toContact));
    }

    if (req.method === "POST") {
      const { name, city, birthday, group, lastSeen, giftIdeas, tags } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.CONTACTS },
        properties: {
          Name:         P.title(name),
          City:         P.rich(city || ""),
          Birthday:     P.date(birthday || null),
          Group:        P.relation(group ? [group] : []),
          "Last Seen":  P.rich(lastSeen || ""),
          "Gift Ideas": P.rich(giftIdeas || ""),
          Tags:         P.mselect(tags || []),
        },
      });
      return res.json(toContact(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name      !== undefined) updates.Name          = P.title(patch.name);
      if (patch.city      !== undefined) updates.City          = P.rich(patch.city || "");
      if (patch.birthday  !== undefined) updates.Birthday      = P.date(patch.birthday || null);
      if (patch.group     !== undefined) updates.Group         = P.relation(patch.group ? [patch.group] : []);
      if (patch.lastSeen  !== undefined) updates["Last Seen"]  = P.rich(patch.lastSeen || "");
      if (patch.giftIdeas !== undefined) updates["Gift Ideas"] = P.rich(patch.giftIdeas || "");
      if (patch.tags      !== undefined) updates.Tags          = P.mselect(patch.tags || []);

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toContact(page));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("contacts error", err);
    return res.status(500).json({ error: err.message });
  }
}
