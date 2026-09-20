-- Fix chat message RLS correlation so policies compare the outer row chat_id
-- against the participant chat row instead of an ambiguous self-reference.

drop policy if exists "chat_messages_select_participant" on public.chat_messages;
create policy "chat_messages_select_participant"
on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chats as c
    where c.chat_id = public.chat_messages.chat_id
      and (select auth.uid()) = any(c.participants)
  )
);

drop policy if exists "chat_messages_insert_sender_participant" on public.chat_messages;
create policy "chat_messages_insert_sender_participant"
on public.chat_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.chats as c
    where c.chat_id = public.chat_messages.chat_id
      and (select auth.uid()) = any(c.participants)
  )
);
