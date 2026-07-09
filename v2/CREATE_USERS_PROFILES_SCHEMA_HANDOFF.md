# Create Users And Profiles Schema Thread Handoff

## Purpose

This file is for the thread picking up the "create users and profiles schema"
work after a long V2 build session. The users/profiles foundation is already
implemented through Supabase Auth plus the public `profiles` table. Treat this
as a completed foundation unless the new thread is explicitly asked to revise
the schema.

This handoff also records the surrounding state from the later teacher
dashboard, classroom, and course-editor work so the next thread can pick up
without rediscovering the last several hours.

## Current Repository State

- Branch: `v2`
- Current HEAD observed locally: `8e2e99b` - Add collapsible modules in course editor
- Existing broader handoff: `v2/CODEX_HANDOFF.md`
- Permission model reference: `v2/ROLE_PERMISSIONS.md`
- Local uncommitted changes already exist in:
  - `v2/pages/auth/login.html`
  - `v2/pages/courses/editor.html`

Do not overwrite or revert those page changes unless the user explicitly asks.

Important: `v2/CODEX_HANDOFF.md` is stale. It still lists `501b973` as current
and says migration history is synchronized only through `20260525000700`. The
actual local branch has additional commits and migrations after that point.

## Immediate Pickup State

The tracked branch is cleanly pushed to `origin/v2` at `8e2e99b`, but there are
two local modifications:

- `v2/pages/auth/login.html`: formatting-only change around the auth toggle and
  missing final newline. This has been called out before as intentionally
  unstaged. Avoid mixing it into schema or feature commits.
- `v2/pages/courses/editor.html`: in-progress course-builder copy/layout change.
  It removes the inline content-block and question forms from the HTML and
  changes copy toward a future focused lesson builder.

That second local change is not complete by itself. The tracked
`v2/scripts/courses/editor.js` still expects these DOM nodes:

- `[data-content-block-form]`
- `[data-content-block-form-heading]`
- `[data-cancel-content-block-form]`
- `[data-question-form]`
- `[data-question-form-heading]`
- `[data-cancel-question-form]`

If the HTML change remains as-is, the course editor can throw when the module
script attaches listeners or toggles those forms. The next thread should either:

- restore the inline content/question forms, or
- finish the lesson-builder split by updating `editor.js` and adding the
  lesson-builder page/scripts that replace those forms.

There are currently empty directories for future lesson work:

- `v2/pages/lessons/`
- `v2/scripts/lessons/`

No focused lesson builder file exists yet.

## Recent Work Trail

Recent commits after the original database foundation:

- `a264ff8` - Define V2 roles and permissions model
- `d02b9f1` - Build teacher dashboard course entry point
- `28769d3` - Add teacher course and classroom entry pages
- `8770dbb` - Add classroom creation entry flow
- `161ef47` - Add module creation to course management
- `c8bb2f6` - Add lesson creation to course management
- `72d5287` - Add draft lesson text content
- `fe37d36` - Add classroom ordering and archive controls
- `ea59930` - Add module reordering in course editor
- `b92942d` - Add lesson reordering in course editor
- `8e2e99b` - Add collapsible modules in course editor

The main product path now exists for a teacher to:

- sign up or log in
- complete profile onboarding
- land on the teacher dashboard
- create a draft course
- open course management
- edit course basics
- add modules
- add lessons
- add draft lesson text content and short-response questions in the current
  tracked course editor
- reorder modules and lessons with drag/drop
- collapse/expand module cards
- soft-delete modules and lessons through `archived_at`
- open classroom management for a course
- create, edit, archive, and reorder classrooms

## Current Feature Surface

Teacher dashboard:

- Page: `v2/pages/dashboard/index.html`
- Script: `v2/scripts/dashboard/teacher-dashboard.js`
- Shows courses owned by the profile or available through course collaborators.
- Shows classrooms owned by the profile or available through classroom teacher
  assignments.
- Creates draft courses with `owner_user_id = currentProfile.id`.
- Routes incomplete profiles back to onboarding.

Course management:

- Page: `v2/pages/courses/editor.html`
- Script: `v2/scripts/courses/editor.js`
- Uses `can_manage_course` RPC before showing editor content.
- Supports updating course basics.
- Supports module create/edit/reorder/collapse/soft-delete.
- Supports lesson create/reorder/soft-delete.
- Tracked script supports inline draft text content and draft question creation,
  but the current uncommitted HTML change removes those forms.

Classroom management:

- Page: `v2/pages/classrooms/manage.html`
- Script: `v2/scripts/classrooms/manage.js`
- Uses `can_manage_course` before showing classroom management.
- Shows active classrooms for the course.
- Supports create/edit, drag/drop display order, and archive-style delete by
  updating `status`.

## Main Schema File

The relevant migration is:

- `supabase/migrations/20260524000100_create_profiles.sql`

It creates `public.profiles` and wires it to `auth.users`.

## Implemented Schema

`public.profiles` currently includes:

- `id uuid primary key default gen_random_uuid()`
- `auth_user_id uuid not null unique references auth.users(id) on delete restrict`
- Identity/onboarding fields:
  - `legal_first_name`
  - `legal_last_name`
  - `email`
  - `username`
  - `date_of_birth`
  - `profile_photo_url`
  - `avatar_type`
  - `avatar_key`
  - `profile_completed`
- Platform/account fields:
  - `platform_role text not null default 'user'`
  - `account_status text not null default 'active'`
  - `auth_provider`
  - `last_login_at`
  - `created_at`
  - `updated_at`

Important constraints:

- `platform_role` is limited to `admin` or `user`.
- `account_status` is limited to `active`, `suspended`, or `deleted`.
- `avatar_type` is either `uploaded`, `default`, or null.
- `username` must be trimmed and 3-40 characters when present.
- Completed profiles must have legal first name, legal last name, username,
  date of birth, avatar type, and avatar key.
- `profiles_username_lower_key` enforces case-insensitive unique usernames
  where username is not null.

## Auth Integration

The migration includes:

- `public.set_profiles_updated_at()` trigger function.
- `public.handle_new_user_profile()` trigger function.
- `on_auth_user_created_create_profile` trigger on `auth.users`.
- Backfill insert from existing `auth.users` into `public.profiles`.

New Supabase Auth users should automatically receive a `profiles` row with:

- `auth_user_id`
- `email`
- `auth_provider`

## RLS And Grants

RLS is enabled on `public.profiles`.

Current grants:

- `anon` has no access.
- `authenticated` can select from `profiles`.
- `authenticated` can update only onboarding/profile fields:
  - `legal_first_name`
  - `legal_last_name`
  - `username`
  - `date_of_birth`
  - `profile_photo_url`
  - `avatar_type`
  - `avatar_key`
  - `profile_completed`

Current policies:

- Authenticated users can select only their own profile:
  - `auth.uid() = auth_user_id`
- Authenticated users can update only their own profile:
  - `auth.uid() = auth_user_id`

The schema intentionally does not let normal users update `platform_role`,
`account_status`, `email`, `auth_provider`, or timestamps.

## Frontend Touchpoints

Relevant auth/onboarding files:

- `v2/pages/auth/login.html`
- `v2/pages/auth/signup.html`
- `v2/pages/auth/onboarding.html`
- `v2/scripts/auth/auth-shell.js`
- `v2/scripts/auth/onboarding.js`
- `v2/services/supabase/client.js`
- `v2/services/supabase/config.local.js`

Current behavior:

- Email/password signup uses Supabase Auth.
- Signup redirects confirmed users toward `pages/auth/onboarding.html`.
- Login loads the current user's `profiles.profile_completed` value.
- Incomplete profiles route to onboarding.
- Completed profiles route to `pages/dashboard/index.html`.
- Onboarding updates the authenticated user's own profile row and handles
  duplicate username errors from the database.
- Google sign-in is only a UI placeholder until OAuth credentials are connected.

## Migration Status

Tracked migrations now present locally:

- `20260524000100_create_profiles.sql`
- `20260525000100_create_courses_and_collaborators.sql`
- `20260525000200_create_classrooms_and_enrollments.sql`
- `20260525000300_create_modules_and_lessons.sql`
- `20260525000400_create_lesson_content_blocks.sql`
- `20260525000500_create_questions_and_options.sql`
- `20260525000600_create_submissions_and_progress.sql`
- `20260525000700_create_files_and_references.sql`
- `20260526000100_allow_classroom_details_updates.sql`
- `20260526000200_add_classroom_display_order.sql`
- `20260526000300_allow_course_and_classroom_archiving.sql`

The stale broader handoff says the linked Supabase project was synchronized
through `20260525000700`. Before relying on the hosted project, verify whether
the `20260526000100` through `20260526000300` migrations have been pushed
remotely. They are required for classroom detail edits, classroom ordering, and
course/classroom archiving grants.

## Permission Model Reminder

Do not introduce global `teacher` or `student` platform roles. The documented
model in `v2/ROLE_PERMISSIONS.md` reserves platform roles for:

- `user`
- `admin`

Teacher/student status is contextual through course ownership, collaboration,
classroom teaching access, and enrollment.

Admin behavior is reserved in the schema but not enabled in policies, UI, or
protected routes yet.

## Suggested Next Step For The New Thread

Start by checking:

1. `git status --short`
2. `git log --oneline --decorate -12`
3. `supabase migration list` or the Supabase CLI equivalent for local/remote
   migration sync
4. `v2/pages/courses/editor.html` versus `v2/scripts/courses/editor.js`

Then decide the course-builder direction:

- If the goal is to stabilize the current editor quickly, restore the removed
  content/question forms in `v2/pages/courses/editor.html`.
- If the goal is the next feature step, create the focused lesson builder under
  `v2/pages/lessons/` and `v2/scripts/lessons/`, then remove or replace the
  stale inline form code in `v2/scripts/courses/editor.js`.

## Anti-Stall Guardrails

The previous work session appears to have gotten stuck in a long-running loop
or repeated process. The next thread should use these guardrails before doing
more implementation:

- Do not repeatedly rerun the same failing command without changing something
  meaningful first.
- If a command fails twice with the same error, stop and inspect the specific
  file, migration, network, or permission issue before trying again.
- If a command hangs or produces no useful output for more than a few minutes,
  stop it, record what was running, and switch to a smaller diagnostic command.
- Keep dev-server and watcher commands in a clearly tracked terminal session;
  do not start multiple overlapping servers unless the port conflict is known
  and intentional.
- Before starting a long operation, run a quick `git status --short` and make
  sure the current task is not accidentally fighting uncommitted local edits.
- After each meaningful edit, run the smallest relevant check first. Examples:
  syntax/module import check, browser console check, targeted smoke test, then
  broader validation only after the small check is clean.
- If Supabase CLI work blocks on remote auth, network, or project-link state,
  do not keep retrying. Capture the exact command and error, then ask whether
  to continue with remote access or proceed using local-only inspection.
- If the browser/app gets stuck on auth redirects, check the current URL,
  browser console, `profiles.profile_completed`, and the Supabase Auth redirect
  allow list before changing unrelated UI code.
- If the course editor appears stuck or blank, first check the known HTML/script
  mismatch around removed content/question forms before debugging unrelated
  database policies.

Concrete stop rule: after 15 minutes without a new file change, new diagnostic
result, or clearer hypothesis, pause and write a status note with:

- the exact command or workflow that is stuck
- the last useful output or error
- what has already been tried
- the smallest next diagnostic step

This is meant to force a checkpoint instead of allowing another hour-long retry
cycle.

## Validation Guidance

For schema changes, prefer the Supabase migration flow:

1. Add a new migration under `supabase/migrations/`.
2. Run `supabase db push --dry-run`.
3. Apply only after the dry run is clean.
4. Keep RLS changes narrowly scoped to the users/profiles behavior being added.

Useful smoke checks after auth/profile changes:

- Sign up with email/password.
- Confirm the account if required.
- Verify a `profiles` row is created automatically.
- Log in.
- Confirm incomplete profiles land on onboarding.
- Save onboarding with legal name, username, date of birth, and default avatar.
- Confirm the user lands on the dashboard.
- Confirm duplicate usernames surface a friendly error.

Useful smoke checks after the later teacher/course/classroom work:

- From inside `v2`, run the local site so URLs omit `/v2`, for example
  `http://127.0.0.1:4173/pages/auth/login.html`.
- Log in with a completed teacher profile.
- Create a draft course from the dashboard.
- Open the course editor.
- Save course basics.
- Add a module.
- Add a lesson.
- Reorder modules and lessons.
- Collapse and expand a module.
- Delete a lesson/module and confirm it disappears without hard deletion.
- Open classroom management for the course.
- Create/edit/reorder/delete a classroom.
- Confirm dashboard counts update after returning.

## Work To Avoid In This Thread

Unless the user explicitly asks, do not use this schema thread to implement:

- Admin authorization or admin route protection.
- Storage buckets, upload flows, or object policies.
- Payment or monetization schema.
- Google OAuth activation.
- Global teacher/student account roles.
- Broad refactors of auth pages or course/classroom editor pages.
