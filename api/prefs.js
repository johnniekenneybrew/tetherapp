import { notion, DB, P, p, setCors } from "./_notion.js";

// Module-level cache — survives warm lambda restarts
let cachedDbId = process.env.PREFS_DB_ID || null;

async function getPrefsDbId() {
  if (cachedDbId) return cachedDbId;

  // Look for existing DB by title
  const results = await notion.search({
    query: "App Preferences",
    filter: { value: "database", property: "object" },
  });
  const existing = results.results.find(
    (r) => r.object === "database" && r.title?.[0]?.plain_text === "App Preferences"
  );
  if (existing) {
    cachedDbId = existing.id;
    return cachedDbId;
  }

  // Auto-create: find a parent page from one of the existing DBs
  let parentPageId;
  try {
    const habitsDb = await notion.databases.retrieve({ database_id: DB.HABITS });
    if (habitsDb.parent?.type === "page_id") parentPageId = habitsDb.parent.page_id;
    else if (habitsDb.parent?.type === "block_id") parentPageId = habitsDb.parent.block_id;
  } catch {}

  // Fallback: search for any accessible page
  if (!parentPageId) {
    const pages = await notion.search({ filter: { value: "page", property: "object" } });
    if (pages.results.length > 0) parentPageId = pages.results[0].id;
  }

  if (!parentPageId) throw new Error("Cannot find a parent page to create App Preferences database.");

  const newDb = await notion.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: "App Preferences" } }],
    properties: {
      Key:    { title: {} },
      Value:  { rich_text: {} },
      UserId: { rich_text: {} },
    },
  });

  cachedDbId = newDb.id;
  console.log("Created App Preferences DB:", cachedDbId);
  return cachedDbId;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const dbId = await getPrefsDbId();

    // GET /api/prefs?key=areas&userId=xxx
    if (req.method === "GET") {
      const { key, userId = "" } = req.query;
      if (!key) return res.status(400).json({ error: "key required" });

      const pages = await notion.databases.query({
        database_id: dbId,
        filter: {
          and: [
            { property: "Key",    title:     { equals: key } },
            { property: "UserId", rich_text: { equals: userId } },
          ],
        },
        page_size: 1,
      });

      if (!pages.results.length) return res.json({ value: null });

      const raw = p.rich(pages.results[0].properties.Value);
      return res.json({ value: raw ? JSON.parse(raw) : null });
    }

    // POST /api/prefs  { key, value, userId }  (upsert)
    if (req.method === "POST") {
      const { key, value, userId = "" } = req.body;
      if (!key) return res.status(400).json({ error: "key required" });

      const encoded = JSON.stringify(value);

      const existing = await notion.databases.query({
        database_id: dbId,
        filter: {
          and: [
            { property: "Key",    title:     { equals: key } },
            { property: "UserId", rich_text: { equals: userId } },
          ],
        },
        page_size: 1,
      });

      if (existing.results.length > 0) {
        await notion.pages.update({
          page_id: existing.results[0].id,
          properties: { Value: P.rich(encoded) },
        });
      } else {
        await notion.pages.create({
          parent: { database_id: dbId },
          properties: {
            Key:    P.title(key),
            Value:  P.rich(encoded),
            UserId: P.rich(userId),
          },
        });
      }

      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("prefs error", err);
    return res.status(500).json({ error: err.message });
  }
}
