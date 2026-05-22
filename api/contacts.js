import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

function toContact(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    id: page.id,
    name: p.title(props.Name),
    city: p.rich(props.City) || "",
    birthday: p.date(props.Birthday) || null,
    group: p.rich(props.GroupId) || "",
    lastSeen: p.rich(props.LastSeen) || "",
    giftIdeas: p.rich(props.GiftIdeas) || "",
    tags: (() => {
      try { return JSON.parse(p.rich(props.Tags) || "[]"); } catch { return []; }
    })(),
    // Notes are stored in a separate DB; seed empty array, to be hydrated client-side
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
          Name:      P.title(name),
          City:      P.rich(city || ""),
          Birthday:  P.date(birthday || null),
          GroupId:   P.rich(group || ""),
          LastSeen:  P.rich(lastSeen || ""),
          GiftIdeas: P.rich(giftIdeas || ""),
          Tags:      P.rich(JSON.stringify(tags || [])),
        },
      });
      return res.json(toContact(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name      !== undefined) updates.Name      = P.title(patch.name);
      if (patch.city      !== undefined) updates.City      = P.rich(patch.city || "");
      if (patch.birthday  !== undefined) updates.Birthday  = P.date(patch.birthday || null);
      if (patch.group     !== undefined) updates.GroupId   = P.rich(patch.group || "");
      if (patch.lastSeen  !== undefined) updates.LastSeen  = P.rich(patch.lastSeen || "");
      if (patch.giftIdeas !== undefined) updates.GiftIdeas = P.rich(patch.giftIdeas || "");
      if (patch.tags      !== undefined) updates.Tags      = P.rich(JSON.stringify(patch.tags || []));

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
