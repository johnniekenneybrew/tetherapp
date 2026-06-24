# Tether — Finish Handoff (Supabase RLS verify + Vercel verify)

> Hand this to a fresh Claude Code session **that has working Supabase and
> Vercel MCP connectors**. The previous session's connectors dropped mid-way,
> so the two remaining items are verification-only and just need the connectors.

## TL;DR

The Notion→Supabase backend migration is **code-complete, schema-applied, and
RLS has been enabled**. Two things remain, both pure verification via MCP:

1. **Confirm RLS** actually took on all 9 tables (Supabase connector).
2. **Verify the Vercel deployment** — env vars present + latest build healthy +
   determine whether the new backend is actually *live in Production*.

Then report results and fix anything red. **Do not merge or open a PR unless the
user explicitly asks.**

---

## Coordinates

| | |
|---|---|
| Repo | `johnniekenneybrew/tetherapp` |
| Work branch | `claude/lucid-cannon-h9z6yy` (HEAD `bfa755d`, pushed to origin) |
| Supabase project | name **Tether**, ref/id **`lgaqgneewiqnljcoxbhn`**, eu-west-1, Postgres 17 |
| Connectors needed | Supabase (`mcp__Supabase__*`), Vercel (`mcp__Vercel__*`) — load via `ToolSearch` `select:...` |
| App stack | React + Vite PWA, Vercel serverless API in `api/`, auth via **Clerk** |

---

## Current state (verified by the prior session)

- **Schema applied** — 9 tables in `public`: `habits`, `habit_log`, `routines`,
  `routine_log`, `goals`, `goal_habit_links`, `goal_tasks`, `checkins`, `prefs`.
  Applied via the Supabase connector as migration
  `20260624135248_init_tether_schema`. Source of truth in repo:
  `supabase-schema.sql`.
- **Notion data migration — SKIPPED** by user decision (fresh start, no history
  carried over). `scripts/migrate-to-supabase.js` still exists; its upserts are
  idempotent on `id`, so it can be run later if the user changes their mind.
- **RLS — enabled by the user manually** in the Supabase SQL Editor
  (`ALTER TABLE … ENABLE ROW LEVEL SECURITY` on all 9 tables). **Not yet
  confirmed via the connector** — that's Task 1. **No policies were added — this
  is intentional** (see "Why no RLS policies").
- **Code checked** — `api/_supabase.js` builds the client with
  `SUPABASE_SERVICE_KEY` (the service_role key, which **bypasses RLS**); there is
  **no client-side Supabase usage** anywhere in `src/` (the anon key is never
  used). ⇒ RLS-enabled-with-no-policies is safe and does **not** affect the app.

---

## TASK 1 — Verify RLS (Supabase connector)

Run:

```
mcp__Supabase__get_advisors { project_id: "lgaqgneewiqnljcoxbhn", type: "security" }
mcp__Supabase__list_tables  { project_id: "lgaqgneewiqnljcoxbhn", schemas: ["public"] }
```

**Pass criteria:**
- `get_advisors` no longer returns the `rls_disabled` **critical** lint for the
  9 public tables.
- `list_tables` shows `rls_enabled: true` for **all 9** tables.

**If any table is still `false`**, re-enable it (idempotent — safe to re-run):

```
mcp__Supabase__execute_sql {
  project_id: "lgaqgneewiqnljcoxbhn",
  query: "ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;"
}
```

**Optional (reproducibility):** the manual RLS change isn't reflected in the
repo. Consider appending the 9 `ENABLE ROW LEVEL SECURITY` statements to
`supabase-schema.sql` and committing to `claude/lucid-cannon-h9z6yy`, so the repo
matches the live DB.

---

## TASK 2 — Verify Vercel (Vercel connector)

1. **Find the project:** `mcp__Vercel__list_projects` → locate the one for
   `johnniekenneybrew/tetherapp`.
2. **Env vars:** confirm both **`SUPABASE_URL`** and **`SUPABASE_SERVICE_KEY`**
   exist (at least **Production** scope; also **Preview** if preview URLs are
   used). These two are the **only** vars the API code reads. (They're stored as
   "Sensitive", so you'll see the names/scopes but not the values — that's
   expected.)
3. **Latest deployment** is `READY` (not `ERROR`, not stuck building).
4. **⚠️ CRITICAL — is the new backend actually live?** The Supabase backend code
   lives on branch `claude/lucid-cannon-h9z6yy` (commit `c636bc3` and later).
   Check which branch Vercel **Production** builds from:
   - Production tracks **this branch** → it's live once `READY`. 
   - Production tracks **`main`/`master`** (the usual default) → the Supabase
     backend is **NOT in production yet**. The branch must be merged first (ask
     the user before merging/PR), or test via the **preview deployment URL** for
     this branch.
   **Report which case it is** and the exact next step. Do not merge on your own.

---

## TASK 3 — End-to-end smoke test (optional but recommended)

On whichever deployment carries the branch (preview or prod), sign in via Clerk
and confirm:
- habits / routines / goals load (empty is correct — fresh start),
- a check-in creates today's row in `checkins`,
- an NFC tap writes to `routine_log` / `habit_log`.

Tables are empty + RLS on + service_role in use, so reads/writes should succeed.
A failure here almost always means a **missing Vercel env var** or you're hitting
a **deployment that doesn't include the branch**.

---

## Why no RLS policies (don't "fix" this)

The app authenticates with **Clerk, not Supabase Auth**. There is no Supabase JWT
carrying user identity, so `auth.uid()` policies would always be null — they'd
add nothing. The actual exposure was the **anon key being able to read/write
every row**; enabling RLS with **no policies** closes that (anon/authenticated =
denied) while the **service_role** client in `api/_supabase.js` bypasses RLS and
keeps the app fully working. Only introduce `user_id`-scoped policies if/when
client-side Supabase calls are added — which would also require wiring
Clerk↔Supabase third-party-auth JWTs first.

---

## Constraints / gotchas

- **Vercel 12-function limit:** `api/` is at exactly 12 routes. Do **not** add
  new endpoints; fold logic into an existing file if you must.
- **No PR / no merge** unless the user explicitly asks.
- **Secrets are write-only:** `SUPABASE_SERVICE_KEY` / `NOTION_TOKEN` are Vercel
  "Sensitive" vars — they can't be read back via API/dashboard/`vercel env pull`.
  Don't try to extract them.
- Full project/architecture background and the Notion DB IDs (only needed if the
  migration is ever run) are in **`HANDOFF.md`** in the repo root.

---

## Definition of done

- [ ] All 9 tables `rls_enabled: true`; security advisor clean of `rls_disabled`.
- [ ] Vercel project has `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`; latest deploy `READY`.
- [ ] Stated clearly whether the Supabase backend is **live in Production** or
      only on preview/branch — with the exact next step if it isn't live.
- [ ] (optional) Smoke test passed.
