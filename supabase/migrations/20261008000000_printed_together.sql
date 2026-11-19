-- "Often printed with": how many sheets two cards shared, from anonymous print sheets (card ids only, no user,
-- device or sheet stored). Each pair is kept in both directions so a card page reads its row with one index lookup.
create table if not exists public.print_pairs (
  game_id bigint not null,
  card_id bigint not null,
  other_id bigint not null,
  together integer not null default 0 check (together >= 0),
  primary key (game_id, card_id, other_id)
);
create index if not exists print_pairs_ranking on public.print_pairs (game_id, card_id, together desc);
-- No policies: written only by record_pairs and read only through printed_with.
alter table public.print_pairs enable row level security;

-- One sheet's distinct cards (2 to 100: bigger sheets are whole sets, not decks, and say nothing about pairings).
create or replace function public.record_pairs(game bigint, cards bigint[]) returns void
language plpgsql security definer set search_path = public as $$
declare ids bigint[];
begin
  select array_agg(distinct id) into ids from unnest(cards) as id where id > 0;
  if ids is null or array_length(ids, 1) < 2 or array_length(ids, 1) > 100 then
    return;
  end if;
  insert into public.print_pairs as current (game_id, card_id, other_id, together)
  select game, a, b, 1 from unnest(ids) as a cross join unnest(ids) as b where a <> b
  on conflict (game_id, card_id, other_id) do update set together = current.together + 1;
end;
$$;
revoke all on function public.record_pairs(bigint, bigint[]) from public;
grant execute on function public.record_pairs(bigint, bigint[]) to anon, authenticated;

-- The cards printed most often with any of the given ids (a card's printings in several languages), with their
-- snapshot from the print ranking. Pairs seen on a single sheet are left out: one person's list is not a pattern.
create or replace function public.printed_with(game bigint, cards bigint[], lim integer default 12)
returns table (card jsonb, together integer)
language sql stable security definer set search_path = public as $$
  select counts.card, pairs.together::integer from (
    select other_id, sum(together) as together from public.print_pairs
    where game_id = game and card_id = any(cards) and not (other_id = any(cards))
    group by other_id having sum(together) >= 2
    order by together desc limit greatest(least(lim, 24), 1)
  ) pairs
  join public.print_counts counts on counts.game_id = game and counts.card_id = pairs.other_id
  order by pairs.together desc;
$$;
revoke all on function public.printed_with(bigint, bigint[], integer) from public;
grant execute on function public.printed_with(bigint, bigint[], integer) to anon, authenticated;
