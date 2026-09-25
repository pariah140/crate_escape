create table if not exists public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;
revoke all on public.player_saves from anon;
grant select, insert, update, delete on public.player_saves to authenticated;

create policy "Players read their own progress" on public.player_saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players create their own progress" on public.player_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update their own progress" on public.player_saves
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Players delete their own progress" on public.player_saves
  for delete to authenticated using ((select auth.uid()) = user_id);
