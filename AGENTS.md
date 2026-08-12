# AGENTS.md — Campus Connect Agent Operating Rules

> This file defines mandatory operating rules for any coding agent working on Campus Connect.
> Read `PROJECT_SPEC.md` before making architectural or business-logic changes.
> If repository code conflicts with `PROJECT_SPEC.md`, do not silently "fix" the spec or the code. Report the conflict first.

## 0. Source of truth

Priority order:

1. Latest explicit user instruction in the current task
2. `PROJECT_SPEC.md`
3. This `AGENTS.md`
4. Existing repository implementation
5. Agent assumptions

Never invent product behavior when the specification is already explicit.

### Current execution authorization

The user has explicitly approved the P0 implementation plan dated 2026-08-13. For that plan:

- Use `codex/*` branches for isolated feature work.
- The approved P0 core tables are Place, Activity, Participation, Activity Invitation, Conversation, Conversation Member, Message, Persona, Persona Asset, Persona Entry, Persona Question Topic, Friendship, Block, Notification, and Report.
- Additive or reversible migrations implementing the approved schema may be applied after CI and adversarial review.
- Vercel Preview deployments and migrations to the Supabase development project `imkipffhtzfeuayyvzsj` may proceed without another confirmation.
- After tests and adversarial review pass, feature PRs may be squash-merged into `dev`; `dev` may be merged into `main` only at the approved release milestones.
- Stop for destructive migrations, irreversible data operations, production promotion, a new paid service, or an architecture/product-rule deviation.

For each PR, the acceptance gate is: local checks, CI, adversarial review, remote migration verification when relevant, and user-visible Preview verification. Do not merge with an unresolved P0/P1 finding.

---

## 1. Non-negotiable product rules

### MUST

- Treat `Activity` as the business/data entity.
- Treat `Beacon` only as the visual representation of one or more Activities on the campus map.
- User location/status is declared manually by selecting a `Place`.
- Do not use real GPS as part of the MVP.
- A Place is linked to the GLB scene by stable object/anchor names.
- Important Places should use `PLACE_*` scene nodes and `ANCHOR_*` beacon anchors.
- AI may interpret and organize natural-language intent, but deterministic rules must be executed by normal code/database logic.
- AI matching may only use user-authorized visible data such as visible Skill, eligible historical Activity information, and enabled Persona data.
- Private chat content must not be used for AI matching.
- Users must be able to disable being matched/contacted for specific Skill entries or globally where specified.
- Realtime chat and Activity updates should use Supabase Realtime rather than a custom WebSocket server.
- Images should be stored in Supabase Storage; database rows store paths/metadata rather than image binaries.
- Important database tables must use Supabase RLS or equivalent server-side authorization.
- Sensitive API keys must only exist server-side.
- Errors must be isolated by module. A failing AI request must not break Map, Chat, Profile, or unrelated features.
- Every independent feature must be implemented on a feature branch, tested, committed, and only then merged.
- Keep seed/demo data reproducible through scripts.

### MUST NOT

- Do not create an independent `Beacon` business table unless the user explicitly changes the architecture.
- Do not introduce GPS, background location tracking, or precise realtime location.
- Do not expose the DeepSeek API key or Supabase service-role key in browser/client code.
- Do not bypass or disable RLS merely to make development easier.
- Do not use a service-role key in browser code.
- Do not let AI read private chat messages for matching or recommendation.
- Do not silently change core database relationships.
- Do not delete existing database fields/tables or destructive migrations without explicit approval.
- Do not combine multiple unrelated feature implementations in one change.
- Do not perform broad refactors while implementing a narrow feature unless the refactor is required and explained.
- Do not merge directly into `main` or `dev` without testing.
- Do not overwrite the final campus GLB unless the user explicitly asks for model-asset changes.
- Do not invent missing Places or guess which GLB node represents a real campus location.
- Do not make Persona invent opinions, facts, preferences, or positions the user did not authorize.
- Do not make Persona proactively contact strangers.
- Do not treat frontend-hidden buttons as security boundaries.
- Do not require the entire app to wait for AI responses before rendering ordinary page content.

---

## 2. Mandatory workflow for every feature

Use this lifecycle:

1. Read this file and `PROJECT_SPEC.md`.
2. Inspect the relevant existing code before editing.
3. Restate internally the exact feature boundary and acceptance criteria.
4. Create or switch to a branch:
   - `codex/<short-feature-name>`
5. Implement the smallest coherent change.
6. Add/update tests where practical.
7. Run relevant checks:
   - typecheck
   - lint
   - unit/integration tests
   - build when the change affects build/runtime
8. Manually verify the user-visible path where applicable.
9. Fix failures before committing.
10. Commit with a clear message.
11. Merge to `dev` only after verification.
12. Merge `dev` to `main` only after an overall regression pass.

Preferred commit style:

- `feat(map): render activity beacons from place anchors`
- `feat(chat): add realtime text messages`
- `fix(auth): enforce profile ownership in RLS`
- `chore(seed): add deterministic campus demo users`

Do not bundle unrelated changes into one commit.

---

## 3. Branch policy

Expected branches:

- `main` — stable demo/release branch
- `dev` — integration branch
- `codex/*` — isolated feature and fix work

Rules:

- Never develop a large feature directly on `main`.
- Prefer feature branch -> tested commit(s) -> `dev`.
- Before merging to `main`, test the golden paths described in `PROJECT_SPEC.md`.
- If a feature branch reveals a spec conflict, stop architectural changes and report the conflict.

---

## 4. Change-control rules

The following require explicit user approval before implementation:

- changing core entity relationships
- adding/removing a core table
- destructive migration
- changing Activity/Beacon semantics
- introducing GPS
- allowing AI to access private chat data
- changing authentication model
- changing the primary backend away from Supabase
- changing the primary frontend away from Next.js
- replacing DeepSeek with another AI provider
- changing GLB/Place naming conventions
- changing `main/dev/feature` workflow
- adding a second production data store for an existing responsibility

Safe without special approval:

- bug fixes that preserve behavior
- UI polish
- accessibility improvements
- tests
- non-destructive indexes
- performance improvements that preserve semantics
- clearer error handling
- internal refactors local to one module when no external contract changes

---

## 5. Architecture boundaries

Target stack:

- Next.js
- TypeScript
- Supabase
  - Auth
  - PostgreSQL
  - Realtime
  - Storage
- DeepSeek API
- Three.js / React Three Fiber for campus GLB rendering
- Vercel deployment

Do not add a new framework/service merely because it is convenient.

Prefer managed Supabase capabilities over building:

- custom auth
- custom realtime socket servers
- custom object storage
- separate relational databases

---

## 6. Server/client boundary

### Client may

- render UI
- load the campus GLB
- subscribe to permitted Supabase Realtime channels
- upload permitted files using authorized Supabase flows
- call internal application API routes/server actions
- display public/authorized user data

### Server must handle

- DeepSeek API calls
- sensitive keys
- privileged database operations
- final business-rule validation
- rate limiting
- authorization checks not safely expressible on the client
- admin-only operations

Never trust client input for:

- membership capacity
- permissions
- admin role
- activity ownership
- match eligibility
- friendship state
- block state
- waitlist promotion
- AI-visible data scope

---

## 7. Database migration rules

- Prefer additive, reversible migrations.
- Do not edit old migration history after it has been applied.
- New constraints must consider existing seed/demo rows.
- Use foreign keys where relationships are structural.
- Use unique constraints for duplicate-prevention cases.
- Keep timestamps where lifecycle/history matters.
- Preserve `left`, `waitlisted`, `pending`, `approved`, etc. as state rather than deleting history when the product requires history.
- For concurrent joins/capacity, enforce correctness in database/server logic, not only UI.

Before destructive changes:

1. explain impact
2. propose migration
3. provide rollback path
4. obtain explicit approval

---

## 8. RLS and security rules

RLS is part of the product, not optional cleanup.

Minimum expectations:

- user profile: user edits own profile
- Persona: owner controls write/visibility
- Skill: owner controls write/contactability/visibility
- Message: only conversation members can read/send
- Conversation: only members can access
- Activity: public/eligible users may read according to visibility; creator/admin manages
- Participation: membership transitions follow server/database rules
- Friendship: only involved users can act on request/relationship
- Report: users may create; admin handles
- Block: owner controls own block list; block affects recommendation/chat/visibility queries as specified
- Admin actions: verified server-side role check

Never solve an RLS issue by setting a private bucket/table fully public.

---

## 9. AI rules

AI is responsible for:

- natural-language intent parsing
- requirement/goal decomposition
- Skill semantic interpretation
- recommendation explanation
- Persona response organization
- later: chat summarization/task extraction where explicitly enabled

AI is not responsible for:

- authorization
- database permissions
- hard filtering
- activity capacity
- friendship/block enforcement
- membership state
- task status truth
- database writes without normal validation
- inventing Persona facts

For matching:

1. parse user intent into structured fields
2. run deterministic database filters/ranking inputs
3. include time-conflicting candidates only if the product rule says so, rank them later, and visibly mark the conflict
4. exclude users/Skills that disabled matching/contact
5. generate explanation from permitted data
6. never feed private chat history to the model

AI failure must degrade gracefully.

Example:

- show "AI matching is temporarily unavailable"
- keep ordinary search/map/chat/profile usable

---

## 10. Campus map rules

The final campus model is a static GLB asset.

Expected convention:

- visual/place node: `PLACE_<id>` or project-approved equivalent
- beacon anchor: `ANCHOR_<id>`

Example:

- `PLACE_library`
- `ANCHOR_library`

The app should resolve Place -> GLB node/anchor through stable configuration/data.

Do not store GPS coordinates just to position map UI.

Beacon rendering:

- derive Activity data by `place_id`
- find the matching `ANCHOR_*`
- render UI dynamically in the frontend
- multiple Activities at one Place may aggregate visually
- do not bake Activity Beacon UI into Blender/GLB

If more than the configured display limit exists at a Place, aggregate as `+N` rather than rendering unlimited overlapping markers.

---

## 11. Chat rules

MVP:

- realtime text
- realtime image messages
- history persistence
- direct/friend conversations
- temporary/activity conversations
- archived activity conversations remain readable

Use:

- PostgreSQL persistence
- Supabase Realtime for live updates
- Supabase Storage for images

Do not require:

- typing indicators
- read receipts
- voice/video
- complex branches/tasks in P0 unless specifically requested

Conversation access must be enforced by membership/RLS.

---

## 12. Persona rules

- max 3 Persona per user in MVP
- Persona only uses owner-authorized information
- support current approved content sources defined in `PROJECT_SPEC.md`
- latest authorized information wins
- if information is absent, explicitly say the owner did not provide it
- Persona cannot create new opinions or pretend to be live user speech
- owner cannot view strangers' private Persona conversations message-by-message
- owner may access only approved anonymous summary/question views
- Persona cannot proactively contact strangers

---

## 13. Error isolation

Every major module should have independent loading/error/empty states:

- Home
- Map
- Activity
- Connect/AI matching
- Messages
- Profile
- Persona
- Admin

Examples:

- DeepSeek fails -> matching card fails, rest of app remains usable
- image upload fails -> message composer remains usable
- GLB fails -> show map fallback/error, navigation still works
- Realtime disconnects -> history remains available; show reconnect state
- one API request fails -> no global blank screen

Use error boundaries where appropriate.

---

## 14. Seed data

Seed scripts are first-class development assets.

Requirements:

- deterministic/reproducible where practical
- safe to rerun or clearly reset first
- create enough demo users to show a non-empty Skill Network
- include representative Skills, Persona, Activities, friendships, conversations/messages, and other required demo relations
- cover both golden paths from `PROJECT_SPEC.md`

Do not hand-create dozens of demo users through the UI when a seed script is appropriate.

---

## 15. Definition of done

A feature is not done because "the page renders."

Definition of done:

- requested behavior implemented
- relevant permissions enforced
- failure state handled
- no unrelated feature broken
- lint/typecheck pass
- relevant tests pass
- build passes when needed
- user-visible flow manually checked when applicable
- documentation/spec updated if a public contract changed
- commit created

---

## 16. Agent communication style

When reporting completion:

- state what changed
- state what was tested
- state any known limitation
- state whether database migration or environment variable changes are required
- do not claim success for untested behavior
- do not hide architecture changes inside "minor cleanup"

When blocked by ambiguity:

- prefer existing spec
- if the choice would change architecture/data/security, ask or report before modifying
- if the choice is local UI detail, choose the simplest reversible option
