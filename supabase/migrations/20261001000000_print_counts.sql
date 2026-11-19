-- Anonymous print ranking for the "most printed" pages: one row per printed card, no user or device data.
create table if not exists public.print_counts (
  game_id bigint not null,
  card_id bigint not null,
  card jsonb not null,
  prints integer not null default 0 check (prints >= 0),
  updated_at timestamptz not null default now(),
  primary key (game_id, card_id)
);
create index if not exists print_counts_ranking on public.print_counts (game_id, prints desc);

alter table public.print_counts enable row level security;
-- Safe to run again: the policy is recreated rather than duplicated.
drop policy if exists "Anyone can read the print ranking" on public.print_counts;
create policy "Anyone can read the print ranking" on public.print_counts for select using (true);

-- Counts one print per distinct card of a sheet (copies do not multiply). Writes only through this function,
-- which validates the payload; the table itself has no insert or update policy.
create or replace function public.record_prints(game bigint, cards jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare item jsonb;
begin
  if jsonb_typeof(cards) <> 'array' or jsonb_array_length(cards) = 0 or jsonb_array_length(cards) > 60 then
    raise exception 'invalid cards payload';
  end if;
  for item in select distinct on (value->>'id') value from jsonb_array_elements(cards) loop
    if (item->>'id') !~ '^[1-9][0-9]{0,15}$' or coalesce(length(item->>'name'), 0) not between 1 and 200 or length(item::text) > 4000 then
      continue;
    end if;
    insert into public.print_counts as current (game_id, card_id, card, prints, updated_at)
    values (game, (item->>'id')::bigint, item, 1, now())
    on conflict (game_id, card_id) do update set prints = current.prints + 1, card = excluded.card, updated_at = now();
  end loop;
end;
$$;
revoke all on function public.record_prints(bigint, jsonb) from public;
grant execute on function public.record_prints(bigint, jsonb) to anon, authenticated;
