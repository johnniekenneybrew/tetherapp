# Tether — Product Design Requirements (PDR)

**Current-state documentation + design-revamp brief**

| | |
|---|---|
| Product | **Tether** — "everything together" |
| Version | 2.2.0 (changelog through May 2026) |
| Document date | 2026-06-25 |
| Stack | React 18 + Vite PWA · Vercel serverless API · Clerk auth |
| Data backends | Supabase (habits/routines/goals/check-ins/prefs) · Todoist (tasks) · Google People (contacts) |
| Repo / branch | `johnniekenneybrew/tetherapp` · `claude/lucid-cannon-h9z6yy` |
| Frontend size | ~7,350 LOC across 5 feature screens + shared lib + 2,600-line stylesheet |

> **How to use this doc.** §2–§8 document the app **as it exists today** (the source of truth for a redesign — every screen, feature, flow, data shape, and design token). §9 is the **revamp brief**: goals, principles, a prioritized problem inventory, opportunities, hard constraints, and open decisions. §10 proposes phasing. If you take this into a design tool, §4 (IA), §7 (design system) and §9 (problems/opportunities) are the parts to lead with.

---

## 1. What Tether is

Tether is a **personal daily-operating-system** — a single-user productivity hub that unifies the things a person checks every morning: today's priorities, habits & routines, quarterly goals, a task board, and a lightweight personal CRM. Its thesis is in the tagline ("everything together"): instead of five apps, one calm surface that opens to a **two-minute morning ritual** and flows into the day's work.

**Who it's for.** Today it is effectively a **single power-user's bespoke app**, not multi-tenant SaaS. Evidence baked into the code:
- The three "areas/accounts" are hardcoded to one person's contexts — **Findem** (`j@getro.com`), **Quit with Jones** (`j@quitwithjones.com`), and **Personal** (`shared.jsx`).
- Google Contacts uses a **single app-wide refresh token**, so every signed-in user would see the *same* address book (`api/_google-people.js`).
- Quarter/week headers are partly **hardcoded** ("Q2 2026 · Week 7 of 12").

This matters for the revamp: design decisions can optimize for **one opinionated user's daily flow**, not generic onboarding — unless multi-user is an explicit goal (see §9 open questions).

**Origin.** Per `README.md`, Tether began as a **Claude Design (claude.ai/design) HTML/CSS/JS mockup** that was exported as a handoff bundle (`project/`, `chats/chat1.md`) and reimplemented in React. The design language below is the realized version of that mockup. A revamp can return to that same design-prototype workflow (see §10).

---

## 2. Platform, architecture & surfaces (design-relevant)

- **PWA**, installable (Apple touch icon, `apple-mobile-web-app-*` meta, standalone status bar). Implies **mobile/home-screen usage is a first-class expectation** — yet most screens are desktop-tuned today (see §7.6).
- **SPA** with a tiny hand-rolled router (state object `{ page }` in `App.jsx`) — no URL routing/deep-linking; navigation state is in memory only.
- **Auth: Clerk.** Signed-out users get Clerk's hosted `<SignIn>`; signed-in users get the app. A `X-User-Id` header threads the Clerk id to the API.
- **Three independent data backends**, abstracted behind `src/api.js`:
  - **Supabase** — habits, habit logs, routines, routine logs, goals, goal↔habit links, goal tasks, check-ins, preferences.
  - **Todoist** — the entire To-Do board (projects = areas, labels = Park/Now, p1 = priority).
  - **Google People** — contacts, contact groups, with custom data tucked into Google `userDefined` fields.
- **Companion surfaces (out of scope unless flagged):** a **Chrome extension** (`tether-extension/`, `extension/`) whose side-panel the To-Do board claims "parity" with, and a **separate mobile shell** (`public/mobile.*`). A revamp should decide whether these stay in sync with the web design.
- **Known stale artifact:** code comments and the **loading screen still say "Connecting to Notion"** (`App.jsx`) even though the backend is now Supabase/Todoist/Google. Copy like this needs an audit pass.

---

## 3. Information architecture & navigation

**Primary nav (sticky top bar, `shared.jsx` `TopBar`):**

| Nav item | Route | Sub-tabs | Notes |
|---|---|---|---|
| **Daily Check-In** | `checkin` | — | **Default landing screen** |
| **Habits + Health** | `hub` | Habits · Routines · Goals · WAM | Hover dropdown jumps straight to a sub-tab |
| **Social** | `social` | Contacts (only) | Sub-tab bar is single-item today |
| **To-Do List** | `todo` | — | Flagged **"beta"** in nav |
| *(avatar menu)* | `settings` | — | Settings, + non-functional "Help" / "Keyboard shortcuts" items |

- **Brand:** a custom **"knot/tether" node-graph logo** + wordmark `teth·er`, drawn in indigo **#6C63FF**.
- **Right cluster:** To-Do (with beta chip) · a date pill (`☀ Thu · Jun 25`) · circular **avatar** (initials, gradient blue→purple) that opens an account menu (Settings / Help / Keyboard shortcuts / Sign out).
- **Mobile nav:** below 820px the desktop nav is replaced by a single dropdown button showing the current page name. (The hub sub-tabs and avatar hover-menus do not have clean touch equivalents — see §7.6.)
- **Navigation gaps for the revamp:** no URL deep-linking; no back-button support; sub-tab + dropdown systems are inconsistent; Social's sub-tab bar has only one item; two account-menu entries are dead.

---

## 4. Feature-by-feature current-state spec

### 4.1 Daily Check-In (`checkin.jsx`) — the landing ritual

A two-column "two-minute morning ritual" with a **4-section completion model** and a celebratory finish.

- **Header:** `Daily Check-In` · "Today — {long date} · A two-minute morning ritual." · a **Progress {n}/4** bar (green at 4, grey otherwise).
- **Section 1 — Today's Priorities** (`n/5`): add up to 5 priorities, each tagged to an area (color swatch picker); checkable; removable. Backed by Todoist tasks (`priority:true, due:0`). Empty copy: *"What must happen today? Add up to 5 priorities."*
- **Section 2 — Update Yesterday's Habits & Routines:** two mini-lists (Habits / Routines) for *yesterday*, each row checkable and **drag-reorderable**; routines may render as emoji. "Mark reviewed."
- **Section 3 — What I'm Grateful For** (3 things): three textareas; turn **green** when filled (>2 chars); gate requires all three.
- **Section 4 — Highlights & Learnings** (3 things): same pattern, blue fill.
- **Per-section footer:** "Mark complete" (disabled until "ready"), flips to "Section complete ✓ / Edit."
- **Completion:** when all 4 are done → **full-screen emoji + confetti explosion** (`EmojiRain`, 260 emoji + 380 confetti pieces, spring physics) → auto-navigates to the To-Do list. A persistent **"Morning Check-In Complete"** banner with **Undo** appears thereafter.
- **State:** `state.checkin = { gratitude[3], learnings[3], sectionsDone{}, completed, habitsUpdatedConfirmed }`, one row per `user_id + date` in Supabase; saves are debounced/optimistic.

### 4.2 Habits + Health Hub (`hub.jsx`) — 4 tabs

**Tab A · Habits** — a **weekly grid** (habits = rows, Mon–Sun = columns). Per row: drag handle, name + linked-goal chips + "{target}× per week", 7 day checkboxes (future days show a muted `·`), and a **completion bar + %** (capped at target). Add via **"+ Add habit"** modal (name, frequency 3–7×/wk, area, optional goal links). **No streaks, no notes; target is a weekly count.**

**Tab B · Routines** — a **transposed grid** (days = rows, routines = columns). Framing: *"Routines are non-negotiable. Aim for 100% — every day, every box."* Routines display as **emoji or text** (18-emoji preset palette + free entry), can be **"tracking only"** (excluded from the daily %), reorderable by column, edited via an inline popover. Daily completion bar per row.

**Tab C · Goals** — a **card list** (Active + collapsible Completed). Each goal card: name, optional **KPI badge** (🎯), description, **status badge**, area, hover **kebab** (Edit / Mark complete / Delete), plus **linked Habits** and clickable **linked Tasks** (toggle done). Add/Edit modal: name, KPI, description, area, **link habits** (incl. create-new inline), **link tasks** (create-new inline, async). Status is set only via the kebab.

**Tab D · WAM ("Weekly Accountability Meeting")** — a **read-only analytics scorecard**. A bounded week navigator (8 weeks back, no future), a **hero card** colored by average performance vs an 80% target, a per-goal **breakdown** (computed from habit-log completion ÷ target), and a single-goal drill-down.

### 4.3 To-Do List (`todo.jsx`) — board + Focus (beta)

A **multi-column Kanban board** (one column per area) plus a **Focus/Pomodoro** mode. Backed by Todoist.

- **5 views (tabs):** Focus · Active · Today · Week · Parking. Focus & Parking tabs show count badges.
- **Label filter row** (Todoist labels, single-select) — hidden in Focus.
- **Columns** (Findem / Quit with Jones / Personal): header with area dot + name + count, an "Add a task…" input (view-aware defaults), the sorted task list, per-column empty states ("All clear." / "Nothing parked."), and a collapsible **"Done today · n."**
- **Task card:** account-tinted round checkbox; title (double-click to edit); flags (★ priority, "now", labels, due chip with "Today/Tmrw/3d late", subtask `x/y`); hover actions (Park, kebab); inline **expanded editor** with quick-due pills (**! / !! / EOW**, date picker), notes (→ Todoist description), and subtasks. Inline subtask preview when collapsed.
- **Focus mode:** localStorage-persisted **Pomodoro timer** (25/5 or 50/10), a cross-area "now" task list, browser notification + Web-Audio chime on phase end, 🍅 tally, "carry over / start fresh."
- **Todoist mapping:** areas ↔ projects; Park/Now ↔ special labels; priority ↔ p1; due ↔ date (no time); subtasks ↔ parent/child tasks; complete ↔ close/reopen.

### 4.4 Social / Contacts (`social.jsx`) — personal CRM

A relationship-memory screen backed by Google People.

- **Header:** `Social` · "{n} contacts · {m} tags" · buttons: **Networks** toggle, **Grid/List** toggle, **Manage tags**, **Add contact**.
- **Filter + search:** group ("tag") filter chips + a search box (matches **name and city only**).
- **Birthday banner:** passive amber banner for birthdays within 14 days (🎂).
- **Contact card (full):** initials avatar (**no photos**), name, inline tag chips (+ add), location lines (From / Now / Via), inline **🎁 gift ideas**, **birthday** badge + free-text **"Last seen"**, kebab (Edit/Delete), click-to-edit **Context**, **Linked contacts** (relationship pills grouped by free-text group), and **"Recent updates"** (timestamped notes, add/delete, read-more). A **compact/grid** variant is a denser read-only summary.
- **Linked contacts:** a 3-step inline wizard (search/create → relationship → optional group); auto-creates the reverse link. **Networks view** renders connected-component "Network · n people" cards (text list, **not a visual graph**).
- **Detail = modal** (only reachable by clicking a linked pill).
- **Google specifics:** custom fields (`from`, `lastSeen`, `giftIdeas`, `context`, `introducedBy`, `linkedContacts` JSON) live in Google `userDefined`; **no connect/sync UI**; not-connected fails silently to an empty state.

### 4.5 Settings (`hub.jsx` → `SettingsTab`)

Manage **areas/accounts**: rename, recolor (color picker writes live CSS variables `--acc-{id}`), persisted to `prefs` (`areas`) + localStorage. Also surfaces the **version/changelog**. (This screen shares a file with the hub and is comparatively thin.)

### 4.6 NFC quick-logging — **backend only, UI missing**

`api/nfc.js` implements a tap endpoint (`/api/nfc?tap=1&type=routine|habit&id=…&uid=…&token=…`) that validates a per-user token (`prefs.nfc-token`), upserts today's `routine_log`/`habit_log`, and returns a styled standalone success page. **The settings UI to generate the token / pick items does not exist in `src/`** (the old `HANDOFF.md` references a `NfcTagsSection` that isn't in the codebase). This is a **net-new design surface** if NFC is to be user-configurable.

---

## 5. Data model (entities & relationships)

```
Area/Account (hardcoded: findem | jones | personal)  ── color-codes ──▶ tasks, habits, goals

Habit { id, name, target(/wk), account, active }
   └─ HabitLog { habit_id + log_date → done }            (one cell per day)
Routine { id, name, icon, useIcon, trackOnly, active }
   └─ RoutineLog { routine_id + log_date → done }
Goal { id, name, description, kpi, status, account, target_date }
   ├─ goal_habit_links (goal ↔ habit, many-to-many)
   └─ GoalTask { id, name, done }                        (one-off actions)
Checkin { user_id + date, gratitude[3], learnings[3], sectionsDone{}, completed, habitsUpdatedConfirmed }
Pref { user_id + key → value(JSON) }                     (areas, order, nfc-token, nfc-items, group icons, google token)

Task (Todoist) { id, title, account(project), parked, now, done, priority, details, due(int offset), labels[], subtasks[] }
Contact (Google) { id, name, from, city, birthday, groups[], lastSeen, giftIdeas, context, introducedBy, linkedContacts[], notes[] }
ContactGroup { id, name, icon(emoji, stored in Supabase prefs) }
ContactNote { id, contactId, text, timestamp }
```

Frontend state (`useAppData.js`) loads **everything in parallel on mount**, applies **optimistic updates** to local state, then syncs in the background (`.catch(console.error)`); temp ids (`h-`, `g-`, …) are swapped for server ids on resolve. There is **no realtime, no polling, no manual refresh** — external changes require a reload.

---

## 6. Design system audit (current)

### 6.1 Tokens (`styles.css :root`)

| Group | Tokens |
|---|---|
| **Surfaces** | `--bg #FFFFFF` · `--surface #FAFAFA` · `--surface-2 #F4F4F5` · `--border #E5E5E5` · `--border-soft #F1F1F2` |
| **Text** | `--text #1A1A1A` · `--text-2 #5F6368` · `--text-3 #A0A0A0` |
| **Area accents** | `--acc-findem #3B82F6` (blue) · `--acc-jones #8B5CF6` (purple) · `--acc-personal #64748B` (slate) — *runtime-overridable in Settings* |
| **Status** | `--success #10B981` · `--warning #F59E0B` · `--error #EF4444` + tints (blue/green/amber/red) |
| **Brand** | **#6C63FF** (indigo) — logo, beta chip, To-Do accent (`--tdx-brand`). *Not a defined global token — appears as literals.* |
| **Type** | UI: **Inter** (400–700) · Mono: **JetBrains Mono**. Base 15px / 1.5, letter-spacing −0.005em. Page title 30/700. |
| **Radius** | `--r-sm 6` · `--r-md 10` · `--r-lg 14` · `--r-pill 999` |
| **Shadow** | `--shadow-sm` · `--shadow-md` · `--shadow-pop` (all very soft, low-opacity) |
| **Motion** | `--t-fast 100ms` · `--t 150ms` · `--t-slow 220ms cubic-bezier(.2,.7,.2,1)` |

**Theme:** **light only** — there is **no dark mode** and no `prefers-color-scheme` handling anywhere.

### 6.2 Components / primitives (in `shared.jsx` + `styles.css`)
Cards · buttons (`.btn`, `.btn-primary` = near-black, `.btn-text`, `.btn-link` = blue) · custom **Checkbox** (square/circle, account-tinted when checked) · **AccountDot** · **Pill** · **StatusBadge** (green/amber/red/grey) · text/underline **inputs** (textareas tint when filled) · **progress bar** · inline **SVG icon set** (~18 icons, hand-drawn, 12–14px) · **EmojiRain** confetti.

### 6.3 Patterns
- **Aesthetic:** minimalist, light, dense, near-monochrome with small color accents (area dots, status). Soft shadows, generous radii, lots of small (11.5–13.5px) text. A "quiet productivity tool" look.
- **Interaction:** optimistic updates + global **toasts** ("Saved"/"Deleted"); inline click-to-edit (blur/Enter/Esc); HTML5 **drag-reorder** (habits/routines/check-in); hover-revealed actions; modals for create/edit; celebratory confetti on check-in completion.
- **Responsive:** a handful of breakpoints (560/640/820/900px) that mostly collapse multi-column layouts to one column. No systematic mobile design.

---

## 7. Cross-cutting states
- **Loading:** global only — centered logo + "Loading Tether… / Connecting to Notion" (stale copy).
- **Error:** global only — "⚠️ Failed to load data" + Retry (reload).
- **Empty:** good per-section copy in most places (e.g. "All clear.", "No contacts yet.").
- **Failure mode:** background write failures are **silent** (`console.error` only) — no rollback, no error toast; the optimistic UI can silently diverge from the server.

---

## 8. Prioritized problem inventory (what to fix in the revamp)

**P0 — correctness / credibility**
1. **Undefined CSS tokens** `--accent`, `--hover`, `--text-1` are referenced ~15×+ (heavily in Social) but **never defined** → accent affordances render inconsistently/invisibly. Highest-impact, lowest-effort fix.
2. **Broken progress-bar semantics:** `is-warn` and `is-bad` both render the **same grey** as default — only "good" (green) is distinct, so "below target" looks identical to "in progress." Restore amber/red.
3. **Stale copy / data:** "Connecting to Notion" loading text; hardcoded "Q2 2026 · Week 7 of 12" that contradicts WAM's computed week.
4. **Silent write failures** — add error toasts + rollback (or a sync indicator).

**P1 — touch / PWA readiness (it's an installable mobile app)**
5. **Hover-only affordances everywhere** (kebab menus open on hover, action buttons revealed on `:hover`, JS hover-color swaps, nav dropdowns) — **unusable on touch**.
6. **Double-click-to-edit** titles and **dense 7-column grids** with fixed pixel widths don't adapt to phones.
7. No true mobile layout system; the separate `public/mobile.*` shell suggests mobile was bolted on, not designed in.

**P2 — IA & consistency**
8. **"Tags" vs "Groups"** naming collision in Social; plus a *second*, unrelated "group" concept on contact links.
9. **Grid/List toggle is inverted** (`compact` state = grid view) — confusing mental model.
10. **Inconsistent day labels** (Habits "M T W T F S S" with ambiguous repeats vs Routines "Mon…Sun").
11. **Redundant action surfaces** in To-Do (kebab menu vs expanded pill row do the same things with different labels).
12. **Cryptic controls** ("!", "!!", "EOW") that rely on tooltips (absent on touch).
13. **`hub.jsx` mixes two unrelated screens** (Hub + Settings, 1,225 lines); pervasive inline styles fight the token system.

**P3 — dead / missing functionality (design debt)**
14. **Dead controls:** the "This Week/Month/Quarter" selects do nothing; the routine **"+ Add" button has no handler**; routines **can't be created or deleted** from the UI; account-menu "Help" / "Keyboard shortcuts" are no-ops.
15. **NFC settings UI doesn't exist** (backend only).
16. **No goal status/target-date fields** in the goal modal though cards render them.
17. **No account/label editing** on existing tasks despite backend support.

---

## 9. Design-revamp brief

### 9.1 Goals & success criteria
A revamp should aim to make Tether feel like a **single, calm, modern daily OS that is genuinely mobile-first** — without losing its dense, information-rich power-user character. Success looks like:
- Every primary action is **one-tap on a phone** (no hover, no double-click).
- A **coherent visual system** (defined tokens, optional dark mode, consistent components) replacing ad-hoc inline styles.
- **Consistent IA & vocabulary** across the five screens.
- The **morning-ritual → daily-execution flow** (Check-In → To-Do) is the emotional and structural spine.

### 9.2 Proposed design principles
1. **Ritual first** — the day starts at Check-In; the design should make completing it feel rewarding (the confetti instinct is right; extend that delight thoughtfully).
2. **One surface, many contexts** — areas/accounts are the organizing color system; make them legible and consistent everywhere.
3. **Calm density** — keep the information richness, but with clearer hierarchy, spacing rhythm, and fewer competing accents.
4. **Touch-native** — every affordance works with a thumb; reserve hover for enhancement only.
5. **Honest states** — loading, empty, error, and "not connected" are designed, not silent.

### 9.3 Opportunities / net-new to consider
- **Dark mode** (none today).
- **Contact photos** (Google provides them; the app currently discards them).
- A real **relationship-graph visualization** (the "Networks" button promises it; today it's a text list).
- A true **"keep in touch" cadence** (turn free-text "Last seen" into a real date + overdue nudges).
- **NFC configuration UI** (token display/regenerate + item picker) against the existing backend contract.
- **Realtime/refresh** affordances (optimistic-only today).
- **Habit streaks / richer history** (only weekly counts today).

### 9.4 Hard constraints & non-negotiables (design within these)
- **Vercel 12-function limit:** the API is at exactly 12 routes — a redesign must **not require new endpoints** without consolidating existing ones.
- **Backend contracts are fixed unless intentionally changed:** Todoist (projects=areas, p1=priority, special labels), Google `userDefined` field mapping, Supabase schema, and the **NFC tap URL format** (existing physical tags depend on it).
- **Auth stays Clerk; data stays Supabase/Todoist/Google.** The "areas" model (Findem/Jones/Personal) is load-bearing across all three backends.
- **PWA / installable** — the design must hold up at phone widths and as a standalone app.

### 9.5 Open decisions (please confirm before design)
- **Single-user or multi-user?** Much is hardcoded to one person; do we keep it bespoke or generalize (custom areas, per-user Google auth)?
- **Scope:** redesign **all five screens**, or start with the spine (Check-In + To-Do)?
- **Visual direction:** evolve the current minimalist light theme, or a bolder reinvention? Keep brand indigo #6C63FF?
- **Do the Chrome extension and mobile shell need to match** the new design, or are they out of scope?
- **Fidelity of deliverable:** wireframes/IA, a full visual design system, or interactive HTML prototypes (the original Claude Design workflow)?

---

## 10. Recommended approach & phasing
1. **Foundation (P0):** define the missing tokens, fix bar semantics, audit copy — quick wins that stabilize the current UI.
2. **Design system:** lock a token set (incl. dark mode), component library, iconography, and the area-color system; migrate inline styles to tokens.
3. **Spine redesign:** Check-In → To-Do, mobile-first.
4. **Hub & Social:** habits/routines/goals/WAM, then the CRM (photos, graph, cadence).
5. **Net-new surfaces:** NFC settings, connection/sync states.

Because Tether was born in **Claude Design (claude.ai/design)**, the most direct path to high-fidelity exploration is to mock the new direction there as HTML/CSS prototypes and sync them back into this repo component-by-component (the `/design-sync` workflow), exactly as the original build was done.

---

## Appendix — file map

| Area | File |
|---|---|
| Routing / auth / shell | `src/App.jsx` |
| State + all actions + data load | `src/useAppData.js` |
| Shared primitives, icons, TopBar, confetti, `ACCOUNTS` | `src/shared.jsx` |
| Daily Check-In | `src/checkin.jsx` |
| Habits + Health hub **and** Settings | `src/hub.jsx` |
| To-Do board + Focus | `src/todo.jsx` |
| Social / Contacts | `src/social.jsx` |
| Drag-reorder + prefs sync | `src/useOrder.js` |
| API client | `src/api.js` |
| **All styles & tokens** | `src/styles.css` (~2,600 lines) |
| API (12 routes) | `api/*.js` (Supabase / Todoist / Google / NFC) |
| Original design mockup + transcript | `project/` · `chats/chat1.md` |
| Companion surfaces | `tether-extension/`, `extension/`, `public/mobile.*` |
