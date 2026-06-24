# Tether App — Claude Code Handoff

## Project

React + Vite PWA with Vercel serverless API (`api/`). Auth via Clerk.
Repo: `johnniekenneybrew/tetherapp`
Dev branch: `claude/intelligent-pascal-8ix1f`
Supabase project: `lgaqgneewiqnljcoxbhn` (https://lgaqgneewiqnljcoxbhn.supabase.co)

---

## What Was Just Done (last session)

Full backend migration from Notion → Supabase. All 14 files committed and pushed to
`claude/intelligent-pascal-8ix1f` in commit `c636bc3`.

### Files changed
| File | Change |
|------|--------|
| `api/_supabase.js` | **NEW** — Supabase client, `setCors`, `getUid` helpers |
| `api/_prefs.js` | Rewritten — upserts to `prefs` table instead of Notion |
| `api/habits.js` | Rewritten — `habits` + `habit_log` tables |
| `api/routines.js` | Rewritten — `routines` + `routine_log` tables |
| `api/goals.js` | Rewritten — `goals` + `goal_habit_links` + `goal_tasks` |
| `api/checkin.js` | Rewritten — `checkins` table, upsert-on-GET |
| `api/prefs.js` | Rewritten — thin HTTP wrapper around `_prefs.js` |
| `api/contact-groups.js` | Partial — icons now stored as JSON pref in Supabase |
| `api/nfc.js` | Updated — `logRoutine`/`logHabit` write to Supabase |
| `src/api.js` | Added `setApiUser(uid)`, injects `X-User-Id` header on all requests |
| `src/useAppData.js` | Waits for Clerk `userId`, calls `setApiUser` before `loadAll` |
| `package.json` | Added `@supabase/supabase-js ^2.108.2` |
| `supabase-schema.sql` | **NEW** — full schema to run in Supabase |
| `scripts/migrate-to-supabase.js` | **NEW** — one-shot Notion→Supabase data migration |

### NOT migrated (intentionally)
- **Tasks** → Todoist API (no change needed)
- **Contacts / Contact Notes** → Google People API (no change needed)

---

## What Still Needs To Be Done

### Step 1 — Apply the schema in Supabase (use the Supabase MCP connector)

Run the contents of `supabase-schema.sql` against the project.

Tables to create:
- `habits` (id UUID, user_id TEXT, name, target INT, account, active, created_at)
- `habit_log` (id UUID, user_id, habit_id UUID→habits, log_date DATE, done, UNIQUE habit_id+log_date)
- `routines` (id UUID, user_id, name, icon, use_icon, track_only, active, created_at)
- `routine_log` (id UUID, user_id, routine_id UUID→routines, log_date DATE, done, UNIQUE routine_id+log_date)
- `goals` (id UUID, user_id, name, description, kpi, status, account, target_date DATE, created_at)
- `goal_habit_links` (goal_id UUID→goals, habit_id UUID→habits, PRIMARY KEY both)
- `goal_tasks` (id UUID, user_id, goal_id UUID→goals ON DELETE SET NULL, name, done, created_at)
- `checkins` (id UUID, user_id, date DATE, gratitude JSONB, learnings JSONB, sections_done JSONB, completed, habits_updated_confirmed, UNIQUE user_id+date)
- `prefs` (id UUID, user_id TEXT, key TEXT, value JSONB, updated_at, UNIQUE user_id+key)

### Step 2 — Migrate existing Notion data

1. Find the user's Clerk user ID (Clerk dashboard → Users → copy the `user_...` ID)
2. Create `.env.migration` in project root:
   ```
   NOTION_TOKEN=secret_...
   SUPABASE_URL=https://lgaqgneewiqnljcoxbhn.supabase.co
   SUPABASE_SERVICE_KEY=eyJ...
   TETHER_USER_ID=user_...
   ```
3. Run: `node scripts/migrate-to-supabase.js`

Migration order handles FK dependencies:
habits → routines → goals → goal_habit_links → goal_tasks → checkins → prefs → contact_group_icons → habit_log → routine_log

All upserts use `onConflict: 'id'` so re-running is safe.

**Note:** Notion page IDs ARE valid UUIDs — they're used directly as Supabase primary keys, so existing NFC tag URLs continue to work after migration.

### Step 3 — Verify deployment

After Vercel redeploys from the branch:
- App loads habits/routines/goals (all require `X-User-Id` header now)
- Check-in creates a new row for today if none exists
- NFC tap writes to `routine_log` / `habit_log` instantly

---

## Architecture

### Auth / user ID threading

```
Clerk (frontend)
  └─ useUser() → userId
       └─ setApiUser(userId)   ← called in useAppData before loadAll
            └─ sets module-level _uid in src/api.js
                 └─ every fetch adds header: X-User-Id: _uid
                      └─ API endpoints: getUid(req) = req.headers["x-user-id"]
```

All Supabase queries filter by `user_id`. If header is missing, endpoints return 401.

### Key patterns

**Supabase client** (`api/_supabase.js`):
```js
import supabase, { setCors, getUid } from "./_supabase.js";
const uid = getUid(req);  // req.headers["x-user-id"]
```

**Upsert log entry**:
```js
await supabase.from("habit_log").upsert(
  { user_id: uid, habit_id: id, log_date: date, done: true },
  { onConflict: "habit_id,log_date" }
);
```

**Prefs** (`api/_prefs.js`):
```js
getPref(key, userId)   // SELECT value WHERE key + user_id
setPref(key, val, uid) // UPSERT on user_id,key
```

### NFC tags

URL format: `/api/nfc?tap=1&type=routine|habit&id=SUPABASE_UUID&uid=CLERK_USER_ID&token=32BYTE_HEX`

- Token stored in `prefs` table as key `nfc-token`
- Item list stored as key `nfc-items` (array of `{id, type, name}`)
- Tap validates token then upserts into `routine_log` or `habit_log`
- NFC settings UI is in `src/hub.jsx` → `NfcTagsSection` component

### Vercel env vars (already set as Sensitive)
```
SUPABASE_URL           = https://lgaqgneewiqnljcoxbhn.supabase.co
SUPABASE_SERVICE_KEY   = eyJ...  (service_role key)
SUPABASE_ANON_KEY      = eyJ...
NEXT_PUBLIC_SUPABASE_URL = https://lgaqgneewiqnljcoxbhn.supabase.co
```

Only `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are used by the API code.

---

## File Map

```
tetherapp/
├── api/
│   ├── _supabase.js          ← Supabase client + setCors + getUid
│   ├── _prefs.js             ← getPref / setPref (Supabase prefs table)
│   ├── _notion.js            ← still used by tasks.js / contacts / notes
│   ├── _todoist.js           ← tasks backend
│   ├── _google-people.js     ← contacts backend
│   ├── habits.js             ← habits + habit_log (Supabase)
│   ├── routines.js           ← routines + routine_log (Supabase)
│   ├── goals.js              ← goals + goal_habit_links + goal_tasks (Supabase)
│   ├── checkin.js            ← checkins (Supabase)
│   ├── prefs.js              ← HTTP wrapper for _prefs.js
│   ├── nfc.js                ← NFC tap handler + settings (Supabase)
│   ├── contact-groups.js     ← Google groups, icons in Supabase prefs
│   ├── tasks.js              ← Todoist (unchanged)
│   ├── contacts.js           ← Google People (unchanged)
│   └── contact-notes.js      ← Google People (unchanged)
├── src/
│   ├── api.js                ← fetch helpers + setApiUser(uid)
│   ├── useAppData.js         ← all state + actions, waits for userId
│   ├── hub.jsx               ← main dashboard (NFC section here)
│   └── ...
├── supabase-schema.sql       ← run this in Supabase SQL Editor
└── scripts/
    └── migrate-to-supabase.js ← Notion→Supabase one-shot migration
```

---

## Notion DB IDs (hardcoded in _notion.js and migration script)

```js
CHECKINS:       "e0e02d060b8e4ba089ecf0e9f9f240d2"
TASKS:          "751eca9e0a4f4dfb8e9a0184047ae081"
GOALS:          "2414b2e0b9d94ed693707300b41aa07a"
HABITS:         "0a274c5fa457478c80ca69b721f7aaa9"
HABIT_LOG:      "4dabaabd6ce94a989086d9e653b0d0fd"
ROUTINES:       "df0a549ecb7842518b4de5a010c23a24"
ROUTINE_LOG:    "b6bae775482b46e689d9d70f760d34ce"
CONTACTS:       "e8023bd03bb049fb8b4e85e5d031b107"
CONTACT_GROUPS: "e5fc6aaf8e594d3999b8f8bfc4f9b380"
CONTACT_NOTES:  "c02a9437e2114cac9833b9095cfaa5a3"
```

---

## Known Issues / Next Steps After Migration

- **Vercel 12-function limit** — currently at exactly 12 routes. Any new endpoint needs to be merged into an existing file.
- **Real-time updates** — NFC taps now write instantly to Supabase. Adding Supabase Realtime subscriptions to `src/useAppData.js` would make the app update live without a refresh.
- **RLS (Row Level Security)** — currently disabled. The service_role key bypasses RLS entirely. Fine for now; if adding client-side Supabase calls later, enable RLS with `user_id = auth.uid()` policies.
- **Border spacing bug** — user reported asymmetric spacing in the app but never provided a screenshot. Needs investigation.
