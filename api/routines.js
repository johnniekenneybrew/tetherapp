import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

// ── Routine Log (merged to stay under Vercel Hobby 12-function limit) ─────────

function toLogEntry(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    date: p.date(props["Log Date"]),
    routineId: p.relation(props.Routine)[0] || null,
    done: p.checkbox(props.Done),
  };
}

async function handleRoutineLog(req, res) {
  if (req.method === "GET") {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to required" });
    const pages = await queryAll(DB.ROUTINE_LOG, {
      and: [
        { property: "Log Date", date: { on_or_after: from } },
        { property: "Log Date", date: { on_or_before: to } },
      ],
    });
    const log = {};
    for (const page of pages) {
      const e = toLogEntry(page);
      if (!e.date || !e.routineId) continue;
      if (!log[e.date]) log[e.date] = {};
      log[e.date][e.routineId] = e.done;
    }
    return res.json(log);
  }
  if (req.method === "PATCH") {
    const { date, routineId, done } = req.body;
    if (!date || !routineId) return res.status(400).json({ error: "date and routineId required" });
    const pages = await queryAll(DB.ROUTINE_LOG, {
      and: [
        { property: "Log Date", date: { equals: date } },
        { property: "Routine", relation: { contains: routineId } },
      ],
    });
    let page;
    if (pages.length > 0) {
      page = await notion.pages.update({ page_id: pages[0].id, properties: { Done: P.checkbox(done) } });
    } else {
      page = await notion.pages.create({
        parent: { database_id: DB.ROUTINE_LOG },
        properties: {
          Date: P.title(date), "Log Date": P.date(date),
          Routine: P.relation([routineId]), Done: P.checkbox(done),
        },
      });
    }
    return res.json(toLogEntry(page));
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// ── Routines ──────────────────────────────────────────────────────────────────

function toRoutine(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    id: page.id,
    name: p.title(props.Name),
    icon: p.rich(props.Icon) || "✨",
    useIcon: p.checkbox(props["Use Icon"]),
    trackOnly: p.checkbox(props["Track Only"]),
    active: p.checkbox(props.Active),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.query.log) return handleRoutineLog(req, res);

    if (req.method === "GET") {
      const pages = await queryAll(DB.ROUTINES);
      return res.json(pages.map(toRoutine));
    }

    if (req.method === "POST") {
      const { name, icon, useIcon, trackOnly } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.ROUTINES },
        properties: {
          Name:         P.title(name),
          Icon:         P.rich(icon || "✨"),
          "Use Icon":   P.checkbox(useIcon ?? true),
          "Track Only": P.checkbox(trackOnly ?? false),
          Active:       P.checkbox(true),
        },
      });
      return res.json(toRoutine(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name      !== undefined) updates.Name           = P.title(patch.name);
      if (patch.icon      !== undefined) updates.Icon           = P.rich(patch.icon || "");
      if (patch.useIcon   !== undefined) updates["Use Icon"]    = P.checkbox(patch.useIcon);
      if (patch.trackOnly !== undefined) updates["Track Only"]  = P.checkbox(patch.trackOnly);
      if (patch.active    !== undefined) updates.Active         = P.checkbox(patch.active);

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toRoutine(page));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("routines error", err);
    return res.status(500).json({ error: err.message });
  }
}
