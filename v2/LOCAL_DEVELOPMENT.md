# V2 Local Development

## Purpose

Use this guide to run CodeTheCurrent Version 2 locally without touching the
Version 1 root site or future production users.

Version 2 is currently a static frontend in `v2/` that talks to Supabase from
the browser with a publishable key. Real secrets stay out of Git.

## One-Time Setup

From the repository root:

```bash
cp v2/.env.example v2/.env.local
cp v2/services/supabase/config.example.js v2/services/supabase/config.local.js
```

Edit `v2/.env.local` for your local notes and edit
`v2/services/supabase/config.local.js` for the browser app.

Use only browser-safe values in `config.local.js`:

- Supabase project URL
- Supabase publishable key
- `googleOAuthEnabled: true` only after the hosted Google provider is enabled

Never commit service-role keys, database passwords, OAuth secrets, or admin
tokens.

## Start The Local App

Run the lightweight static server from `v2/`:

```bash
cd /Users/jakebroos-williams/Developer/ClassroomWebsite/v2
python3 -m http.server 4173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4173/pages/dashboard/index.html
```

If you are not signed in, the protected pages should redirect to:

```text
http://127.0.0.1:4173/pages/auth/login.html
```

## Local Safety Rules

- Work inside `v2/` for Version 2 UI and scripts.
- Keep Version 1 files at the repository root stable unless an issue explicitly
  asks for root-site work.
- Keep real local configuration in ignored files:
  - `v2/.env.local`
  - `v2/.env.*.local`
  - `v2/services/supabase/config.local.js`
- Do not run `supabase db push` unless the issue requires a migration.
- If the same local command fails twice the same way, stop and diagnose before
  retrying.

## Environment Plan

The MVP currently uses one linked Supabase project. The planned environment
split is documented in more detail in `DEPLOYMENT_STRATEGY.md`.

Summary:

| Environment | Frontend use | Supabase use | Config file direction |
| --- | --- | --- | --- |
| Local | Manual browser testing on `127.0.0.1:4173` | Current linked project until staging exists | `v2/.env.local` and `config.local.js` |
| Staging | Pre-release V2 testing | Separate staging project later | `v2/.env.staging.local` and a staging browser config |
| Production | Final public V2 release | Separate production project later | Deployment-managed environment values |

When staging/production are added, each environment should have its own
Supabase project, auth redirect URLs, storage buckets, and publishable key.

## Sample Data Plan

Seeded sample data is planned but not implemented yet. When it is added, it
should:

- run only against local or staging targets
- create predictable sample users, courses, classrooms, lessons, enrollments,
  submissions, and activity logs
- never write sample data to production
- be documented with the exact command and required environment variables

Until a real seed script exists, use existing test accounts and manually created
records for browser checks.

## Quick Verification

Before committing local-environment changes, run:

```bash
git status --short
git diff --check
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open the local dashboard URL and confirm the app either loads your
authenticated workspace or redirects to login cleanly.
