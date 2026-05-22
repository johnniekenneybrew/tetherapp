import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

// ============================================================
// Map Notion page -> app checkin object
// ============================================================
function toCheckin(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    date: p.date(props.Date),
    gratitude: (() => {
      try { return JSON.parse(p.rich(props.Gratitude) || '["","",""]'); } catch { return ["", "", ""]; }
    })(),
    learnings: (() => {
      try { return JSON.parse(p.rich(props.Learnings) || '["","",""]'); } catch { return ["", "", ""]; }
    })(),
    sectionsDone: (() => {
      try { return JSON.parse(p.rich(props.SectionsDone) || "{}"); } catch { return {}; }
    })(),
    completed: p.checkbox(props.Completed),
    habitsUpdatedConfirmed: p.checkbox(props.HabitsUpdatedConfirmed),
  };
}

// ============================================================
// Handler
// ============================================================
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // GET — find-or-create by date
    if (req.method === "GET") {
      const date = req.query.date; // YYYY-MM-DD
      if (!date) return res.status(400).json({ error: "date required" });

      const pages = await queryAll(DB.CHECKINS, {
        property: "Date",
        date: { equals: date },
      });

      if (pages.length > 0) {
        return res.json(toCheckin(pages[0]));
      }

      // Create a fresh checkin for this date
      const page = await notion.pages.create({
        parent: { database_id: DB.CHECKINS },
        properties: {
          Name:                   P.title(date),
          Date:                   P.date(date),
          Gratitude:              P.rich('["","",""]'),
          Learnings:              P.rich('["","",""]'),
          SectionsDone:           P.rich("{}"),
          Completed:              P.checkbox(false),
          HabitsUpdatedConfirmed: P.checkbox(false),
        },
      });
      return res.json(toCheckin(page));
    }

    // PATCH — update checkin fields
    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.gratitude  !== undefined) updates.Gratitude              = P.rich(JSON.stringify(patch.gratitude));
      if (patch.learnings  !== undefined) updates.Learnings              = P.rich(JSON.stringify(patch.learnings));
      if (patch.sectionsDone !== undefined) updates.SectionsDone         = P.rich(JSON.stringify(patch.sectionsDone));
      if (patch.completed  !== undefined) updates.Completed              = P.checkbox(patch.completed);
      if (patch.habitsUpdatedConfirmed !== undefined) updates.HabitsUpdatedConfirmed = P.checkbox(patch.habitsUpdatedConfirmed);

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toCheckin(page));
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("checkin error", err);
    return res.status(500).json({ error: err.message });
  }
}
