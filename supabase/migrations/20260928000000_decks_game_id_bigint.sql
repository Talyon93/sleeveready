-- Native catalogue game ids (9000000001 and up) exceed the integer range.
alter table public.decks alter column game_id type bigint;
