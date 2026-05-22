import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

function toNote(page) {
  const props = page.properties;
  const contactIds = p.relation(props.Contact);
  return {
    _pageId: page.id,
    id: page.id,
    contactId: contactIds[0] || null,
    text: p.title(props.Note),
    timestamp: p.date(props.Timestamp) || new Date().toISOString().slice(0, 10),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const { contactId } = req.query;
      const filter = contactId
        ? { property: "Contact", relation: { contains: contactId } }
        : undefined;
      const pages = await queryAll(DB.CONTACT_NOTES, filter, [
        { property: "Timestamp", direction: "descending" },
      ]);
      return res.json(pages.map(toNote));
    }

    if (req.method === "POST") {
      const { contactId, text, timestamp } = req.body;
      if (!contactId || !text) return res.status(400).json({ error: "contactId and text required" });
      const ts = timestamp || new Date().toISOString();
      const page = await notion.pages.create({
        parent: { database_id: DB.CONTACT_NOTES },
        properties: {
          Note:      P.title(text),
          Contact:   P.relation([contactId]),
          Timestamp: P.date(ts.slice(0, 10)),
        },
      });
      return res.json(toNote(page));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("contact-notes error", err);
    return res.status(500).json({ error: err.message });
  }
}
