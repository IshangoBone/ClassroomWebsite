# V2 Supabase Setup

## Purpose

This document closes out the Supabase foundation for GitHub issue #47. Version 2
uses one linked Supabase project for the current MVP backend: authentication,
Postgres database migrations, row-level security, RPCs, activity logs, and
Storage buckets.

## Frontend Configuration

For the full local startup flow, see `LOCAL_DEVELOPMENT.md`.

The browser app reads its Supabase client settings from:

```text
v2/services/supabase/config.local.js
```

That file is intentionally ignored by Git. Create it from the tracked example:

```bash
cp v2/services/supabase/config.example.js v2/services/supabase/config.local.js
```

Then set:

- `supabaseUrl`: the project URL, for example `https://<project-ref>.supabase.co`
- `supabasePublishableKey`: the browser-safe Supabase publishable key
- `googleOAuthEnabled`: `true` only after the hosted Google auth provider is
  enabled

Do not commit service-role keys, database passwords, OAuth secrets, or admin
tokens. The static frontend should use only the publishable browser key.

## Auth Configuration

Current local auth settings live in `supabase/config.toml`:

- local site URL: `http://127.0.0.1:4173/pages/auth/login.html`
- local onboarding redirect: `http://127.0.0.1:4173/pages/auth/onboarding.html`
- email/password signup enabled
- anonymous sign-in disabled

Hosted project checklist:

- Email/password auth enabled.
- Google OAuth enabled in the Supabase dashboard when Google sign-in is needed.
- Google OAuth client id and secret stored only in Supabase/provider settings.
- `googleOAuthEnabled: true` in `config.local.js` after Google OAuth is enabled.
- Redirect URLs include the local V2 URLs above and any future staging or
  production V2 URLs.

## Database And RLS

Database structure is managed through `supabase/migrations`. The current
migration history includes:

- profiles and auth-user profile creation
- courses and collaborators
- classrooms, teachers, enrollments, join flows, and roster management
- modules, lessons, visible content blocks, questions, options, submissions,
  progress, and feedback
- public course discovery and public course enrollment
- activity logs and admin dashboards/search/detail/moderation/analytics RPCs
- admin and supreme-admin role controls
- core RLS hardening for issues #39/#40

RLS is enabled from the first table migrations and is tightened through shared
helper functions. See:

- `v2/ROLE_PERMISSIONS.md`
- `v2/FILE_ACCESS_RULES.md`

## Storage

Storage is enabled in `supabase/config.toml`. Issue #42 created the MVP bucket
and object policy foundation:

| Bucket | Public | Use |
| --- | --- | --- |
| `profile-photos` | No | Uploaded profile photos and avatar-like user media. |
| `course-public-assets` | Yes | Public course thumbnails and discovery-safe assets. |
| `lesson-resources` | No | Lesson, classroom, document, audio, and media resources. |
| `submission-uploads` | No | Student submission attachments and draft-work uploads. |

Private object reads require matching active `public.files` metadata and the
same course/classroom/submission/admin permissions enforced by database RLS.

## Local Startup

Run the static V2 app from the `v2` directory:

```bash
cd /Users/jakebroos-williams/Developer/ClassroomWebsite/v2
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4173/pages/dashboard/index.html
```

If the browser redirects to login, sign in with a Supabase user whose profile is
active and completed.

## Remote Migration Workflow

Before pushing migrations, check the tree and review the pending SQL:

```bash
git status --short
supabase migration list
```

Apply pending migrations to the linked project with:

```bash
supabase db push
```

Do not rerun `supabase db push` in loops. If the same failure repeats, stop and
diagnose the specific SQL, network, or Supabase CLI issue.

Some linked read-only CLI checks, such as `supabase migration list` or
`supabase db query --linked`, may require `SUPABASE_DB_PASSWORD` if Supabase's
temporary login role fails. Keep that database password outside the repository.

## Future Environments

The current MVP uses one Supabase project. To add staging or production later:

- create a separate Supabase project per environment
- copy migrations through `supabase db push`
- create a separate ignored config file for each local target
- configure environment-specific auth redirect URLs
- never share service-role keys with the static frontend

Use `v2/.env.example` as the template for future local/staging notes and keep
real environment files ignored.
