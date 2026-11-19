-- Three more visit steps for shared links: the arrival dialog shown, its cards printed straight away, or added to the sheet.
create or replace function public.record_hit(kind text, path text, target text, referrer text, zone text, device text, entry boolean)
returns void language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if record_hit.kind not in ('view', 'print', 'shop', 'step')
     or (record_hit.kind = 'step' and record_hit.target not in ('return', 'new', 'add', 'preview', 'printed', 'import', 'import-link', 'share', 'save-prompt', 'save-prompt-click', 'reprint', 'shared-open', 'shared-print', 'shared-add'))
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
