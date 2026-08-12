# Supabase migration workflow

The first three migrations in this directory were applied to the hosted development project through the Dashboard SQL editor before remote migration history was adopted. They are intentionally idempotent and must not be edited.

For every new migration:

1. Create it with `supabase migration new <name>`.
2. Verify the complete migration chain in the GitHub Actions local Supabase job.
3. Run an adversarial RLS and privilege review.
4. Apply the reviewed SQL to the hosted development project through the connected Supabase integration.
5. Run the security and performance advisors and verify the changed behavior.

Never run `supabase db reset --linked` against the hosted project. Production schema promotion requires a separate explicit release decision.
