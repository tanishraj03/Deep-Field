-- Deep Field — Supabase schema (free tier).
-- Run once in Supabase Studio → SQL Editor. Existing Deep Field databases
-- already have this table and need nothing new.
--
-- Everything Deep Field keeps is a JSON document in one key-value table:
--   scan:<niche>       the latest scan of a niche (topics, threads, volume)
--   signals            spiking searches, pages and tags
--   explore:<r>:<id>   a cached Explore search (3h)
--   insight:<r>:<id>   its AI read (3h)

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists idx_app_settings_updated on app_settings (updated_at desc);

-- The service-role key used by the server bypasses RLS, and no anon key is
-- issued to the browser, so nothing here is publicly readable.
alter table app_settings enable row level security;

-- Housekeeping: drop cached searches older than a week.
create or replace function prune_explore_cache()
returns void language sql as $$
  delete from app_settings
  where (key like 'explore:%' or key like 'insight:%')
    and updated_at < now() - interval '7 days';
$$;
