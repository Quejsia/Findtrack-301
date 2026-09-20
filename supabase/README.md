# FindTrack Supabase Backend

This directory contains the Supabase database migrations for the Firebase-to-Supabase migration.

## Migration status

The Supabase project is intentionally empty of application data. These migrations create the schema and security controls before any Firebase data is imported.

## Firebase to PostgreSQL mapping

| Firebase | Supabase |
| --- | --- |
| `users/{userId}` | `public.profiles` + `auth.users` |
| `items/{itemId}` | `public.items` |
| `itemSecrets/{itemId}` | `private.item_secrets` |
| `claims/{claimId}` | `public.claims` |
| `matches/{matchId}` | `public.matches` |
| `chats/{chatId}` | `public.chats` |
| `chats/{chatId}/messages/{messageId}` | `public.chat_messages` |

Firebase UIDs are retained during migration in `profiles.legacy_firebase_uid`. Application relationships use Supabase Auth UUIDs after authentication migration.

## Security model

- Row Level Security is enabled on every application table.
- Unauthenticated clients have no table privileges.
- User profiles are owner-only.
- Items are readable by authenticated users and writable/deletable only by their owner.
- Claim reads are limited to the claimant or finder; claim creation requires the authenticated user to be the claimant and the target item to be an active found item owned by the finder.
- Match access is limited to users who own one side of the match.
- Chats are readable/updatable only by participants.
- Messages are readable only by chat participants and can only be inserted by the authenticated sender.
- Item verification answers live in the unexposed `private.item_secrets` schema and are not granted to `anon` or `authenticated`.
- Created/updated timestamps are server-managed by database triggers.
- Client update grants omit immutable ownership/identity columns where practical.

## Known migration differences

The current Firebase code and hardened Firestore rules have some historical schema differences. The Supabase schema normalizes these rather than copying client-controlled denormalized PII:

- Claim display fields such as item title, image URL, claimant name, and claimant email are obtained through relationships instead of being duplicated in every claim row.
- Claim-provided verification answers are not stored in the claims table.
- User email remains in Supabase Auth rather than being duplicated in the profile table.
- Firebase claim state `declined` is normalized to PostgreSQL `rejected` during migration.

## Next migration phase

Do not import Firebase data yet.

The next implementation phase is to migrate authentication, build the Supabase client layer, replace Firestore reads/writes with Supabase queries, move private verification logic to server-side/Edge Function code, and add automated RLS tests before cutover.
