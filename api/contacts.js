import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

// Auto-add new properties on first call
let schemaReady = false;
async function ensureContactSchema() {
  if (schemaReady) return;
  try {
    const db = await notion.databases.retrieve({ database_id: DB.CONTACTS });
    const updates = {};
    if (!db.properties.From)             updates.From              = { rich_text: {} };
    if (!db.properties.Context)          updates.Context           = { rich_text: {} };
    if (!db.properties["Linked Contacts"]) updates["Linked Contacts"] = { rich_text: {} };
    if (Object.keys(updates).length > 0) {
      await notion.databases.update({ database_id: DB.CONTACTS, properties: updates });
    }
    schemaReady = true;
  } catch (e) {
    console.error("ensureContactSchema failed", e);
    schemaReady = true;
  }
}

function parseLinked(raw) {
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

function toContact(page) {
  const props = page.properties;
  return {
    _pageId:        page.id,
    id:             page.id,
    name:           p.title(props.Name),
    from:           p.rich(props.From) || "",
    city:           p.rich(props.City) || "",
    birthday:       p.date(props.Birthday) || null,
    groups:         p.relation(props.Group),
    lastSeen:       p.rich(props["Last Seen"]) || "",
    giftIdeas:      p.rich(props["Gift Ideas"]) || "",
    tags:           p.mselect(props.Tags),
    context:        p.rich(props.Context) || "",
    linkedContacts: parseLinked(p.rich(props["Linked Contacts"])),
    notes: [],
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await ensureContactSchema();

    if (req.method === "GET") {
      const pages = await queryAll(DB.CONTACTS);
      return res.json(pages.map(toContact));
    }

    if (req.method === "POST") {
      const { name, from, city, birthday, groups, lastSeen, giftIdeas, tags, context, linkedContacts } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.CONTACTS },
        properties: {
          Name:               P.title(name),
          From:               P.rich(from || ""),
          City:               P.rich(city || ""),
          Birthday:           P.date(birthday || null),
          Group:              P.relation(groups || []),
          "Last Seen":        P.rich(lastSeen || ""),
          "Gift Ideas":       P.rich(giftIdeas || ""),
          Tags:               P.mselect(tags || []),
          Context:            P.rich(context || ""),
          "Linked Contacts":  P.rich(JSON.stringify(linkedContacts || [])),
        },
      });
      return res.json(toContact(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name           !== undefined) updates.Name              = P.title(patch.name);
      if (patch.from           !== undefined) updates.From              = P.rich(patch.from || "");
      if (patch.city           !== undefined) updates.City              = P.rich(patch.city || "");
      if (patch.birthday       !== undefined) updates.Birthday          = P.date(patch.birthday || null);
      if (patch.groups         !== undefined) updates.Group             = P.relation(patch.groups || []);
      if (patch.lastSeen       !== undefined) updates["Last Seen"]      = P.rich(patch.lastSeen || "");
      if (patch.giftIdeas      !== undefined) updates["Gift Ideas"]     = P.rich(patch.giftIdeas || "");
      if (patch.tags           !== undefined) updates.Tags              = P.mselect(patch.tags || []);
      if (patch.context        !== undefined) updates.Context           = P.rich(patch.context || "");
      if (patch.linkedContacts !== undefined) updates["Linked Contacts"] = P.rich(JSON.stringify(patch.linkedContacts || []));

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
