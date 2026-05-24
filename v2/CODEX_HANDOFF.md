# Codex Handoff

## Project
CodeTheCurrent V2 teacher website repo.

## Current Status
The project has been pushed to GitHub as v2. The next onboarding/database work is present locally but has not been committed yet.

## Current Commit
84ff3c5 — Connect V2 auth flow to Supabase

## Completed So Far
- Shared login/signup shell
- Supabase client wiring
- Working login error handling
- Working signup account creation
- Basic V2 auth flow connected to Supabase
- Supabase `profiles` migration created and applied manually to the V2 Supabase project
- Minimum self-only profile RLS policies applied manually in Supabase
- Profile-aware login/signup routing into onboarding or dashboard
- Minimum onboarding form for private names, username, date of birth, and default avatar choice
- Email confirmation redirect requested to the local onboarding route for future signups
- Full tested flow: confirmed account login -> onboarding -> saved profile with `compass` avatar -> dashboard

## Current Development Goal
Checkpoint the minimum onboarding flow, establish a repeatable Supabase migration/config workflow, then begin the next data-backed feature.

## Development Rules
- Inspect the repo before editing.
- Keep changes small and controlled.
- Do not redesign the entire app.
- Do not change auth unless it is required for onboarding.
- Do not add unnecessary packages.
- Do not make large architectural changes without explaining the reason first.
- After every change, list every file changed and explain what changed.
- Before moving to the next major feature, confirm the app builds or runs locally.

## Uncommitted Files From Current Checkpoint
- `supabase/migrations/20260524000100_create_profiles.sql`
- `v2/pages/auth/login.html`
- `v2/pages/auth/onboarding.html`
- `v2/pages/auth/signup.html`
- `v2/scripts/auth/auth-shell.js`
- `v2/scripts/auth/onboarding.js`
- `v2/styles/main.css`

## Next Steps
- Add the local onboarding callback URL to the Supabase Auth redirect allow list if future confirmation-link testing is needed:
  - `http://127.0.0.1:4173/pages/auth/onboarding.html`
- Review and commit the tested profiles/onboarding checkpoint.
- Establish a repeatable Supabase migration workflow before adding additional database tables.
- Continue in dependency order with the courses/collaborators schema only after the onboarding checkpoint is committed.

## Important Notes
The old Codex thread became too large and failed during automatic context compaction. This file is now the source of truth for continuing development.

- The local dev server was run from inside `v2`, so local page URLs omit the `/v2` path segment, for example:
  - `http://127.0.0.1:4173/pages/auth/login.html`
- Email confirmation originally returned to the local server root because no onboarding redirect was supplied; the local code now supplies `emailRedirectTo` for new signups.
- Do not implement teacher/student/course/admin/Google OAuth functionality as part of the completed profile/onboarding checkpoint.
