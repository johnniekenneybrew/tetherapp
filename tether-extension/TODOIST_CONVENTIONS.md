# Todoist conventions for Tether

Every task in Todoist is read by the Tether apps (web app + Chrome extension).
**Tether state is expressed entirely through Todoist labels, priority, due date,
and parent/child relationships — there is no separate database.** Follow these
rules so tasks stay consistent across all apps.

> Source of truth in code: `api/tasks.js` (label mapping, priority mapping,
> due-date conversion) and `tether-extension/sidepanel.js` (views & Focus Mode).

## Labels

A task's labels carry its meaning. There are exactly three categories.

### 1. Account label — required, exactly one per task
- `getro` — Getro/Findem work
- `jones` — Jones work
- `personal` — everything else

Every task must have **one and only one** account label. If none is set, Tether
treats it as `personal`. Never put two account labels on the same task. When
moving a task between areas, remove the old account label and add the new one.

### 2. `parked` — optional
- Add `parked` to shelve a task for later. Parked tasks disappear from the
  All / Today / This week views and only show in the "Parking" view.
- Remove `parked` to bring it back into active rotation.

### 3. `now` — optional (Focus Mode)
- Add `now` to put a task into **Focus Mode** (the Pomodoro view). Only
  `now`-tagged tasks appear there.
- Remove `now` to take it out of Focus.
- A task can be `now` and still be active in its normal view — `now` is additive.

These three coexist freely, e.g. labels `["jones", "now"]` = a Jones task
currently in Focus. Valid combos: one account label, plus optionally `parked`
and/or `now`.

**Do not invent other labels.** Only `getro`, `jones`, `personal`, `parked`,
`now` are recognized. Any other label is ignored by Tether but clutters the
data — avoid creating new ones.

## Priority
- Todoist **priority 4 (urgent / p1)** = flagged/important in Tether.
- Todoist **priority 1 (normal / p4)** = not flagged.
- Use only p1 (urgent) or p4 (normal); p2/p3 are treated the same as normal.

## Due dates
- Use a real Todoist **due date** (a calendar date). Tether shows it as
  Today / Tomorrow / a date, and the Today and This week views filter on it.
- "Today" = today's date, "Tomorrow" = tomorrow, "This week" = a date later
  this week (before next Monday).
- No due date = the task only lives in the "All" view.

## Subtasks
- Subtasks are real Todoist **child tasks** (set the parent). Don't fake
  subtasks with text bullets in the description.
- A subtask inherits its parent's account; keep them aligned.

## Completion
- Mark done by **closing** the task in Todoist (not by deleting). Reopen to
  un-complete.
- Don't delete a task to "finish" it — delete only means the task should
  disappear entirely.

## Description
- The task **description** is the "notes" field shown in Tether. Put context
  there, not in the title.

## Consistency expectations
- Never strip the account label when editing other fields.
- When you change an area, swap the account label rather than adding a second one.
- Prefer editing the existing task over creating a duplicate.
- Quick mappings:
  - "focus on X" → add `now`
  - "park X" → add `parked`
  - "move X to Jones" → set the account label to `jones`
  - "X is urgent" → set priority p1
