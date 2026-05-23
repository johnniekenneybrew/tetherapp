import { notion, DB, P, p, queryAll, setCors } from "./_notion.js";
import { isConnected, clearRefreshToken, gtCreate, gtUpdate, gtDelete, gtListAll, isoToGoogleDue, googleDueToIso } from "./_google-tasks.js";

const TODAY_ISO = new Date().toISOString().slice(0, 10);

let schemaReady = false;
async function ensureGoogleTaskIdField() {
  if (schemaReady) return;
  try {
    const db = await notion.databases.retrieve({ database_id: DB.TASKS });
    if (!db.properties["Google Task ID"]) {
      await notion.databases.update({
        database_id: DB.TASKS,
        properties: { "Google Task ID": { rich_text: {} } },
      });
    }
    schemaReady = true;
  } catch (e) {
    console.error("ensureGoogleTaskIdField failed", e);
    schemaReady = true;
  }
}

export async function runSync() {
  await ensureGoogleTaskIdField();

  const [googleItems, notionPages] = await Promise.all([
    gtListAll(),
    queryAll(DB.TASKS),
  ]);

  // Only top-level Notion tasks
  const notionTasks = notionPages.filter(
    (pg) => p.relation(pg.properties["Parent Task"]).length === 0
  );

  // Maps
  const googleById  = Object.fromEntries(googleItems.map((g) => [g.id, g]));
  const notionByGId = {}; // googleTaskId -> notion page
  for (const pg of notionTasks) {
    const gid = p.rich(pg.properties["Google Task ID"]);
    if (gid) notionByGId[gid] = pg;
  }

  const ops = [];

  // ── Notion → Google: Notion is source of truth for content ──────────────────
  for (const pg of notionTasks) {
    const gid     = p.rich(pg.properties["Google Task ID"]);
    const title   = p.title(pg.properties.Title);
    const done    = p.checkbox(pg.properties.Done);
    const notes   = p.rich(pg.properties.Details) || "";
    const dueISO  = p.date(pg.properties["Due Date"]) || null;

    if (!gid) {
      // New in Notion — create in Google with all fields
      ops.push(
        gtCreate(title, { notes: notes || undefined, due: dueISO }).then((gt) =>
          notion.pages.update({
            page_id: pg.id,
            properties: { "Google Task ID": P.rich(gt.id) },
          })
        ).catch(console.error)
      );
    } else if (googleById[gid]) {
      // Exists in both — push any Notion changes to Google
      const gt = googleById[gid];
      const patch = {};
      if (title !== (gt.title || ""))                   patch.title  = title;
      if (notes !== (gt.notes || ""))                   patch.notes  = notes;
      if (dueISO !== googleDueToIso(gt.due))            patch.due    = dueISO ? isoToGoogleDue(dueISO) : null;
      if (done  !== (gt.status === "completed"))        patch.status = done ? "completed" : "needsAction";
      if (Object.keys(patch).length > 0) {
        ops.push(gtUpdate(gid, patch).catch(console.error));
      }
    }
    // If gid set but Google no longer has it → deleted in Google, handled below
  }

  // ── Google → Notion: handle new/deleted/completed tasks from Google ──
  for (const gt of googleItems) {
    const notionPg = notionByGId[gt.id];

    if (gt.deleted) {
      // Deleted in Google → archive in Notion
      if (notionPg) {
        ops.push(
          notion.pages.update({ page_id: notionPg.id, archived: true }).catch(console.error)
        );
      }
      continue;
    }

    if (!notionPg) {
      // New task in Google → create in Notion with all available fields
      const title = gt.title?.trim();
      if (!title) continue;
      const done   = gt.status === "completed";
      const dueISO = googleDueToIso(gt.due);
      ops.push(
        notion.pages.create({
          parent: { database_id: DB.TASKS },
          properties: {
            Title:            P.title(title),
            Done:             P.checkbox(done),
            Account:          P.select("Getro"),
            Priority:         P.checkbox(false),
            Details:          P.rich(gt.notes || ""),
            "Due Date":       P.date(dueISO),
            "Google Task ID": P.rich(gt.id),
            ...(done ? { "Completed Date": P.date(TODAY_ISO) } : {}),
          },
        }).catch(console.error)
      );
    } else {
      // Exists in both — Google completion wins; Notion wins for everything else
      const ntDone = p.checkbox(notionPg.properties.Done);
      const gtDone = gt.status === "completed";
      if (gtDone && !ntDone) {
        ops.push(
          notion.pages.update({
            page_id: notionPg.id,
            properties: {
              Done:             P.checkbox(true),
              "Completed Date": P.date(TODAY_ISO),
            },
          }).catch(console.error)
        );
      }
    }
  }

  await Promise.all(ops);
  return { synced: ops.length };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // GET → connection status (replaces google-status.js)
    if (req.method === "GET") {
      const connected = await isConnected();
      return res.json({ connected });
    }

    // DELETE → disconnect (replaces google-disconnect.js)
    if (req.method === "DELETE") {
      await clearRefreshToken();
      return res.json({ ok: true });
    }

    // POST → run sync
    const connected = await isConnected();
    if (!connected) return res.json({ ok: true, skipped: true, reason: "not_connected" });

    const result = await runSync();
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("google-sync error", err);
    return res.status(500).json({ error: err.message });
  }
}
