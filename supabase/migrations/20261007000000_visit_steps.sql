-- Steps of a visit, counted once per page load: whether the visitor had been here on an earlier day ('return' or 'new',
-- from a date kept in the browser), then added a card, opened the preview, printed, imported a list (pasted or from a
-- deck link) and shared a list. Still daily counters: nothing ties the steps of one visit together.
alter table public.site_stats drop constraint if exists site_stats_kind_check;
alter table public.site_stats add constraint site_stats_kind_check check (kind in ('view', 'print', 'shop', 'step'));

create or replace function public.record_hit(kind text, path text, target text, referrer text, zone text, device text, entry boolean)
returns void language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if record_hit.kind not in ('view', 'print', 'shop', 'step')
     or (record_hit.kind = 'step' and record_hit.target not in ('return', 'new', 'add', 'preview', 'printed', 'import', 'import-link', 'share'))
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

create or replace function public.site_report(days integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare since date := (now() at time zone 'utc')::date - greatest(least(days, 366), 1) + 1;
begin
  if not exists (select 1 from public.stats_admins where user_id = auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (
    with recent as (
      select *, split_part(path, '/', 2) as lang, split_part(path, '/', 3) as game, split_part(path, '/', 4) as expansion
      from public.site_stats where day >= since
    )
    select jsonb_build_object(
      'since', since,
      'daily', (select coalesce(jsonb_agg(d order by d.day), '[]') from (
        select day,
          sum(entries) filter (where kind = 'view') as visits,
          sum(hits) filter (where kind = 'view') as views,
          sum(hits) filter (where kind = 'print') as prints,
          sum(hits) filter (where kind = 'shop') as shop
        from recent group by day) d),
      'games', (select coalesce(jsonb_agg(g order by g.views desc), '[]') from (
        select game,
          coalesce(sum(hits) filter (where kind = 'view'), 0) as views,
          coalesce(sum(entries) filter (where kind = 'view'), 0) as visits,
          coalesce(sum(hits) filter (where kind = 'print'), 0) as prints,
          coalesce(sum(hits) filter (where kind = 'shop'), 0) as shop
        from recent group by game) g),
      'sets', (select coalesce(jsonb_agg(s order by s.views desc), '[]') from (
        select game, expansion, sum(hits) as views from recent
        where kind = 'view' and expansion <> '' group by game, expansion order by views desc limit 25) s),
      'pages', (select coalesce(jsonb_agg(p order by p.views desc), '[]') from (
        select path, sum(hits) as views, sum(entries) as visits from recent
        where kind = 'view' group by path order by views desc limit 30) p),
      'languages', (select coalesce(jsonb_agg(l order by l.views desc), '[]') from (
        select lang, sum(hits) as views from recent where kind = 'view' group by lang) l),
      'referrers', (select coalesce(jsonb_agg(r order by r.visits desc), '[]') from (
        select referrer, sum(entries) as visits from recent
        where kind = 'view' and entries > 0 group by referrer order by visits desc limit 20) r),
      'zones', (select coalesce(jsonb_agg(z order by z.visits desc), '[]') from (
        select zone, sum(entries) as visits from recent
        where kind = 'view' and entries > 0 group by zone order by visits desc limit 25) z),
      'devices', (select coalesce(jsonb_agg(v order by v.visits desc), '[]') from (
        select device, sum(entries) as visits from recent
        where kind = 'view' and entries > 0 group by device) v),
      'steps', (select coalesce(jsonb_agg(t order by t.count desc), '[]') from (
        select target as step, sum(hits) as count from recent where kind = 'step' group by target) t),
      'shops', (select coalesce(jsonb_agg(c order by c.clicks desc), '[]') from (
        select target, sum(hits) as clicks from recent where kind = 'shop' group by target) c)
    )
  );
end;
$$;
revoke all on function public.site_report(integer) from public;
grant execute on function public.site_report(integer) to authenticated;
