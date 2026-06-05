# Version 2 Deployment Strategy

## Purpose

Version 2 should be deployed separately from the current Version 1 public site
until it is stable enough to become the main CodeTheCurrent experience.
See `V1_PROTECTION_PLAN.md` for the development guardrails that keep the root
V1 site stable while V2 evolves under `v2/`.

The current direction is to keep using GitHub Pages for the static frontend and
Supabase for auth, database, RPCs, RLS, and storage.

## Deployment Goals

- Keep Version 1 live and stable while V2 is built.
- Deploy V2 separately before any public replacement.
- Support a staging environment before production launch.
- Keep the frontend-to-Supabase architecture.
- Plan custom domain handling before V2 replaces V1.
- Use branch-based deployment rules when the project is ready for staging and
  production automation.

## Environment Strategy

| Environment | Branch direction | Frontend hosting | Supabase target | Purpose |
| --- | --- | --- | --- | --- |
| Local | `v2` or short-lived branches from `v2` | `127.0.0.1:4173` | Current linked project until staging exists | Manual development and browser testing |
| V2 staging | Future staging branch or protected `v2` preview | GitHub Pages preview or separate Pages site | Future staging Supabase project | Pre-release user testing and QA |
| V1 production | `main` | Existing public GitHub Pages site | Existing V1/static behavior | Stable public site until V2 launch |
| V2 production | Future release PR from `v2` into `main` | Main GitHub Pages site or custom-domain Pages target | Production Supabase project | Final public V2 launch |

The MVP currently develops on `v2`. When staging is introduced, prefer a
separate Supabase project and deployment target so staging tests cannot affect
future production users.

## GitHub Pages Plan

Current plan:

1. Keep `main` as the public V1 branch.
2. Keep `v2` as the active V2 development branch.
3. Use local server testing for daily V2 work.
4. Add a V2 staging deployment when the app is ready for broader testing.
5. Promote V2 to the public site through a final reviewed release PR.

Future Pages options:

- Use a separate GitHub Pages site or project preview for V2 staging.
- Use branch-based Pages publishing if the repo settings support it cleanly.
- Keep production tied to `main` until V2 is ready to replace V1.

## Supabase Deployment Plan

V2 remains a static frontend that talks directly to Supabase with a publishable
browser key.

Environment rules:

- Use only publishable keys in browser config.
- Keep service-role keys, database passwords, OAuth secrets, and admin tokens
  out of the repository and out of frontend files.
- Use separate Supabase projects for staging and production before launch.
- Configure auth redirect URLs per environment.
- Apply migrations intentionally with `supabase db push`; do not retry failed
  migration pushes in loops.

## Custom Domain Plan

Until V2 is ready, the existing public domain should keep serving V1.

Before V2 launch:

1. Decide whether staging needs its own subdomain, such as
   `v2.codethecurrent.com` or `staging.codethecurrent.com`.
2. Add staging and production URLs to Supabase auth redirect settings.
3. Confirm GitHub Pages custom-domain settings.
4. Verify HTTPS and redirects.
5. Confirm that V2 login, onboarding, dashboard, student lessons, teacher
   management, and admin pages work on the deployed URL.

When V2 replaces V1, point the primary custom domain at the V2 deployment and
keep a rollback note or tag for the last stable V1 state.

## Release Path

1. Finish launch-blocking V2 milestone issues.
2. Complete local and staging smoke tests.
3. Confirm Supabase migrations, RLS, RPCs, storage policies, and auth providers.
4. Confirm public asset URLs, lesson resources, and protected uploads.
5. Create a final release PR from `v2` into `main`.
6. Review the diff carefully because this replaces the public V1 experience.
7. Merge and deploy.
8. Monitor auth, dashboard, course discovery, classroom joining, submissions,
   admin pages, and activity logs.

## What Is Not Required Yet

- Full CI/CD automation.
- Paid hosting migration.
- Stripe or payment deployment.
- Production sample-data seeding.
- Replacing V1 before V2 is manually verified.
