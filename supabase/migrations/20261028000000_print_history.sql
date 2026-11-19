-- Every print of a signed-in visitor: the cards, the print settings and when. The app keeps the latest ones on the
-- device for everyone and uploads them here at sign-in, so the history follows the account to other devices.
create table if not exists public.print_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  game_id bigint,
  game_name text check (game_name is null or char_length(game_name) <= 80),
  method text not null check (method in ('browser', 'pdf', 'png')),
  copies integer not null check (copies between 1 and 2000),
  items jsonb not null,
  settings jsonb not null default '{}'::jsonb,
  printed_at timestamptz not null default now()
);
create index if not exists print_history_user_printed on public.print_history (user_id, printed_at desc);

alter table public.print_history enable row level security;

create policy "Users read their own prints" on public.print_history for select using (auth.uid() = user_id);
create policy "Users add their own prints" on public.print_history for insert with check (auth.uid() = user_id);
create policy "Users update their own prints" on public.print_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete their own prints" on public.print_history for delete using (auth.uid() = user_id);

-- Three more visit steps: the "keep your prints" prompt shown after a print, a click on it, and a reprint from the history.
create or replace function public.record_hit(kind text, path text, target text, referrer text, zone text, device text, entry boolean)
returns void language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if record_hit.kind not in ('view', 'print', 'shop', 'step')
     or (record_hit.kind = 'step' and record_hit.target not in ('return', 'new', 'add', 'preview', 'printed', 'import', 'import-link', 'share', 'save-prompt', 'save-prompt-click', 'reprint'))
     or record_hit.path !~ '^/[a-z0-9/_-]{0,160}$'
     or record_hit.target !~ '^[a-z0-9.-]{0,80}$'
     or record_hit.referrer !~ '^[a-z0-9.-]{0,80}$'
     or record_hit.zone !~ '^[A-Za-z0-9/_+-]{0,40}$'
     or record_hit.device not in ('', 'mobile', 'desktop') then
    raise exception 'invalid hit';
  end if;
  insert into public.site_stats as current (day, kind, path, target, referrer, zone, device, entries, hits)
  values ((now() at time zone 'utc')::date, record_hit.kind, record_hit.path, record_hit.target, record_hit.referrer,
          record_hit.zone, record_hit.device, case when record_hit.entry then 1 else 0 end, 1)
  on conflict (day, kind, path, target, referrer, zone, device)
  do update set hits = current.hits + 1, entries = current.entries + excluded.entries;
end;
$$;
revoke all on function public.record_hit(text, text, text, text, text, text, boolean) from public;
grant execute on function public.record_hit(text, text, text, text, text, text, boolean) to anon, authenticated;
