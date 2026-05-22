import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

function toNote(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    id: page.id,
    contactId: p.rich(props.ContactId),
    text: p.title(props.Name),
    timestamp: p.date(props.Timestamp) || new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // GET — list notes for a contact (or all if no contactId)
    if (req.method === "GET") {
      const { contactId } = req.query;
      const filter = contactId
        ? { property: "ContactId", rich_text: { equals: contactId } }
        : undefined;
      const pages = await queryAll(DB.CONTACT_NOTES, filter, [
        { property: "Timestamp", direction: "descending" },
      ]);
      return res.json(pages.map(toNote));
    }

    // POST — create note
    if (req.method === "POST") {
      const { contactId, text, timestamp } = req.body;
      if (!contactId || !text) return res.status(400).json({ error: "contactId and text required" });
      const ts = timestamp || new Date().toISOString();
      const page = await notion.pages.create({
        parent: { database_id: DB.CONTACT_NOTES },
        properties: {
          Name:      P.title(text),
          ContactId: P.rich(contactId),
          Timestamp: P.date(ts.slice(0, 10)), // store date portion
        },
      });
      return res.json(toNote(page));
    }

    // DELETE — archive note
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
