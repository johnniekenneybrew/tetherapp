import { Client } from "@notionhq/client";

// ============================================================
// Shared Notion client
// ============================================================

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Database IDs
export const DB = {
  CHECKINS:       "e0e02d060b8e4ba089ecf0e9f9f240d2",
  TASKS:          "751eca9e0a4f4dfb8e9a0184047ae081",
  GOALS:          "2414b2e0b9d94ed693707300b41aa07a",
  HABITS:         "0a274c5fa457478c80ca69b721f7aaa9",
  HABIT_LOG:      "4dabaabd6ce94a989086d9e653b0d0fd",
  ROUTINES:       "df0a549ecb7842518b4de5a010c23a24",
  ROUTINE_LOG:    "b6bae775482b46e689d9d70f760d34ce",
  CONTACTS:       "e8023bd03bb049fb8b4e85e5d031b107",
  CONTACT_GROUPS: "e5fc6aaf8e594d3999b8f8bfc4f9b380",
  CONTACT_NOTES:  "c02a9437e2114cac9833b9095cfaa5a3",
};

// Account mapping: app id -> Notion select value
export const ACC_MAP = {
  findem:   "Findem",
  jones:    "Quit with Jones",
  personal: "Personal",
};
export const ACC_REVERSE = Object.fromEntries(Object.entries(ACC_MAP).map(([k, v]) => [v, k]));

// ============================================================
// Property builders (app value -> Notion property)
// ============================================================
export const P = {
  title:    (v) => ({ title: [{ text: { content: String(v ?? "") } }] }),
  rich:     (v) => ({ rich_text: [{ text: { content: String(v ?? "") } }] }),
  select:   (v) => ({ select: v ? { name: String(v) } : null }),
  mselect:  (v) => ({ multi_select: (v || []).map((n) => ({ name: String(n) })) }),
  checkbox: (v) => ({ checkbox: !!v }),
  number:   (v) => ({ number: v == null ? null : Number(v) }),
  date:     (v) => ({ date: v ? { start: String(v) } : null }),
  relation: (ids) => ({ relation: (ids || []).map((id) => ({ id })) }),
  url:      (v) => ({ url: v || null }),
};

// ============================================================
// Property parsers (Notion property -> app value)
// ============================================================
export const p = {
  title:    (prop) => prop?.title?.map((t) => t.plain_text).join("") ?? "",
  rich:     (prop) => prop?.rich_text?.map((t) => t.plain_text).join("") ?? "",
  select:   (prop) => prop?.select?.name ?? null,
  mselect:  (prop) => (prop?.multi_select || []).map((o) => o.name),
  checkbox: (prop) => !!prop?.checkbox,
  number:   (prop) => prop?.number ?? null,
  date:     (prop) => prop?.date?.start ?? null,
  relation: (prop) => (prop?.relation || []).map((r) => r.id),
  url:      (prop) => prop?.url ?? null,
};

// ============================================================
// Query all pages in a database (handles pagination)
// ============================================================
export async function queryAll(dbId, filter, sorts) {
  const results = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: dbId,
      filter,
      sorts,
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

// ============================================================
// CORS helper
// ============================================================
export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
