import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

function toEntry(page) {
  const props = page.properties;
  const habitIds = p.relation(props.Habit);
  return {
    _pageId: page.id,
    date: p.date(props["Log Date"]),
    habitId: habitIds[0] || null,
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

      const pages = await queryAll(DB.HABIT_LOG, {
        and: [
          { property: "Log Date", date: { on_or_after: from } },
          { property: "Log Date", date: { on_or_before: to } },
        ],
      });

      const log = {};
      for (const page of pages) {
        const e = toEntry(page);
        if (!e.date || !e.habitId) continue;
        if (!log[e.date]) log[e.date] = {};
        log[e.date][e.habitId] = e.done;
      }
      return res.json(log);
    }

    if (req.method === "PATCH") {
      const { date, habitId, done } = req.body;
      if (!date || !habitId) return res.status(400).json({ error: "date and habitId required" });

      const pages = await queryAll(DB.HABIT_LOG, {
        and: [
          { property: "Log Date", date: { equals: date } },
          { property: "Habit", relation: { contains: habitId } },
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
            Date:       P.title(date),
            "Log Date": P.date(date),
            Habit:      P.relation([habitId]),
            Done:       P.checkbox(done),
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
