import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

function toEntry(page) {
  const props = page.properties;
  const routineIds = p.relation(props.Routine);
  return {
    _pageId: page.id,
    date: p.date(props["Log Date"]),
    routineId: routineIds[0] || null,
    done: p.checkbox(props.Done),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
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
        const e = toEntry(page);
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
        page = await notion.pages.update({
          page_id: pages[0].id,
          properties: { Done: P.checkbox(done) },
        });
      } else {
        page = await notion.pages.create({
          parent: { database_id: DB.ROUTINE_LOG },
          properties: {
            Date:       P.title(date),
            "Log Date": P.date(date),
            Routine:    P.relation([routineId]),
            Done:       P.checkbox(done),
          },
        });
      }
      return res.json(toEntry(page));
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("routine-log error", err);
    return res.status(500).json({ error: err.message });
  }
}
