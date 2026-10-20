# Campus Connect functional audit — 2026-10-21

## Release status

The site is not fully operational. Supabase project `imkipffhtzfeuayyvzsj`
(`campus-connect`) reports `INACTIVE`. Restoring it was rejected because the
account has reached the limit of two active free projects. No other project
was paused, deleted, upgraded, or changed.

The connected integration exposes one organization and two projects, only one
of which is active. The restore error therefore cannot be fully reconciled
with the visible project inventory. Another active project must not be named
or assumed without further account-level evidence.

## Fixes implemented locally

Four failures were reproduced against the actual MessagesWorkspace component
in an Edge browser, using an isolated Supabase/Next router fixture:

1. A successfully sent image was invisible to its sender when Realtime did
   not deliver the insert event. Image sends now fetch and display the
   persisted message, just like text sends.
2. A rejected network operation left sending locked and produced an unhandled
   rejection. Text/image sending now handles errors and releases the busy
   state in `finally`.
3. Switching conversations retained the previous room's draft. Switching now
   clears it, and an older send completion cannot clear a new room's draft.
4. Loading history replaced messages that arrived while the request was in
   flight. History now merges with current messages by ID, filters the room,
   and sorts deterministically.

All four browser scenarios failed before the fixes and passed afterward.
The browser fixture tests component behavior; it does not verify hosted RLS,
Storage, Realtime, or multi-user behavior.

## Verification

- `pnpm verify`: passed typecheck, lint, 58 unit tests in 16 files, and build.
- Four new unit tests cover concurrent history/event merging, duplicate
  delivery, room isolation, and ordering.
- Local production build and deployed site: login and registration pages
  render; unauthenticated requests to Home, Map, Connect, Messages,
  Notifications, Profile, Admin, and activity creation reach login.
- Local and deployed empty login forms show field validation errors.
- Local and deployed demo sign-in show a failure notice while the backend is
  unavailable; successful authentication was not verified.
- Local unauthenticated Connect and Persona question requests return HTTP 401.
- Local login inspected at desktop and mobile widths; no mobile horizontal
  overflow or uncaught page errors.
- Deployed API follow-up checks were interrupted by this machine's network
  timeout. Deployed API status and mobile screenshots were not verified.

Local evidence is in the ignored `test-results/functionality-audit` directory.
The isolated browser reproduction is in
`test-results/message-harness/run.mjs`; it regenerates temporary fixture files
when run and uses the Vite runtime already installed with Vitest.

## Remaining checks

After the Supabase project is restored, verify both golden paths against a
running isolated backend: activity creation, approval, capacity/waitlist,
text/image messages, history/archive, AI matching/invitation, friendship,
Profile/Skill privacy, and Persona upload/confirmation/question workflows.
These flows have not received a complete live acceptance pass in this audit.

No database migrations or environment variable changes are required for the
local chat fixes. They have not been deployed to production.

## Supabase usage snapshot

The visible organization is on the Free plan. `yanhuo-youpu`
(`lbvrzckkyzjbgwnconse`) is active and its database occupies 39,103,635 bytes
(about 37 MiB). Its Storage object count and total file size are both zero.
The largest relations, including indexes and TOAST, are `kb_chunks`
(20,889,600 bytes) and `kb_documents` (6,258,688 bytes).

Campus Connect's database/storage usage cannot be queried while paused.
Current billing-period egress, MAU, Edge Function, and Realtime usage are not
available through the connected tools. No overall project usage ranking can
be concluded from this partial snapshot.
