# Version 1 Protection Plan

## Purpose

Version 1 must stay live and usable while Version 2 is built in parallel.
Version 2 work should not accidentally break the current GitHub Pages site.

## Current Separation

| Area | Location | Rule |
| --- | --- | --- |
| Version 1 public site | Repository root HTML, CSS, JS, data files, `CNAME`, `robots.txt`, `sitemap.xml` | Treat as stable/live unless an issue explicitly asks for V1 work. |
| Version 2 platform | `v2/` | Build new platform features here. |
| Supabase backend | `supabase/` and `v2/supabase/migrations` | Use intentionally for V2 database/auth/storage work. |

The root site and the V2 platform should coexist until V2 is ready to replace
V1 through a final reviewed release.

## Development Guardrails

- Start V2 work from the `v2` branch.
- Check `git status --short` before editing.
- Keep routine V2 frontend changes inside `v2/`.
- Avoid editing root V1 files unless the GitHub issue specifically includes V1.
- Do not change `CNAME`, `robots.txt`, or `sitemap.xml` as part of ordinary V2
  feature work.
- Do not move root V1 pages into `v2/` or V2 pages into the root during active
  development.
- Use shared V2 docs for local setup, workflow, and deployment strategy:
  - `LOCAL_DEVELOPMENT.md`
  - `V2_WORKFLOW.md`
  - `DEPLOYMENT_STRATEGY.md`

## Reuse Strategy

V2 can reuse selected V1 assets and ideas, but it should not be forced into the
old static-course structure.

Good reuse:

- brand name, voice, and logo direction
- course topics and lesson ideas
- public marketing copy when it still fits
- stable visual conventions that remain useful

Avoid:

- coupling V2 app pages to V1 data files
- changing V1 course pages just to support V2
- duplicating V2 app logic into root scripts
- making V2 release depend on unfinished V1 refactors

## Pre-Commit Checklist For V2 Work

Before committing V2 changes, verify:

- `git status --short` shows only intended files plus any known ignored/untracked
  handoff files.
- Root V1 files were not changed unless the issue explicitly required it.
- V2 still runs locally from `v2/` on `127.0.0.1:4173`.
- Supabase migrations were only pushed when the issue required database changes.
- Manual browser checks were completed for user-facing changes.

## Migration Plan

V2 can replace V1 only after the platform is stable enough for real users.

Future migration steps:

1. Finish launch-blocking V2 issues.
2. Confirm V2 auth, dashboard, course discovery, classrooms, lessons,
   submissions, admin tools, RLS, storage, and deployment behavior.
3. Decide whether V2 needs a staging subdomain before full launch.
4. Create a final release PR from `v2` into `main`.
5. Review all root file replacements carefully.
6. Preserve or tag the final stable V1 state for rollback context.
7. Merge and deploy V2 as the primary public experience.

Until that release, the root Version 1 site remains the stable public site and
Version 2 remains isolated under `v2/`.
