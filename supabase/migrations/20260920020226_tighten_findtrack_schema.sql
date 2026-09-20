alter table public.chats drop constraint chats_participants_check;
alter table public.chats
  add constraint chats_participants_check
  check (
    cardinality(participants) = 2
    and participants[1] is not null
    and participants[2] is not null
    and participants[1] <> participants[2]
  );

revoke insert on public.profiles from authenticated;

revoke update on public.claims from authenticated;
grant update (status, is_read_by_finder) on public.claims to authenticated;

revoke update on public.matches from authenticated;
grant update (status) on public.matches to authenticated;

revoke update on public.chats from authenticated;
grant update (last_message) on public.chats to authenticated;

create index item_secrets_user_id_idx on private.item_secrets(user_id);
create index chat_messages_sender_id_idx on public.chat_messages(sender_id);
create index chats_participants_gin_idx on public.chats using gin(participants);

create policy "item_secrets_deny_direct_access"
on private.item_secrets
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

alter default privileges for role postgres in schema public
  revoke all on tables from public;
alter default privileges for role postgres in schema public
  revoke all on sequences from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema private
  revoke all on tables from public;
alter default privileges for role postgres in schema private
  revoke execute on functions from public;
