# PROJECT_SPEC.md — Campus Connect

## 1. Project identity

**Project name:** Campus Connect (working title)

**Product type:** PC-first Web application, later responsive mobile adaptation.

**Core idea:**  
Campus Connect is a campus social and collaboration platform in which AI helps students express what they want to do, understand who may be suitable to do it with, and then transition into real human interaction through campus Places, Activities, chat, Skill discovery, and Persona.

**Primary product hypothesis:**  
AI can improve campus social connection by understanding real user intent and connecting people around a shared action rather than merely recommending profiles.

**Core principle:**  
AI is not a replacement for human relationships. AI is a connection layer that helps users discover, understand, and eventually act with real people.

---

## 2. MVP goal

The MVP must make all major modules exist, while implementation depth is concentrated on the two primary golden paths.

### Golden path A — campus activity

Home/Map  
-> discover a Place/Activity  
-> join or request to join  
-> enter temporary chat  
-> view Profile/Skill/Persona  
-> complete a real/shared Activity  
-> preserve relationship/history

### Golden path B — AI matching

Home/Connect  
-> user writes "what I want to do"  
-> DeepSeek parses structured intent  
-> normal database logic finds/ranks eligible users/Skills  
-> UI explains why each candidate is recommended  
-> user views candidate directly or opens Profile/Persona first  
-> invite / create Team or Activity  
-> chat / collaborate

---

## 3. First-release constraints

- one campus only
- Web first
- PC first
- responsive mobile later
- no native mobile app in MVP
- no real GPS
- no background location
- no school official-system integration
- no full payment system
- no global account-avatar builder in MVP; a Persona may optionally display one owner-uploaded GLB 2.0 visualization
- demo may contain many seeded virtual users
- real classmates may still register
- first version is both the competition/demo version and the initial public deployment version
- architecture should remain upgradeable without over-engineering the demo

---

## 4. Core navigation

Primary application areas:

1. Home
2. Campus Map
3. Connect / AI co-creation
4. Messages
5. Profile / Persona
6. Admin (admin only)

### Home

Home is the first screen after login.

Primary hero interaction:

**"今天想一起做什么？"**

The Home page should make AI intent expression the first-class entry while still surfacing currently active campus content.

Suggested content:

- AI intent input
- current/popular Activities
- shortcuts to Campus Map
- relevant public activities
- selected connection recommendations where appropriate
- Messages/Profile navigation

The map is a major spatial interface, but not the only or mandatory first entry.

---

## 5. Technology baseline

### Frontend

- Next.js
- TypeScript
- Tailwind CSS preferred
- shadcn/ui allowed/preferred for standard UI components
- Three.js / React Three Fiber for the campus GLB

### Backend/data

Supabase:

- Auth
- PostgreSQL
- Realtime
- Storage

### AI

- DeepSeek API
- invoked server-side only

### Deployment

- Vercel
- default Vercel domain acceptable for MVP
- custom domain later

---

## 6. Authentication

MVP registration/login:

- email
- password
- public nickname

Use Supabase Auth.

Do not build a custom password/authentication system.

School identity verification is not required in the MVP.

Future versions may add stronger campus verification.

---

## 7. Core data model

The names below are conceptual. Exact table naming may use `snake_case`.

### User / Profile

Represents a registered user and public profile.

Key responsibilities:

- nickname
- avatar
- basic campus information
- visibility/preferences
- matching/privacy switches
- admin role if applicable

### Skill

Unified capability/interest model.

Examples:

- Python
- Figma
- football
- photography
- Marvel

Recommended field:

- `kind`: e.g. `ability`, `interest`

The system may use the same Skill network for both:

- "find someone who knows Python"
- "find someone who likes football"

A user Skill may contain:

- self rating
- external/user ratings
- visibility
- allow_contact / allow_matching

Do not force Skill into separate unrelated systems for interests and abilities.

### Persona

Each user may create up to 3 Persona in MVP.

Persona represents one interest/capability side of the user, not a full digital clone.

Example:

- Football Me
- Movie Me
- Design Me

Persona contains authorized information such as:

- topic
- facts
- preferences
- opinions
- experiences
- boundaries
- visibility
- current text/image-backed entries where supported

Persona must not invent missing information.

### Place

Logical campus location.

Examples:

- library
- football field
- basketball court
- canteen
- teaching building
- square

A Place does not require GPS.

A Place may include:

- `id`
- display name
- category
- description
- GLB object name
- GLB anchor name
- visibility/search metadata

Example conceptual mapping:

```ts
{
  id: "football",
  name: "足球场",
  category: "sport",
  objectName: "PLACE_football",
  anchorName: "ANCHOR_football"
}
```

### Activity

Activity is the real business entity behind a map Beacon.

An Activity:

- belongs to a creator
- belongs to one Place
- has title/description/type
- may have start/end times
- may have capacity
- has join mode
- has lifecycle status
- has participants
- may be represented visually as a Beacon

**Beacon is not a separate business entity.**

### Participation

Represents a User's relationship to an Activity.

Suggested statuses:

- `pending`
- `approved`
- `joined`
- `waitlisted`
- `left`
- `removed`
- `rejected`

Exact statuses may be simplified if implementation can preserve all required behavior.

Important:

- leaving should preserve history using `left`
- do not delete participation merely because the user leaves

### Team

Independent collaboration group.

May link to:

- members
- tasks
- conversation
- project/activity context

### Task

Independent task entity.

Not all chat features require AI.

Tasks may be created from future chat workflows or project collaboration.

### Conversation / ChatRoom

One realtime chat container.

May represent:

- friend/direct chat
- temporary chat
- Activity chat
- Team chat

Temporary chat does not require a separate "temporary relationship" entity.

Whether two users are friends can be derived from Friendship.

### Message

Belongs to one Conversation and sender.

MVP types:

- text
- image

Later:

- internal platform card
- other media

### Friendship

Mutual/double-confirmation relationship.

Friend request includes a verification/introduction message.

### Block

User-controlled blocking relation.

Block should affect:

- direct contact
- relevant matching
- relevant visibility/query paths

### Report

User report against appropriate entities/users/content.

Admin reviews reports.

### Notification

MVP uses in-app notification only.

No email/SMS/push is required in P0 unless later requested.

### Review

Place review.

MVP may include:

- 1–5 star rating
- text
- author
- timestamp

---

## 8. Activity and Beacon rules

### Fundamental rule

`Activity` = persistent business/data entity  
`Beacon` = visual map representation

Do not create a Beacon table for normal Activity behavior.

### Activity join mode

Creator chooses when creating Activity:

- `free`
- `approval`

This setting is independent from whether capacity exists.

Examples:

- free + no capacity -> immediate join
- free + capacity -> immediate join while slots remain
- approval + no capacity -> request requires approval
- approval + capacity -> request requires approval; approved users consume capacity

### Full capacity

When an Activity is full:

- additional eligible users enter waitlist
- do not silently reject simply because full

Waitlist promotion behavior may be implemented deterministically when a slot opens.

### Leaving

When a user leaves:

- preserve Participation
- set state to `left`
- update Activity counts
- do not automatically remove the user from historical records

### Chat

After successful join/approval:

- user gains access to the Activity's temporary group Conversation

When Activity is manually ended:

- Activity becomes ended/archived state
- related temporary Conversation becomes archived
- historical messages remain viewable
- users do not automatically become friends

### Place display

One Place may have multiple Activities.

Map may aggregate them at one Place.

If too many Activities exist:

- do not render unlimited overlapping Beacon UI
- show a limited number or an aggregate such as `+N`

Target display rule from product decision:

- up to 30 independent Beacon items per Place before aggregation
- implementation may use earlier aggregation for usability if it does not hide access to the remaining Activities

---

## 9. Campus map

### Asset pipeline

`map3D` is only a development-time GLB generator/tool.

It is not a runtime dependency of the main application.

Pipeline:

OpenStreetMap / map3D  
-> campus GLB generation  
-> Blender correction  
-> Place/Anchor organization  
-> final campus GLB  
-> load in Campus Connect

### Final GLB

The final GLB is a static application asset.

Suggested path:

`/public/models/campus.glb`

### Scene conventions

For interactive Places:

- `PLACE_<id>`
- `ANCHOR_<id>`

Examples:

- `PLACE_library`
- `ANCHOR_library`
- `PLACE_football`
- `ANCHOR_football`

The Anchor is a static GLB node used as the 3D attachment/position reference for dynamic web UI.

Do not bake live Beacon UI into Blender.

### No GPS

MVP users choose a Place manually.

Examples:

- "我在足球场"
- "我在图书馆"

No latitude/longitude is required for user presence logic.

Map user/activity counts only include users who actively expose state or participate in relevant Activities.

### Search

Campus Map should support Place search in MVP.

---

## 10. AI matching

### Input

User writes natural language.

Example:

"今晚想找两个人随便踢足球。"

### Step 1 — AI parses intent

Example structured result:

- activity: football
- time: tonight
- desired_people: 2
- style: casual
- place: optional
- skill/interest needs
- social preference
- other constraints

### Step 2 — deterministic database logic

Normal code queries:

- visible Skills
- visible/enabled Persona-derived attributes where allowed
- eligible historical Activity data
- matching/contact switches
- block state
- Activity/availability fields
- other authorized structured data

Do not query private chat content.

### Time conflict

Time conflict does not fully remove a candidate.

Instead:

- rank conflicting users later
- visibly mark that the time does not fit

### Exclusion

A user/Skill that disables matching/contact for that purpose must be excluded.

### Explanation

AI recommendation must explain why the person was recommended.

Explanation must only use permitted data.

### "Not interested"

User may mark a recommendation as not interested.

MVP does not require the system to learn from this signal.

---

## 11. Messages

### MVP scope

Must support:

- realtime text
- realtime images
- history
- friend/direct chat
- temporary/activity chat
- archived history

### Architecture

- message persisted to PostgreSQL
- realtime updates via Supabase Realtime
- image files via Supabase Storage
- database stores storage path/metadata

Do not build a custom WebSocket server.

### Desktop layout

Preferred desktop Messages layout:

- left: conversation list
- right: active conversation

Mobile later becomes single-screen navigation.

### Not required for P0

Unless specifically requested:

- typing indicator
- read receipt
- voice
- video
- complex branch UI
- full task management inside chat

The long-term product may still include:

- conversation branches
- task creation
- team creation
- activity creation
- AI summary
- internal object references

These are not all AI features.

---

## 12. Persona

### Purpose

Persona reduces the cost of learning about a stranger before initiating real contact.

It is not intended to replace the real user.

### Creation

MVP supports structured guided entry.

Current desired inputs:

- text
- images

Optional visualization:

- one owner-uploaded GLB 2.0 model per Persona
- the GLB is presentation only and must not become Persona knowledge or AI evidence
- model visibility follows the Persona's existing public/enabled controls
- public deployments must not expose local roadshow-only built-in models

Do not assume arbitrary PDF/file training or fine-tuning.

If the chosen DeepSeek model/interface does not support image understanding in the implementation environment, store image assets and accompanying user-provided text/metadata rather than inventing visual interpretation.

### Knowledge behavior

- latest authorized information wins
- old/replaced opinions should not be used as current truth
- if no authorized answer exists, Persona must say the user did not provide it
- no invented views

### Privacy

- owner cannot view strangers' Persona conversations line-by-line
- owner may actively open an anonymous summary/question view
- MVP does not require automatic realtime delivery of Persona question summaries
- Persona cannot proactively contact strangers

### Visibility

User controls which Persona are displayed/enabled.

---

## 13. Friendship and temporary connection

Friendship:

- mutual confirmation
- friend request includes a short verification/introduction message

Temporary contact:

- does not require a separate relationship data type
- Conversation may exist while users are not friends
- UI may show:
  "该用户还未成为你的好友，请注意隐私保护"

Users may:

- remain temporary contacts
- send friend request
- leave/ignore conversation according to product permissions

---

## 14. Shared experience visibility

A shared experience may only be publicly displayed when required participants approve according to the product rule.

Current rule:

- both relevant parties approve -> may display
- if one rejects -> do not publicly display that shared experience

Do not solve refusal by publicly showing an "anonymous counterpart" version.

Private/internal history may still be retained where needed for legitimate product history.

---

## 15. Notifications

MVP:

- in-app notifications

Possible notification events:

- message
- friend request
- Activity join request
- Activity approval/rejection
- waitlist promotion
- invitation
- admin/report status where appropriate

Push/email/SMS are later features.

Persona anonymous summary/questions are user-opened in MVP rather than automatic push.

---

## 16. Admin

MVP uses a simple role model:

- normal user
- admin

One admin is sufficient for the initial version.

Minimum admin functions:

- view reports
- view relevant users
- view Activities
- delete/disable inappropriate Activity/content
- restrict/ban account

Do not create a complex multi-role moderation system unless requested.

---

## 17. Safety/privacy baseline

MVP should include:

- block
- report
- disable stranger private chat
- admin moderation
- Activity organizer member removal
- RLS-based data access
- account deletion flow/strategy
- module-isolated failures

A full automated prohibited-word/content-moderation system is not a P0 requirement unless requested.

Account deletion should remove the user's personal data according to policy while preserving multi-user relational integrity where required.

---

## 18. Home/Map/Profile loading behavior

Ordinary UI must render independently from AI.

Example:

Profile can immediately show:

- nickname
- avatar
- basic info
- Skills
- Persona cards

Persona AI response may show its own loading state.

Do not block the entire Profile page while waiting for DeepSeek.

Same rule applies to Home/Connect.

---

## 19. Realtime

Use Supabase Realtime for:

- messages
- Activity membership/status changes
- Activity/map state changes
- other small realtime UI state when needed

Do not poll every few seconds when realtime subscription is already appropriate.

If Realtime disconnects:

- preserve persisted data
- show reconnect/fallback state
- do not crash the page

---

## 20. Storage

Use Supabase Storage.

Likely buckets:

- avatars
- chat-images
- persona-assets
- persona-models
- review-images if enabled

Private media must not be made globally public for convenience.

Database stores:

- path
- owner/uploader
- object relation
- metadata
- timestamp

---

## 21. RLS expectations

At minimum:

### Profile

- public/authorized read according to visibility
- owner write

### Skill

- authorized read according to visibility
- owner write
- matching queries respect matching/contact switches

### Persona

- read only if enabled/visible as allowed
- owner write
- private source data protected

### Activity

- read according to visibility
- creator/admin manage
- join behavior validated server/database side

### Participation

- user can act on own participation
- creator/admin approval actions only where permitted
- capacity/waitlist rules enforced server/database side

### Conversation/Message

- only members can read
- only members can send
- archived state behavior enforced

### Friendship

- only involved users can act

### Block

- user owns own block list

### Report

- users may create
- admin handles

### Admin

- server-side role verification required

---

## 22. Seed/demo data

The app must not appear empty during demonstration.

Use a repeatable seed script.

Target content:

- dozens of virtual students
- rich Skill Network
- multiple Persona
- multiple Activities
- friendships
- chat history
- representative reviews/content
- enough data to demonstrate AI matching

Do not manually register all demo users through the UI.

Seed should exercise both golden paths.

Seed users should be clearly distinguishable in data where useful, e.g. `is_seed_user`.

---

## 23. Performance priorities

Priority:

1. ordinary navigation feels immediate
2. campus GLB loads reliably
3. realtime chat is stable
4. Activity/map updates are stable
5. AI may take longer but must show isolated loading state

Avoid:

- huge textures
- unnecessary 4K assets
- excessive high-poly decorative geometry
- repeated full-map network regeneration
- loading all heavy modules before first useful render

---

## 24. P0 / P1 / P2

### P0 — must work for first release/demo

- Supabase Auth: email/password/nickname
- basic Home
- Profile
- Skill
- campus GLB loading
- Place clicking/search
- Activity creation
- join mode: free/approval
- capacity
- waitlist
- leave with history
- Activity -> temporary chat
- Activity -> dynamic Beacon
- realtime text chat
- realtime image chat
- history
- Connect AI intent parsing
- deterministic Skill/user matching
- recommendation explanation
- Profile/Persona route from recommendation
- invitation route from recommendation
- up to 3 Persona
- Persona authorized-answer behavior
- in-app notifications
- basic block/report/admin
- seed/demo data
- module-level error handling
- essential RLS

### P1

- chat internal cards
- conversation branches
- light task workflow
- chat summary
- richer reviews/images
- richer admin tools
- full responsive mobile polish
- more limits/recovery/rate controls
- more advanced notification preferences

### P2

- presence / typing indicators
- push notifications
- PWA
- advanced review ranking/likes/replies
- complex Persona file/RAG pipeline
- multiple campuses
- advanced content moderation
- long-term production scaling

---

## 25. Repository layout expectations

Conceptual structure:

```text
campus-social-app/
├─ app/ or src/app/
│  ├─ home
│  ├─ map
│  ├─ connect
│  ├─ messages
│  ├─ profile
│  └─ admin
├─ components/
├─ lib/
│  ├─ supabase/
│  ├─ ai/
│  ├─ permissions/
│  └─ validation/
├─ public/
│  └─ models/
│     └─ campus.glb
├─ data/
│  └─ campus-places.*
├─ supabase/
│  ├─ migrations/
│  └─ seed.*
├─ AGENTS.md
└─ PROJECT_SPEC.md
```

Exact folder structure may follow existing Next.js conventions.

Do not restructure the whole repository merely to match this diagram.

---

## 26. Environment variables

Keep secrets server-side.

Typical categories:

- Supabase public URL
- Supabase public anon key
- Supabase server/service key where strictly necessary and server-only
- DeepSeek API key

Rules:

- do not commit `.env.local`
- provide `.env.example` with placeholder names only
- never expose server/service secrets using `NEXT_PUBLIC_*`
- DeepSeek key must never be `NEXT_PUBLIC_*`

---

## 27. Development workflow

Primary branch model:

- `main`
- `dev`
- `feature/*`
- `fix/*`

Feature lifecycle:

feature branch  
-> implement  
-> test  
-> commit  
-> merge to `dev`  
-> regression  
-> merge to `main`

Each independent feature should have clear acceptance criteria.

Do not use "big bang" commits covering the whole product.

---

## 28. Minimum acceptance tests

### Auth

- register
- login
- logout
- unauthorized route handling

### Map

- GLB loads
- Place can be resolved
- Place click works
- Anchor can be resolved
- Activity appears at correct Place
- multiple Activities aggregate

### Activity

- create free Activity
- create approval Activity
- join free Activity
- request approval
- approve/reject
- capacity enforced
- full -> waitlist
- leave -> status `left`
- Activity ending archives conversation

### Chat

- only members can open Conversation
- text realtime
- image upload/send
- history reload
- archived history readable
- unauthorized user denied

### Matching

- input -> structured intent
- authorized data only
- disabled matching candidate excluded
- blocked candidate excluded
- time-conflict candidate ranked later and labeled
- explanation generated
- private chat data not used

### Persona

- max 3
- owner edits own data
- visibility honored
- missing info -> refusal/no invention
- owner cannot inspect stranger chat line-by-line

### Admin/security

- report creation
- admin can view/act
- normal user cannot access admin operations
- key secrets absent from client bundle

---

## 29. Golden-path regression checklist

Before merging `dev` -> `main`, verify:

### Path A

login  
-> Home  
-> Map  
-> open Place  
-> view Activity  
-> join/request  
-> enter temporary chat  
-> send message  
-> open another user's Profile/Persona

### Path B

login  
-> Home/Connect  
-> enter natural-language need  
-> receive parsed intent  
-> see recommended users  
-> understand "why recommended"  
-> open Profile/Persona OR invite directly  
-> create/join collaboration context  
-> enter chat

If either path is broken, `main` is not release-ready.

---

## 30. Product decisions that are intentionally NOT implemented yet

Do not add unless requested:

- real GPS
- background tracking
- native app
- school SSO
- global account-avatar builder (Persona-scoped GLB visualization remains allowed)
- AI reading private chats
- AI-to-AI socializing in place of users
- custom WebSocket infrastructure
- arbitrary Persona fine-tuning
- full multi-campus architecture
- complex moderator role hierarchy
- full production-grade automated content moderation
- voice/video chat

---

## 31. Conflict-handling rule for agents

If a future task conflicts with this specification:

- if the user explicitly gives a newer instruction, follow the user
- update the relevant spec after implementing the approved change
- do not silently keep contradictory rules in the repository

If code conflicts with this document:

- inspect whether code is stale or the spec is stale
- report the mismatch
- avoid destructive architectural changes until resolved
