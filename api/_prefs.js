import { notion, p, P } from "./_notion.js";

let cachedDbId = process.env.PREFS_DB_ID || null;

export async function getPrefsDbId() {
  if (cachedDbId) return cachedDbId;

  const results = await notion.search({
    query: "App Preferences",
    filter: { value: "database", property: "object" },
  });
  const existing = results.results.find(
    (r) => r.object === "database" && r.title?.[0]?.plain_text === "App Preferences"
  );
  if (existing) { cachedDbId = existing.id; return cachedDbId; }

  let parentPageId;
  try {
    const { DB } = await import("./_notion.js");
    const habitsDb = await notion.databases.retrieve({ database_id: DB.HABITS });
    if (habitsDb.parent?.type === "page_id") parentPageId = habitsDb.parent.page_id;
    else if (habitsDb.parent?.type === "block_id") parentPageId = habitsDb.parent.block_id;
  } catch {}

  if (!parentPageId) {
    const pages = await notion.search({ filter: { value: "page", property: "object" } });
    if (pages.results.length > 0) parentPageId = pages.results[0].id;
  }
  if (!parentPageId) throw new Error("Cannot find parent page for App Preferences DB");

  const newDb = await notion.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: "App Preferences" } }],
    properties: { Key: { title: {} }, Value: { rich_text: {} }, UserId: { rich_text: {} } },
  });
  cachedDbId = newDb.id;
  return cachedDbId;
}

export async function getPref(key, userId = "") {
  const dbId = await getPrefsDbId();
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
  if (!pages.results.length) return null;
  const raw = p.rich(pages.results[0].properties.Value);
  try { return raw ? JSON.parse(raw) : null; } catch { return raw; }
}

export async function setPref(key, value, userId = "") {
  const dbId = await getPrefsDbId();
  const encoded = typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);
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
    await notion.pages.update({ page_id: existing.results[0].id, properties: { Value: P.rich(encoded) } });
  } else {
    await notion.pages.create({
      parent: { database_id: dbId },
      properties: { Key: P.title(key), Value: P.rich(encoded), UserId: P.rich(userId) },
    });
  }
}
