-- Tether app schema — run this in your Supabase SQL Editor
-- Project: lgaqgneewiqnljcoxbhn

-- ── Habits ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  target      INTEGER NOT NULL DEFAULT 5,
  account     TEXT NOT NULL DEFAULT 'personal',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS habits_user_idx ON habits(user_id);

-- ── Habit Log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  habit_id    UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(habit_id, log_date)
);
CREATE INDEX IF NOT EXISTS habit_log_user_date_idx ON habit_log(user_id, log_date);

-- ── Routines ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  icon        TEXT NOT NULL DEFAULT '✨',
  use_icon    BOOLEAN NOT NULL DEFAULT true,
  track_only  BOOLEAN NOT NULL DEFAULT false,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routines_user_idx ON routines(user_id);

-- ── Routine Log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routine_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  routine_id  UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(routine_id, log_date)
);
CREATE INDEX IF NOT EXISTS routine_log_user_date_idx ON routine_log(user_id, log_date);

-- ── Goals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  kpi         TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'in-progress',
  account     TEXT NOT NULL DEFAULT 'personal',
  target_date DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_user_idx ON goals(user_id);

-- ── Goal ↔ Habit links (many-to-many) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_habit_links (
  goal_id   UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  habit_id  UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, habit_id)
);

-- ── Goal Tasks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  goal_id     UUID REFERENCES goals(id) ON DELETE SET NULL,
  name        TEXT NOT NULL DEFAULT '',
  done        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goal_tasks_user_idx ON goal_tasks(user_id, goal_id);

-- ── Check-ins ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkins (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   TEXT NOT NULL,
  date                      DATE NOT NULL,
  gratitude                 JSONB NOT NULL DEFAULT '["","",""]'::jsonb,
  learnings                 JSONB NOT NULL DEFAULT '["","",""]'::jsonb,
  sections_done             JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed                 BOOLEAN NOT NULL DEFAULT false,
  habits_updated_confirmed  BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS checkins_user_date_idx ON checkins(user_id, date);

-- ── Preferences ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prefs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);
CREATE INDEX IF NOT EXISTS prefs_user_key_idx ON prefs(user_id, key);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- RLS is enabled on every table with NO policies, on purpose. The app
-- authenticates with Clerk (not Supabase Auth), and the API talks to Postgres
-- with the service_role key, which bypasses RLS. Enabling RLS with no policies
-- denies the anon/authenticated roles all access — closing direct anon-key
-- reads/writes — while the server keeps full access. Do not add auth.uid()
-- policies unless client-side Supabase calls (with Clerk↔Supabase JWTs) are added.
ALTER TABLE habits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_habit_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE prefs            ENABLE ROW LEVEL SECURITY;
