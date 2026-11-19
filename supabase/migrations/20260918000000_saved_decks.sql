create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 80),
  game_id integer,
  game_name text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.decks enable row level security;

create policy "Users read their own decks" on public.decks for select using (auth.uid() = user_id);
create policy "Users create their own decks" on public.decks for insert with check (auth.uid() = user_id);
create policy "Users update their own decks" on public.decks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete their own decks" on public.decks for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger decks_set_updated_at before update on public.decks for each row execute function public.set_updated_at();
