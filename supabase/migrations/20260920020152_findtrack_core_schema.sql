create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  legacy_firebase_uid text unique,
  name text not null default 'Student',
  avatar_url text,
  bio text not null default '',
  location text not null default '',
  contact text not null default '',
  new_matches_notif boolean not null default true,
  community_alerts_notif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id text primary key check (id <> '' and char_length(id) <= 128 and id ~ '^[A-Za-z0-9_-]+$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('lost','found')),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  category text not null check (category in ('electronics','keys','wallet','documents','clothing','jewelry','bags','others')),
  location text not null default '' check (char_length(location) <= 200),
  status text not null default 'active' check (status in ('active','resolved')),
  image_url text check (image_url is null or char_length(image_url) <= 500),
  contact_name text not null default '' check (char_length(contact_name) <= 100),
  contact_info text not null default '' check (char_length(contact_info) <= 200),
  date timestamptz not null,
  verification_question text not null default '' check (char_length(verification_question) <= 500),
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.item_secrets (
  item_id text primary key references public.items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  security_answer text not null check (char_length(security_answer) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.claims (
  id text primary key check (id <> '' and char_length(id) <= 128),
  item_id text not null references public.items(id) on delete cascade,
  claimer_id uuid not null references public.profiles(id) on delete cascade,
  finder_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_read_by_finder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id text primary key check (id <> '' and char_length(id) <= 128),
  lost_item_id text not null references public.items(id) on delete cascade,
  found_item_id text not null references public.items(id) on delete cascade,
  confidence_score numeric(5,2) not null check (confidence_score between 0 and 100),
  match_reason text not null default '' check (char_length(match_reason) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lost_item_id <> found_item_id)
);

create table public.chats (
  chat_id text primary key check (chat_id <> '' and char_length(chat_id) <= 128),
  participants uuid[] not null,
  item_id text not null references public.items(id) on delete cascade,
  last_message text not null default '' check (char_length(last_message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(participants) = 2),
  check (participants[1] <> participants[2])
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references public.chats(chat_id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index items_user_id_idx on public.items(user_id);
create index items_type_status_idx on public.items(type, status);
create index items_category_idx on public.items(category);
create index items_created_at_idx on public.items(created_at desc);
create index claims_item_id_idx on public.claims(item_id);
create index claims_claimer_id_idx on public.claims(claimer_id);
create index claims_finder_id_idx on public.claims(finder_id);
create index claims_status_idx on public.claims(status);
create index matches_lost_item_id_idx on public.matches(lost_item_id);
create index matches_found_item_id_idx on public.matches(found_item_id);
create index matches_status_idx on public.matches(status);
create index chats_item_id_idx on public.chats(item_id);
create index chat_messages_chat_id_created_at_idx on public.chat_messages(chat_id, created_at);

create or replace function private.set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
  else
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger profiles_timestamps
before insert or update on public.profiles
for each row execute function private.set_timestamps();

create trigger items_timestamps
before insert or update on public.items
for each row execute function private.set_timestamps();

create trigger item_secrets_timestamps
before insert or update on private.item_secrets
for each row execute function private.set_timestamps();

create trigger claims_timestamps
before insert or update on public.claims
for each row execute function private.set_timestamps();

create trigger matches_timestamps
before insert or update on public.matches
for each row execute function private.set_timestamps();

create trigger chats_timestamps
before insert or update on public.chats
for each row execute function private.set_timestamps();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', 'Student'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

revoke all on schema private from public;
grant usage on schema private to service_role;
grant usage on schema private to authenticated;

revoke execute on function private.set_timestamps() from public, anon, authenticated, service_role;
revoke execute on function private.handle_new_user() from public, anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table private.item_secrets enable row level security;
alter table public.claims enable row level security;
alter table public.matches enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

revoke all on table public.profiles, public.items, public.claims, public.matches, public.chats, public.chat_messages from anon, authenticated, public;
revoke all on table private.item_secrets from anon, authenticated, public;

grant select, insert, delete on public.profiles to authenticated;
grant update (name, avatar_url, bio, location, contact, new_matches_notif, community_alerts_notif) on public.profiles to authenticated;
grant select, insert on public.items to authenticated;
grant update (title, description, category, location, status, image_url, contact_name, contact_info, date, verification_question, claimed) on public.items to authenticated;
grant delete on public.items to authenticated;
grant select, insert, update on public.claims to authenticated;
grant select, insert, update, delete on public.matches to authenticated;
grant select, insert, update on public.chats to authenticated;
grant select, insert on public.chat_messages to authenticated;

grant all on public.profiles, public.items, public.claims, public.matches, public.chats, public.chat_messages to service_role;
grant all on private.item_secrets to service_role;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "profiles_delete_own"
on public.profiles for delete
to authenticated
using ((select auth.uid()) = id);

create policy "items_select_authenticated"
on public.items for select
to authenticated
using (true);

create policy "items_insert_own"
on public.items for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "items_update_own"
on public.items for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "items_delete_own"
on public.items for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "claims_select_participant"
on public.claims for select
to authenticated
using ((select auth.uid()) = claimer_id or (select auth.uid()) = finder_id);

create policy "claims_insert_valid"
on public.claims for insert
to authenticated
with check (
  (select auth.uid()) = claimer_id
  and finder_id <> (select auth.uid())
  and status = 'pending'
  and is_read_by_finder = false
  and exists (
    select 1
    from public.items i
    where i.id = item_id
      and i.type = 'found'
      and i.status = 'active'
      and i.user_id = finder_id
  )
);

create policy "claims_update_finder_only"
on public.claims for update
to authenticated
using ((select auth.uid()) = finder_id)
with check ((select auth.uid()) = finder_id);

create policy "matches_select_owners"
on public.matches for select
to authenticated
using (
  exists (
    select 1 from public.items i
    where i.id = lost_item_id and i.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.items i
    where i.id = found_item_id and i.user_id = (select auth.uid())
  )
);

create policy "matches_insert_owner"
on public.matches for insert
to authenticated
with check (
  exists (
    select 1 from public.items i
    where i.id = lost_item_id
      and i.user_id = (select auth.uid())
      and i.type = 'lost'
  )
  or exists (
    select 1 from public.items i
    where i.id = found_item_id
      and i.user_id = (select auth.uid())
      and i.type = 'found'
  )
);

create policy "matches_update_owners"
on public.matches for update
to authenticated
using (
  exists (
    select 1 from public.items i
    where i.id = lost_item_id and i.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.items i
    where i.id = found_item_id and i.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.items i
    where i.id = lost_item_id and i.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.items i
    where i.id = found_item_id and i.user_id = (select auth.uid())
  )
);

create policy "matches_delete_owners"
on public.matches for delete
to authenticated
using (
  exists (
    select 1 from public.items i
    where i.id = lost_item_id and i.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.items i
    where i.id = found_item_id and i.user_id = (select auth.uid())
  )
);

create policy "chats_select_participants"
on public.chats for select
to authenticated
using ((select auth.uid()) = any(participants));

create policy "chats_insert_participant"
on public.chats for insert
to authenticated
with check (
  (select auth.uid()) = any(participants)
  and exists (
    select 1 from public.items i
    where i.id = item_id
  )
);

create policy "chats_update_participants"
on public.chats for update
to authenticated
using ((select auth.uid()) = any(participants))
with check ((select auth.uid()) = any(participants));

create policy "messages_select_participants"
on public.chat_messages for select
to authenticated
using (
  exists (
    select 1 from public.chats c
    where c.chat_id = chat_id
      and (select auth.uid()) = any(c.participants)
  )
);

create policy "messages_insert_participant_sender"
on public.chat_messages for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.chats c
    where c.chat_id = chat_id
      and (select auth.uid()) = any(c.participants)
  )
);
