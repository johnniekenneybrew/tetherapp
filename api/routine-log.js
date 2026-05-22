import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

function toEntry(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    date: p.date(props.Date),
    routineId: p.rich(props.RoutineId),
    done: p.checkbox(props.Done),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // GET — return { date: { routineId: bool } } for a date range
    if (req.method === "GET") {
      const { from, to } = req.query;
      if (!from || !to) return res.status(400).json({ error: "from and to required" });

      const pages = await queryAll(DB.ROUTINE_LOG, {
        and: [
          { property: "Date", date: { on_or_after: from } },
          { property: "Date", date: { on_or_before: to } },
        ],
      });

      const log = {};
      for (const page of pages) {
        const e = toEntry(page);
        if (!log[e.date]) log[e.date] = {};
        log[e.date][e.routineId] = e.done;
      }
      return res.json(log);
    }

    // PATCH — toggle (find-or-create)
    if (req.method === "PATCH") {
      const { date, routineId, done } = req.body;
      if (!date || !routineId) return res.status(400).json({ error: "date and routineId required" });

      const pages = await queryAll(DB.ROUTINE_LOG, {
        and: [
          { property: "Date",      date:     { equals: date } },
          { property: "RoutineId", rich_text: { equals: routineId } },
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
            Name:      P.title(`${date}|${routineId}`),
            Date:      P.date(date),
            RoutineId: P.rich(routineId),
            Done:      P.checkbox(done),
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
