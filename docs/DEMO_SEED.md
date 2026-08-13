# Demo seed data

`supabase/seed.sql` populates a reproducible, non-production Campus Connect demo after all migrations run.

## Included data

- 36 virtual students with distinct profiles and `is_seed_user = true`
- 24 shared abilities and interests, with three Skill relationships per student
- 18 public, matching-enabled Personas and 36 confirmed Persona entries
- 10 campus activities organized by groups such as the maker club, photography association, volunteer association, astronomy club, debate team, sports clubs, student union, and drama club
- joined, pending, waitlisted, and historical participation states
- one activity conversation per seeded activity, representative chat history, and pending invitations

Campus Connect does not currently define an independent organization entity. Clubs are therefore represented as the organizer named in an Activity description, while the Activity creator remains a student profile. This preserves the approved Activity data model without inventing a new core table.

## Demo sign-in

Every seeded student can sign in locally with:

- Email: `seed.student01@campus-connect.local` through `seed.student36@campus-connect.local`
- Password: `CampusDemo2026!`

These credentials are intentionally shared demo credentials. Never load this seed into a production project.

## Reset and verify

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm exec supabase test db --local supabase/tests
node scripts/test-demo-seed-auth.mjs
```

The CLI runs `supabase/seed.sql` after migrations because `db.seed.enabled` is true and `db.seed.sql_paths` contains `./seed.sql`.
