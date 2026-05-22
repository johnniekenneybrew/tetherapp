import { notion, DB } from "./_notion.js";

// Shared helper — each lambda gets its own cache but all search for the same DB
let cachedDbId = process.env.GOAL_TASKS_DB_ID || null;

export async function getGoalTasksDbId() {
  if (cachedDbId) return cachedDbId;

  // Search for existing DB by exact title
  const results = await notion.search({
    query: "Goal Tasks",
    filter: { value: "database", property: "object" },
  });
  const existing = results.results.find(
    (r) => r.object === "database" && r.title?.[0]?.plain_text === "Goal Tasks"
  );
  if (existing) {
    cachedDbId = existing.id;
    return cachedDbId;
  }

  // Auto-create: find a parent page from an existing DB
  let parentPageId;
  try {
    const habitsDb = await notion.databases.retrieve({ database_id: DB.HABITS });
    if (habitsDb.parent?.type === "page_id")  parentPageId = habitsDb.parent.page_id;
    else if (habitsDb.parent?.type === "block_id") parentPageId = habitsDb.parent.block_id;
  } catch {}

  if (!parentPageId) {
    const pages = await notion.search({ filter: { value: "page", property: "object" } });
    if (pages.results.length > 0) parentPageId = pages.results[0].id;
  }

  if (!parentPageId) throw new Error("Cannot find a parent page to create Goal Tasks database.");

  const newDb = await notion.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: "Goal Tasks" } }],
    properties: {
      Name: { title: {} },
      Done: { checkbox: {} },
    },
  });

  cachedDbId = newDb.id;
  console.log("Created Goal Tasks DB:", cachedDbId);
  return cachedDbId;
}
