# Firebase Auth -> Supabase Auth migration

Do not run the migration automatically.

Supabase provides an official migration utility that can export Firebase Authentication users to JSON and import them into Supabase Auth. Firebase password users can be migrated with their Firebase SCRYPT password hash parameters.

For FindTrack, the current Firebase project contains accounts that have not yet been classified as legitimate versus suspicious. Therefore the migration input must be reviewed and filtered before importing users.

Required source material:
1. Firebase service-account credentials kept outside Git.
2. Firebase Authentication export JSON kept outside Git.
3. Firebase password-hash parameters kept outside Git for password users.
4. A reviewed allowlist of accounts that should migrate.

Never commit Firebase private keys, Supabase database passwords, Supabase secret/service-role keys, exported auth JSON, or password-hash configuration to this repository.

Migration order:
1. Export Firebase Auth users.
2. Review and filter the user export.
3. Import the approved users into Supabase Auth.
4. Preserve each Firebase UID in public.profiles.legacy_firebase_uid.
5. Verify the imported users and email-confirmation state.
6. Only then switch the application auth provider from Firebase to Supabase.

Official guide:
https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth
