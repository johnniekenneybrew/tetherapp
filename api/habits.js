import { notion, DB, ACC_MAP, ACC_REVERSE, P, p, queryAll, setCors } from "./_notion.js";

// ── Habit Log (merged to stay under Vercel Hobby 12-function limit) ──────────

function toLogEntry(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    date: p.date(props["Log Date"]),
    habitId: p.relation(props.Habit)[0] || null,
    done: p.checkbox(props.Done),
  };
}

async function handleHabitLog(req, res) {
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
      const e = toLogEntry(page);
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
      page = await notion.pages.update({ page_id: pages[0].id, properties: { Done: P.checkbox(done) } });
    } else {
      page = await notion.pages.create({
        parent: { database_id: DB.HABIT_LOG },
        properties: {
          Date: P.title(date), "Log Date": P.date(date),
          Habit: P.relation([habitId]), Done: P.checkbox(done),
        },
      });
    }
    return res.json(toLogEntry(page));
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// ── Habits ────────────────────────────────────────────────────────────────────

function toHabit(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    id: page.id,
    name: p.title(props.Name),
    target: p.number(props["Target Per Week"]) ?? 5,
    account: ACC_REVERSE[p.select(props.Account)] || "personal",
    active: p.checkbox(props.Active),
    goals: p.relation(props.Goals),
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.query.log) return handleHabitLog(req, res);

    if (req.method === "GET") {
      const pages = await queryAll(DB.HABITS);
      return res.json(pages.map(toHabit));
    }

    if (req.method === "POST") {
      const { name, target, account, goals } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DB.HABITS },
        properties: {
          Name:              P.title(name),
          "Target Per Week": P.number(target ?? 5),
          Account:           P.select(ACC_MAP[account] || "Personal"),
          Active:            P.checkbox(true),
          Goals:             P.relation(goals || []),
        },
      });
      return res.json(toHabit(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.name    !== undefined) updates.Name               = P.title(patch.name);
      if (patch.target  !== undefined) updates["Target Per Week"] = P.number(patch.target);
      if (patch.account !== undefined) updates.Account            = P.select(ACC_MAP[patch.account] || "Personal");
      if (patch.active  !== undefined) updates.Active             = P.checkbox(patch.active);
      if (patch.goals   !== undefined) updates.Goals              = P.relation(patch.goals || []);

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toHabit(page));
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await notion.pages.update({ page_id: id, archived: true });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("habits error", err);
    return res.status(500).json({ error: err.message });
  }
}
