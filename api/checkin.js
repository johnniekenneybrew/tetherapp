import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";

const TODAY_ISO = "2026-05-22";

function toCheckin(page) {
  const props = page.properties;
  return {
    _pageId: page.id,
    date: p.date(props["Check-In Date"]),
    gratitude: [
      p.rich(props["Gratitude 1"]) || "",
      p.rich(props["Gratitude 2"]) || "",
      p.rich(props["Gratitude 3"]) || "",
    ],
    learnings: [
      p.rich(props["Learning 1"]) || "",
      p.rich(props["Learning 2"]) || "",
      p.rich(props["Learning 3"]) || "",
    ],
    completed: p.checkbox(props.Completed),
    sectionsDone: {},
    habitsUpdatedConfirmed: false,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      const date = req.query.date;
      if (!date) return res.status(400).json({ error: "date required" });

      const pages = await queryAll(DB.CHECKINS, {
        property: "Check-In Date",
        date: { equals: date },
      });

      if (pages.length > 0) {
        return res.json(toCheckin(pages[0]));
      }

      const page = await notion.pages.create({
        parent: { database_id: DB.CHECKINS },
        properties: {
          Date:            P.title(date),
          "Check-In Date": P.date(date),
          "Gratitude 1":   P.rich(""),
          "Gratitude 2":   P.rich(""),
          "Gratitude 3":   P.rich(""),
          "Learning 1":    P.rich(""),
          "Learning 2":    P.rich(""),
          "Learning 3":    P.rich(""),
          Completed:       P.checkbox(false),
        },
      });
      return res.json(toCheckin(page));
    }

    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.gratitude !== undefined) {
        updates["Gratitude 1"] = P.rich(patch.gratitude[0] || "");
        updates["Gratitude 2"] = P.rich(patch.gratitude[1] || "");
        updates["Gratitude 3"] = P.rich(patch.gratitude[2] || "");
      }
      if (patch.learnings !== undefined) {
        updates["Learning 1"] = P.rich(patch.learnings[0] || "");
        updates["Learning 2"] = P.rich(patch.learnings[1] || "");
        updates["Learning 3"] = P.rich(patch.learnings[2] || "");
      }
      if (patch.completed !== undefined) updates.Completed = P.checkbox(patch.completed);

      const page = await notion.pages.update({ page_id: id, properties: updates });
      return res.json(toCheckin(page));
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("checkin error", err);
    return res.status(500).json({ error: err.message });
  }
}
