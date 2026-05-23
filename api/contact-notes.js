import {
  getContact, updateContact, isConnected,
  getCustomField, setCustomField
} from "./_google-people.js";
import { setCors } from "./_notion.js";

function toNote(contactId, noteKey, noteValue) {
  // noteKey format: "note_TIMESTAMP"
  // noteValue format: JSON string { text, timestamp } or plain text (for migration)
  let parsed;
  try {
    parsed = typeof noteValue === "string" ? JSON.parse(noteValue) : noteValue;
  } catch {
    parsed = { text: noteValue, timestamp: new Date().toISOString() };
  }

  return {
    id: noteKey,
    contactId,
    text: parsed.text || parsed,
    timestamp: parsed.timestamp || new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const connected = await isConnected();
    if (!connected) return res.status(401).json({ error: "Google Contacts not connected" });

    if (req.method === "GET") {
      const { contactId } = req.query;

      if (contactId) {
        // Get notes for specific contact
        const contact = await getContact(contactId);
        const userDefined = contact.userDefined || [];

        // Extract all note_* fields
        const notes = [];
        for (const field of userDefined) {
          const key = field.metadata?.userDefined?.key || "";
          if (key.startsWith("note_")) {
            notes.push(toNote(contactId, key, field.value));
          }
        }

        // Sort by timestamp descending (newest first)
        notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return res.json(notes);
      } else {
        // Get all notes from all contacts
        const { listContacts } = await import("./_google-people.js");
        const allContacts = await listContacts();
        const allNotes = [];

        for (const contact of allContacts) {
          const cId = contact.resourceName;
          const userDefined = contact.userDefined || [];

          for (const field of userDefined) {
            const key = field.metadata?.userDefined?.key || "";
            if (key.startsWith("note_")) {
              allNotes.push(toNote(cId, key, field.value));
            }
          }
        }

        // Sort by timestamp descending
        allNotes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return res.json(allNotes);
      }
    }

    if (req.method === "POST") {
      const { contactId, text, timestamp } = req.body;
      if (!contactId || !text) return res.status(400).json({ error: "contactId and text required" });

      const ts = timestamp || new Date().toISOString();
      // Create unique key from timestamp
      const noteKey = "note_" + ts.replace(/\D/g, "_");

      const contact = await getContact(contactId);
      let userDefined = contact.userDefined || [];

      // Add new note
      userDefined = setCustomField(userDefined, noteKey, JSON.stringify({ text, timestamp: ts }));

      // Update contact
      await updateContact(contactId, { userDefined });

      return res.json(toNote(contactId, noteKey, { text, timestamp: ts }));
    }

    if (req.method === "DELETE") {
      const { id, contactId } = req.body;
      if (!id || !contactId) return res.status(400).json({ error: "id and contactId required" });

      const contact = await getContact(contactId);
      let userDefined = contact.userDefined || [];

      // Remove note field
      userDefined = userDefined.filter(f => f.metadata?.userDefined?.key !== id);

      // Update contact
      await updateContact(contactId, { userDefined });

      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("contact-notes error", err);
    return res.status(500).json({ error: err.message });
  }
}
