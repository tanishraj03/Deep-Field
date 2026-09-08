-- Daily Intelligence Control Centre — Supabase (free tier) schema
-- Run once in Supabase Studio → SQL Editor.
--
-- Design note: this stays deliberately small. The free tier gives 500 MB;
-- we store payloads as JSONB and prune aggressively so the database never
-- becomes a reason to upgrade.

create table if not exists companies (
  id            text primary key,
  name          text not null,
  slug          text unique,
  industry      text,
  country       text,
  website       text,
  created_at    timestamptz default now()
);

create table if not exists sources (
  id            text primary key,
  name          text not null,
  url           text not null,
  kind          text not null,
  source_type   text not null,
  region        text,
  enabled       boolean default true
);

create table if not exists source_items (
  id            text primary key,
  source_id     text references sources(id) on delete set null,
  title         text not null,
  url           text not null,
  published_at  timestamptz,
  fetched_at    timestamptz default now()
);

-- One row per deduplicated event. `payload` is the IntelligenceItem.
create table if not exists intelligence_items (
  id                text primary key,
  type              text not null check (type in ('trend','funding','marketing','company')),
  title             text not null,
  payload           jsonb not null,
  region            text,
  published_at      timestamptz,
  first_seen_at     timestamptz default now(),
  last_updated_at   timestamptz default now(),
  opportunity_score int,
  trend_score       int
);
create index if not exists idx_items_updated on intelligence_items (last_updated_at desc);
create index if not exists idx_items_type    on intelligence_items (type, last_updated_at desc);
create index if not exists idx_items_opp     on intelligence_items (opportunity_score desc nulls last);

-- Typed views over the same table, so the app has one write path.
create or replace view funding_events as
  select * from intelligence_items where type = 'funding';
create or replace view marketing_events as
  select * from intelligence_items where type = 'marketing';
create or replace view social_signals as
  select * from intelligence_items where type = 'trend';
create or replace view opportunities as
  select * from intelligence_items where opportunity_score is not null;

-- Novelty memory. This is what makes "what changed since yesterday" possible.
create table if not exists seen_events (
  id              text primary key,
  first_seen_at   timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  source_count    int not null default 1,
  mentions        int not null default 1
);

create table if not exists daily_briefs (
  id            text primary key,
  date          date unique not null,
  payload       jsonb not null,
  generated_at  timestamptz default now()
);

create table if not exists sync_runs (
  id            text primary key,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  payload       jsonb not null
);
create index if not exists idx_runs_started on sync_runs (started_at desc);

create table if not exists saved_items (
  item_id     text primary key,
  saved_at    timestamptz default now(),
  note        text
);

create table if not exists outreach_status (
  item_id     text primary key,
  company     text,
  status      text check (status in ('not_contacted','contacted','in_conversation','won','passed')) default 'not_contacted',
  updated_at  timestamptz default now()
);

-- Free-tier AI accounting. One row per day.
create table if not exists ai_usage (
  day       date primary key,
  requests  int not null default 0,
  tokens    bigint not null default 0
);

create table if not exists settings (
  key       text primary key,
  value     jsonb not null,
  updated_at timestamptz default now()
);
insert into settings (key, value)
  values ('bootstrap', '{"initialised": true}'::jsonb)
  on conflict (key) do nothing;

-- Atomic counter so two parallel calls can never undercount AI usage.
create or replace function bump_ai_usage(p_day date, p_tokens bigint)
returns void language plpgsql as $$
begin
  insert into ai_usage (day, requests, tokens)
    values (p_day, 1, p_tokens)
  on conflict (day) do update
    set requests = ai_usage.requests + 1,
        tokens   = ai_usage.tokens + excluded.tokens;
end;
$$;

-- Housekeeping. Call occasionally, or wire into the daily run.
create or replace function prune_old_data()
returns void language sql as $$
  delete from intelligence_items where last_updated_at < now() - interval '45 days';
  delete from sync_runs          where started_at      < now() - interval '30 days';
  delete from seen_events        where last_updated_at < now() - interval '90 days';
  delete from ai_usage           where day             < current_date - 120;
$$;

-- Row level security: the service-role key used by the server bypasses RLS,
-- and no anon key is issued to the browser, so nothing is publicly readable.
alter table intelligence_items enable row level security;
alter table daily_briefs       enable row level security;
alter table sync_runs          enable row level security;
alter table saved_items        enable row level security;
alter table ai_usage           enable row level security;
alter table seen_events        enable row level security;
alter table settings           enable row level security;
