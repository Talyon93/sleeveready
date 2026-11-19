-- Limits on the anonymous write functions (record_hit, record_prints, record_pairs). The anon key is public, so
-- anyone can call them; without limits a script could bloat the tables or push made-up cards into the public
-- "most printed" ranking. The limits live in triggers on the tables, so they apply whatever version of the
-- functions is deployed and the functions do not need to change.

-- Calls per caller and per hour. The caller is a daily-salted hash of the client address, so no address is
-- stored. One row per bucket and caller, plus a global row per bucket as a backstop against rotating addresses.
create table if not exists public.write_throttle (
  bucket text not null,
  caller text not null,
  window_start timestamptz not null,
  calls integer not null,
  primary key (bucket, caller)
);
-- No policies: used only by the definer function below.
alter table public.write_throttle enable row level security;

create or replace function public.write_allowed(p_bucket text, p_per_caller integer, p_global integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  address text := coalesce(headers->>'cf-connecting-ip', split_part(headers->>'x-forwarded-for', ',', 1), 'unknown');
  v_caller text := md5(address || ':' || (now() at time zone 'utc')::date::text || ':sleeveready');
  used integer;
  total integer;
begin
  insert into public.write_throttle as current (bucket, caller, window_start, calls)
  values (p_bucket, v_caller, now(), 1)
  on conflict (bucket, caller) do update set
    calls = case when current.window_start < now() - interval '1 hour' then 1 else current.calls + 1 end,
    window_start = case when current.window_start < now() - interval '1 hour' then now() else current.window_start end
  returning calls into used;

  insert into public.write_throttle as current (bucket, caller, window_start, calls)
  values (p_bucket, '*', now(), 1)
  on conflict (bucket, caller) do update set
    calls = case when current.window_start < now() - interval '1 hour' then 1 else current.calls + 1 end,
    window_start = case when current.window_start < now() - interval '1 hour' then now() else current.window_start end
  returning calls into total;

  -- Old callers are cleared now and then instead of by a scheduled job.
  if random() < 0.01 then
    delete from public.write_throttle where window_start < now() - interval '1 day';
  end if;
  return used <= p_per_caller and total <= p_global;
end;
$$;
revoke all on function public.write_allowed(text, integer, integer) from public, anon, authenticated;

-- Statement-level: one check per insert statement. Over the limit, the call fails; the site sends these
-- in the background and ignores failures.
create or replace function public.throttle_public_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- The service role and the dashboard are never limited.
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return null;
  end if;
  if not public.write_allowed(tg_argv[0], tg_argv[1]::integer, tg_argv[2]::integer) then
    raise exception 'too many writes' using errcode = '54000';
  end if;
  return null;
end;
$$;

-- site_stats: one statement per page view or step.
drop trigger if exists throttle_site_stats on public.site_stats;
create trigger throttle_site_stats before insert on public.site_stats
  for each statement execute function public.throttle_public_write('hits', '600', '60000');

-- print_counts: one statement per card of a printed sheet (a big sheet is a few hundred).
drop trigger if exists throttle_print_counts on public.print_counts;
create trigger throttle_print_counts before insert on public.print_counts
  for each statement execute function public.throttle_public_write('prints', '1500', '60000');

-- print_pairs: one statement per sheet, but up to 9,900 rows each.
drop trigger if exists throttle_print_pairs on public.print_pairs;
create trigger throttle_print_pairs before insert on public.print_pairs
  for each statement execute function public.throttle_public_write('pairs', '20', '1000');

-- The ranking shows the card snapshot sent by the browser, so only the fields the page needs are kept, the
-- image must be an https URL or one of the site's own image paths, and names that carry links are dropped.
-- (The pages' Content-Security-Policy already blocks images from hosts outside the catalogue sources.)
create or replace function public.clean_print_card()
returns trigger language plpgsql set search_path = public as $$
declare
  card jsonb := new.card;
  name text := card->>'name';
  image text := card->>'imageUrl';
begin
  if name is null or length(name) not between 1 and 120 or name ~ '[[:cntrl:]<>]' or name ~* '(https?:|www\.|\.(com|net|org|io|ru|xyz)\y)'
     or image is null or image !~ '^(https://[A-Za-z0-9.-]+/|/api/catalog/)' or length(image) > 500
     or (card->>'id') is distinct from new.card_id::text
     or (card->>'gameId') is distinct from new.game_id::text then
    return null;
  end if;
  new.card := jsonb_strip_nulls(jsonb_build_object(
    'id', card->'id', 'gameId', card->'gameId', 'categoryId', card->'categoryId', 'expansionId', card->'expansionId',
    'name', to_jsonb(name), 'version', card->'version', 'collectorNumber', card->'collectorNumber',
    'rarity', card->'rarity', 'language', card->'language', 'imageUrl', to_jsonb(image),
    'imageUrls', (select coalesce(jsonb_agg(url), '[]'::jsonb) from jsonb_array_elements(
      case when jsonb_typeof(card->'imageUrls') = 'array' then card->'imageUrls' else '[]'::jsonb end) as url
      where url #>> '{}' ~ '^(https://[A-Za-z0-9.-]+/|/api/catalog/)' and length(url #>> '{}') <= 500)
  ));
  return new;
end;
$$;
drop trigger if exists clean_print_card on public.print_counts;
create trigger clean_print_card before insert on public.print_counts
  for each row execute function public.clean_print_card();
