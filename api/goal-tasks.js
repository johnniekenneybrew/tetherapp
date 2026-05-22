import { notion, P, p, queryAll, setCors } from "./_notion.js";
import { getGoalTasksDbId } from "./_goal-tasks-db.js";

function toTask(page) {
  return {
    _pageId: page.id,
    id:      page.id,
    name:    p.title(page.properties.Name),
    done:    p.checkbox(page.properties.Done),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const dbId = await getGoalTasksDbId();

    if (req.method === "GET") {
      const pages = await queryAll(dbId, { property: "Done", checkbox: { equals: false } });
      // Also get done tasks so goal cards can show them
      const donePage = await queryAll(dbId, { property: "Done", checkbox: { equals: true } });
      return res.json([...pages, ...donePage].map(toTask));
    }

    if (req.method === "POST") {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "name required" });
      const page = await notion.pages.create({
        parent: { database_id: dbId },
        properties: {
          Name: P.title(name.trim()),
          Done: P.checkbox(false),
        },
      });
      return res.json(toTask(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      const updates = {};
      if (patch.name !== undefined) updates.Name = P.title(patch.name);
      if (patch.done !== undefined) updates.Done = P.checkbox(!!patch.done);
      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toTask(page));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("goal-tasks error", err);
    return res.status(500).json({ error: err.message });
  }
}
