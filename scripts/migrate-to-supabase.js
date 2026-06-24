#!/usr/bin/env node
// Migration script: Notion → Supabase
//
// 1. Create .env.migration in the project root with:
//      NOTION_TOKEN=secret_...
//      SUPABASE_URL=https://lgaqgneewiqnljcoxbhn.supabase.co
//      SUPABASE_SERVICE_KEY=eyJ...  (service_role key)
//      TETHER_USER_ID=user_...      (your Clerk user ID)
//
// 2. Run: node scripts/migrate-to-supabase.js
//    (Re-running is safe — all upserts use onConflict: 'id')

import { readFileSync } from "fs";
import { Client } from "@notionhq/client";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.migration ──────────────────────────────────────────────────────
try {
  const content = readFileSync(".env.migration", "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.log("No .env.migration file found — using process.env");
}

const { NOTION_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, TETHER_USER_ID: USER_ID } = process.env;

if (!NOTION_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !USER_ID) {
  console.error("Missing: NOTION_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, TETHER_USER_ID");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// Hardcoded Notion DB IDs (from api/_notion.js)
const DB = {
  HABITS:         "0a274c5fa457478c80ca69b721f7aaa9",
  HABIT_LOG:      "4dabaabd6ce94a989086d9e653b0d0fd",
  ROUTINES:       "df0a549ecb7842518b4de5a010c23a24",
  ROUTINE_LOG:    "b6bae775482b46e689d9d70f760d34ce",
  GOALS:          "2414b2e0b9d94ed693707300b41aa07a",
  CHECKINS:       "e0e02d060b8e4ba089ecf0e9f9f240d2",
  CONTACT_GROUPS: "e5fc6aaf8e594d3999b8f8bfc4f9b380",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function queryAll(dbId, filter) {
  const results = [];
  let cursor;
  do {
    const resp = await notion.databases.query({
      database_id: dbId,
      filter,
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return results;
}

const p = {
  title:    (prop) => prop?.title?.map((t) => t.plain_text).join("") ?? "",
  rich:     (prop) => prop?.rich_text?.map((t) => t.plain_text).join("") ?? "",
  select:   (prop) => prop?.select?.name ?? null,
  checkbox: (prop) => !!prop?.checkbox,
  number:   (prop) => prop?.number ?? null,
  date:     (prop) => prop?.date?.start ?? null,
  relation: (prop) => (prop?.relation || []).map((r) => r.id),
};

const ACC_REVERSE = { "Findem": "findem", "Quit with Jones": "jones", "Personal": "personal" };
const STATUS_REVERSE = { "In Progress": "in-progress", "Completed": "completed" };

async function upsert(table, rows, onConflict = "id") {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
}

// ── Migration steps ──────────────────────────────────────────────────────────

async function migrateHabits() {
  console.log("→ habits");
  const pages = await queryAll(DB.HABITS);
  const rows = pages.map((page) => {
    const props = page.properties;
    return {
      id:         page.id,
      user_id:    USER_ID,
      name:       p.title(props.Name),
      target:     p.number(props["Target Per Week"]) ?? 5,
      account:    ACC_REVERSE[p.select(props.Account)] || "personal",
      active:     p.checkbox(props.Active),
      created_at: page.created_time,
    };
  });
  await upsert("habits", rows);
  console.log(`   ${rows.length} habits`);
  return pages;
}

async function migrateRoutines() {
  console.log("→ routines");
  const pages = await queryAll(DB.ROUTINES);
  const rows = pages.map((page) => {
    const props = page.properties;
    return {
      id:         page.id,
      user_id:    USER_ID,
      name:       p.title(props.Name),
      icon:       p.rich(props.Icon) || "✨",
      use_icon:   p.checkbox(props["Use Icon"]),
      track_only: p.checkbox(props["Track Only"]),
      active:     p.checkbox(props.Active),
      created_at: page.created_time,
    };
  });
  await upsert("routines", rows);
  console.log(`   ${rows.length} routines`);
  return pages;
}

async function migrateGoals() {
  console.log("→ goals");
  const pages = await queryAll(DB.GOALS);
  const rows = pages.map((page) => {
    const props = page.properties;
    return {
      id:          page.id,
      user_id:     USER_ID,
      name:        p.title(props.Name),
      description: p.rich(props.Description) || "",
      kpi:         p.rich(props.KPI) || "",
      status:      STATUS_REVERSE[p.select(props.Status)] || "in-progress",
      account:     ACC_REVERSE[p.select(props.Account)] || "personal",
      target_date: p.date(props["Target Date"]) || null,
      created_at:  page.created_time,
    };
  });
  await upsert("goals", rows);
  console.log(`   ${rows.length} goals`);
  return pages;
}

async function migrateGoalHabitLinks(goalPages) {
  console.log("→ goal_habit_links");
  const links = [];
  for (const page of goalPages) {
    const habitIds = p.relation(page.properties.Habits);
    for (const habitId of habitIds) {
      links.push({ goal_id: page.id, habit_id: habitId });
    }
  }
  if (links.length) {
    const { error } = await supabase.from("goal_habit_links")
      .upsert(links, { onConflict: "goal_id,habit_id", ignoreDuplicates: true });
    if (error) throw new Error(`upsert goal_habit_links: ${error.message}`);
  }
  console.log(`   ${links.length} links`);
}

async function migrateGoalTasks(goalPages) {
  console.log("→ goal_tasks");

  // Find Goal Tasks DB
  let goalTasksDbId;
  try {
    const results = await notion.search({
      query: "Goal Tasks",
      filter: { value: "database", property: "object" },
    });
    const found = results.results.find(
      (r) => r.object === "database" && r.title?.[0]?.plain_text === "Goal Tasks"
    );
    if (found) goalTasksDbId = found.id;
  } catch {}

  if (!goalTasksDbId) {
    console.log("   Goal Tasks DB not found — skipping");
    return;
  }

  // Build task→goal map from goals' GoalTasks relation
  const taskToGoal = {};
  for (const page of goalPages) {
    const taskIds = p.relation(page.properties.GoalTasks);
    for (const taskId of taskIds) {
      taskToGoal[taskId] = page.id;
    }
  }

  const pages = await queryAll(goalTasksDbId);
  const rows = pages.map((page) => ({
    id:         page.id,
    user_id:    USER_ID,
    name:       p.title(page.properties.Name),
    done:       p.checkbox(page.properties.Done),
    goal_id:    taskToGoal[page.id] || null,
    created_at: page.created_time,
  }));
  await upsert("goal_tasks", rows);
  console.log(`   ${rows.length} goal tasks`);
}

async function migrateCheckins() {
  console.log("→ checkins");
  const pages = await queryAll(DB.CHECKINS);

  function parseJSON(raw, fallback) {
    try { return JSON.parse(raw || JSON.stringify(fallback)) ?? fallback; } catch { return fallback; }
  }

  const rows = pages.map((page) => {
    const props = page.properties;
    return {
      id:                       page.id,
      user_id:                  USER_ID,
      date:                     p.date(props["Check-In Date"]),
      gratitude:                [
        p.rich(props["Gratitude 1"]) || "",
        p.rich(props["Gratitude 2"]) || "",
        p.rich(props["Gratitude 3"]) || "",
      ],
      learnings:                [
        p.rich(props["Learning 1"]) || "",
        p.rich(props["Learning 2"]) || "",
        p.rich(props["Learning 3"]) || "",
      ],
      completed:                p.checkbox(props.Completed),
      sections_done:            parseJSON(p.rich(props["Sections Done"]), {}),
      habits_updated_confirmed: false,
      created_at:               page.created_time,
    };
  }).filter((r) => !!r.date);

  await upsert("checkins", rows);
  console.log(`   ${rows.length} check-ins`);
}

async function migratePrefs() {
  console.log("→ prefs");

  // Find App Preferences DB
  let prefsDbId;
  try {
    const results = await notion.search({
      query: "App Preferences",
      filter: { value: "database", property: "object" },
    });
    const found = results.results.find(
      (r) => r.object === "database" && r.title?.[0]?.plain_text === "App Preferences"
    );
    if (found) prefsDbId = found.id;
  } catch {}

  if (!prefsDbId) {
    console.log("   App Preferences DB not found — skipping");
    return;
  }

  const pages = await notion.databases.query({
    database_id: prefsDbId,
    filter: { property: "UserId", rich_text: { equals: USER_ID } },
  });

  const rows = [];
  for (const page of pages.results) {
    const key = p.title(page.properties.Key);
    const rawVal = p.rich(page.properties.Value);
    let value = null;
    try { value = rawVal ? JSON.parse(rawVal) : null; } catch { value = rawVal; }
    if (key) rows.push({ user_id: USER_ID, key, value, updated_at: page.last_edited_time });
  }

  if (rows.length) {
    const { error } = await supabase.from("prefs")
      .upsert(rows, { onConflict: "user_id,key" });
    if (error) throw new Error(`upsert prefs: ${error.message}`);
  }
  console.log(`   ${rows.length} prefs`);
}

async function migrateContactGroupIcons() {
  console.log("→ contact-group-icons pref");
  try {
    const pages = await queryAll(DB.CONTACT_GROUPS);
    const icons = {};
    for (const page of pages) {
      const resourceName = p.rich(page.properties["Resource Name"]);
      const icon = p.rich(page.properties.Icon) || "👥";
      if (resourceName) icons[resourceName] = icon;
    }
    if (Object.keys(icons).length > 0) {
      const { error } = await supabase.from("prefs").upsert(
        { user_id: USER_ID, key: "contact-group-icons", value: icons, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );
      if (error) throw error;
      console.log(`   ${Object.keys(icons).length} group icons`);
    } else {
      console.log("   no icons found");
    }
  } catch (err) {
    console.log(`   skipped (${err.message})`);
  }
}

async function migrateHabitLog() {
  console.log("→ habit_log");
  const pages = await queryAll(DB.HABIT_LOG);
  const rows = pages.map((page) => {
    const props = page.properties;
    const habitIds = p.relation(props.Habit);
    return {
      id:         page.id,
      user_id:    USER_ID,
      habit_id:   habitIds[0] || null,
      log_date:   p.date(props["Log Date"]),
      done:       p.checkbox(props.Done),
    };
  }).filter((r) => r.habit_id && r.log_date);
  await upsert("habit_log", rows);
  console.log(`   ${rows.length} habit log entries`);
}

async function migrateRoutineLog() {
  console.log("→ routine_log");
  const pages = await queryAll(DB.ROUTINE_LOG);
  const rows = pages.map((page) => {
    const props = page.properties;
    const routineIds = p.relation(props.Routine);
    return {
      id:         page.id,
      user_id:    USER_ID,
      routine_id: routineIds[0] || null,
      log_date:   p.date(props["Log Date"]),
      done:       p.checkbox(props.Done),
    };
  }).filter((r) => r.routine_id && r.log_date);
  await upsert("routine_log", rows);
  console.log(`   ${rows.length} routine log entries`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nMigrating Notion → Supabase for user ${USER_ID}\n`);

  try {
    await migrateHabits();
    await migrateRoutines();
    const goalPages = await migrateGoals();
    await migrateGoalHabitLinks(goalPages);
    await migrateGoalTasks(goalPages);
    await migrateCheckins();
    await migratePrefs();
    await migrateContactGroupIcons();
    await migrateHabitLog();
    await migrateRoutineLog();

    console.log("\n✅ Migration complete!\n");
  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  }
}

main();
