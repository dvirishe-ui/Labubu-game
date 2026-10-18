-- ============================================================================
-- Labubu: Blind Box Run & Collect - Supabase schema
-- Run this once in the Supabase SQL editor, then enable
-- Authentication -> Providers -> "Allow anonymous sign-ins".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Cloud saves: one JSON document per (anonymous) auth user.
-- ---------------------------------------------------------------------------
create table if not exists public.player_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  player_id  uuid   not null,               -- the game's local profile.playerId
  save       jsonb  not null,               -- full SaveManager document
  updated_at bigint not null,               -- save.meta.updatedAt (ms epoch)
  created_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

drop policy if exists "saves: read own"   on public.player_saves;
drop policy if exists "saves: insert own" on public.player_saves;
drop policy if exists "saves: update own" on public.player_saves;

create policy "saves: read own"   on public.player_saves for select using (auth.uid() = user_id);
create policy "saves: insert own" on public.player_saves for insert with check (auth.uid() = user_id);
create policy "saves: update own" on public.player_saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Server-side guard for the latest-timestamp rule: a stale device can never
-- overwrite a newer cloud save (the client resolves conflicts too).
create or replace function public.guard_save_timestamp()
returns trigger language plpgsql as $$
begin
  if new.updated_at < old.updated_at then
    return old; -- ignore the stale write
  end if;
  return new;
end;
$$;

drop trigger if exists player_saves_guard on public.player_saves;
create trigger player_saves_guard
  before update on public.player_saves
  for each row execute function public.guard_save_timestamp();

-- ---------------------------------------------------------------------------
-- Global leaderboard: best distance per player.
-- ---------------------------------------------------------------------------
create table if not exists public.leaderboard (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text    not null check (char_length(display_name) between 1 and 24),
  high_score   integer not null check (high_score >= 0 and high_score < 1000000),
  doll_id      text,
  updated_at   timestamptz not null default now()
);

create index if not exists leaderboard_high_score_idx on public.leaderboard (high_score desc);

alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard: public read" on public.leaderboard;
drop policy if exists "leaderboard: insert own"  on public.leaderboard;
drop policy if exists "leaderboard: update own"  on public.leaderboard;

create policy "leaderboard: public read" on public.leaderboard for select using (true);
create policy "leaderboard: insert own"  on public.leaderboard for insert with check (auth.uid() = user_id);
create policy "leaderboard: update own"  on public.leaderboard for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Scores only ever go up, whatever the client sends.
create or replace function public.keep_best_score()
returns trigger language plpgsql as $$
begin
  new.high_score := greatest(new.high_score, old.high_score);
  return new;
end;
$$;

drop trigger if exists leaderboard_keep_best on public.leaderboard;
create trigger leaderboard_keep_best
  before update on public.leaderboard
  for each row execute function public.keep_best_score();
