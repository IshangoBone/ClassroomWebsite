# Codex Handoff

## Project

CodeTheCurrent V2 teacher and student platform repository.

## Current Status

The `v2` branch is pushed through the initial database foundation and minimum
profile onboarding flow. The Supabase CLI is initialized and linked to the
hosted CodeTheCurrent V2 project; migration history is synchronized locally
and remotely through `20260525000700`.

## Current Commit

`501b973` - Create file metadata and reference schema

## Completed Checkpoints

- Working Supabase email signup/login and profile-aware routing.
- Tested onboarding flow: confirmed account -> onboarding -> saved profile -> dashboard.
- Supabase CLI configuration and linked migration workflow.
- Issue #3: profiles schema and minimum self-only profile RLS.
- Issue #4: courses and course collaborators schema.
- Issue #5: classrooms, enrollments, and classroom teachers schema.
- Issues #6-#8: modules, lessons, lesson blocks, questions, and options schema.
- Issue #9: submissions and progress schema with private draft boundaries.
- Issue #10: file metadata and references schema, without storage buckets or uploads.

## Permission Model

Issue #2 is documented in `v2/ROLE_PERMISSIONS.md`. In brief:

- Platform roles remain `user` and reserved `admin`.
- Teacher and student status is contextual, not a permanent account role.
- Owners/collaborators manage courses; classroom teachers manage classrooms;
  enrollments represent student access.
- Admin behavior is not enabled until admin authorization and protected routes
  are implemented.

## Migration Status

Applied locally and in the linked Supabase project:

- `20260524000100_create_profiles.sql`
- `20260525000100_create_courses_and_collaborators.sql`
- `20260525000200_create_classrooms_and_enrollments.sql`
- `20260525000300_create_modules_and_lessons.sql`
- `20260525000400_create_lesson_content_blocks.sql`
- `20260525000500_create_questions_and_options.sql`
- `20260525000600_create_submissions_and_progress.sql`
- `20260525000700_create_files_and_references.sql`

## Next Work

- Commit the issue #2 permission-model documentation checkpoint.
- Do not implement issue #11 activity/audit visibility until an explicit admin
  authorization path exists; the issue requires admin-only viewing.
- Defer issue #12 monetization schema because it is marked non-MVP planning.
- Proceed into teacher-facing functionality with issue #13 only after keeping
  the contextual role model and route-security dependency visible.

## Development Rules

- Inspect the repository before editing and keep changes small.
- Use migrations for database changes and verify with `supabase db push --dry-run`
  before applying them.
- Avoid enabling admin, payment, storage upload, or Google OAuth behavior as an
  incidental part of another issue.
- Keep RLS additions scoped to the feature being introduced.

## Important Notes

- A formatting-only local change in `v2/pages/auth/login.html` is intentionally
  unstaged and must not be included in database or documentation commits.
- The local server was run from inside `v2`, so local page URLs omit `/v2`, for
  example `http://127.0.0.1:4173/pages/auth/login.html`.
- The Supabase Auth redirect allow list includes
  `http://127.0.0.1:4173/pages/auth/onboarding.html`.
