import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

// A habit-log page: { Date, HabitId, Done }
function toEntry(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    date: p.date(props.Date),
    habitId: p.rich(props.HabitId),
    done: p.checkbox(props.Done),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // GET — return { date: { habitId: bool } } for a date range
    if (req.method === "GET") {
      const { from, to } = req.query; // YYYY-MM-DD
      if (!from || !to) return res.status(400).json({ error: "from and to required" });

      const pages = await queryAll(DB.HABIT_LOG, {
        and: [
          { property: "Date", date: { on_or_after: from } },
          { property: "Date", date: { on_or_before: to } },
        ],
      });

      const log = {};
      for (const page of pages) {
        const e = toEntry(page);
        if (!log[e.date]) log[e.date] = {};
        log[e.date][e.habitId] = e.done;
      }
      return res.json(log);
    }

    // PATCH — toggle a single habit on a date (find-or-create)
    if (req.method === "PATCH") {
      const { date, habitId, done } = req.body;
      if (!date || !habitId) return res.status(400).json({ error: "date and habitId required" });

      // Try to find existing entry
      const pages = await queryAll(DB.HABIT_LOG, {
        and: [
          { property: "Date",    date:     { equals: date } },
          { property: "HabitId", rich_text: { equals: habitId } },
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
          parent: { database_id: DB.HABIT_LOG },
          properties: {
            Name:    P.title(`${date}|${habitId}`),
            Date:    P.date(date),
            HabitId: P.rich(habitId),
            Done:    P.checkbox(done),
          },
        });
      }
      return res.json(toEntry(page));
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("habit-log error", err);
    return res.status(500).json({ error: err.message });
  }
}
