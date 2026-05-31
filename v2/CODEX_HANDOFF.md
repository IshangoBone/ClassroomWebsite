# Codex Handoff

## Context

Repository: `/Users/jakebroos-williams/Developer/ClassroomWebsite`

Branch: `v2`

User wants small, complete GitHub issue chunks. Avoid long retry loops. If the same command or browser/test path fails twice the same way, stop and diagnose instead of rerunning blindly.

Preserve unrelated/untracked work. In particular, `v2/CREATE_USERS_PROFILES_SCHEMA_HANDOFF.md` is still untracked from older work and should not be committed unless the user explicitly asks.

## Current Goal

Working on GitHub issue #20: `TEACHER PORTAL: Build publish and archive controls`.

Issue #22 was completed, committed, and pushed earlier as:

`cf1f737 Complete student course join flows`

The user should be able to close #22 if they have not already.

## Current Local State

As of this handoff, `git status --short` showed:

```text
 M v2/pages/courses/editor.html
 M v2/scripts/classrooms/manage.js
 M v2/scripts/courses/editor.js
?? supabase/migrations/20260531000300_enforce_archive_visibility_rules.sql
?? v2/CREATE_USERS_PROFILES_SCHEMA_HANDOFF.md
```

`v2/CODEX_HANDOFF.md` itself is also modified by this handoff.

The next thread verified the non-destructive browser paths and source-backed
confirmation behavior, then prepared the issue #20 files for commit.

## Work Done In This Chunk

### Course publish/archive controls

Files changed:

- `v2/pages/courses/editor.html`
- `v2/scripts/courses/editor.js`

Added course access controls:

- `Publish course` / `Make private`
- `Copy public course link`
- `Archive course`
- `Delete course`

Added publish validation blockers before a course can be published:

- course title required
- course description required
- subject area required
- estimated course length required
- at least one module required
- at least one lesson required
- at least one visible lesson content block required
- each lesson needs objective
- each lesson needs overview/summary
- each lesson needs estimated time
- each lesson needs visible `before`, `during`, and `reflection` questions

Added confirmation warnings for:

- publish
- unpublish/make private
- archive course
- soft delete course

Archive behavior:

- status becomes `archived`
- public course link disabled
- publish button disabled
- copy link disabled
- historical management screen remains visible

Delete behavior:

- status becomes `deleted`
- redirects to dashboard
- this is soft delete only

### Classroom archive controls

File changed:

- `v2/scripts/classrooms/manage.js`

Added `Archive classroom` button with confirmation warning.

Archived classroom behavior:

- status becomes `archived`
- `join_enabled` becomes `false`
- card remains visible in classroom manager
- card says archived classrooms are view-only
- edit, join code, invite link, regenerate code, open/close joining, and drag reorder are disabled/hidden
- delete remains available as a soft-delete action

### Backend archive enforcement

New migration:

- `supabase/migrations/20260531000300_enforce_archive_visibility_rules.sql`

This migration was successfully applied to the remote Supabase project with:

```bash
supabase db push
```

The first attempt failed because sandboxing blocked writing `~/.supabase/telemetry.json`. It was retried once with escalation and succeeded. Do not rerun blindly.

The migration updates:

- `preview_classroom_join_by_code`
- `join_classroom_by_code`
- `preview_classroom_join_by_invite`
- `join_classroom_by_invite`
- `can_submit_draft_for_context`

Backend behavior now blocks:

- joining classrooms when the course is `archived` or `deleted`
- joining classrooms unless classroom status is `active`
- student draft/submission writes when the course is `archived` or `deleted`
- student draft/submission writes when the classroom context is not `active`

Teacher review access remains allowed through `can_review_student_context`.

## Verification Already Run

Passed:

```bash
node --input-type=module --check < v2/scripts/courses/editor.js
node --input-type=module --check < v2/scripts/classrooms/manage.js
git diff --check
supabase db push
```

Browser/local page checks:

- Login page loaded at `http://127.0.0.1:4173/pages/auth/login.html` through the in-app browser.
- The local server appears to be running on `4173`; trying to start another server on `4173` returned `Address already in use`.
- Dashboard loaded at `http://127.0.0.1:4173/pages/dashboard/index.html` with an authenticated teacher session.
- Incomplete draft course `Introduction to Engineering Design` showed `Course access` controls.
- Clicking `Publish course` on that incomplete draft did not change state and showed missing requirements:
  course description, at least one lesson, and at least one visible content block.
- Published course `AP Computer Science A` showed `Make private`, enabled public link copy, archive, and delete controls.
- Public link copy fell back to displaying the join URL in-page when browser clipboard access was unavailable.
- Classroom manager for `Intro to Computer Science` showed `Archive classroom` controls for active classrooms.
- Native confirm dialogs were not accepted on live records to avoid unpublishing or archiving real course/classroom data.
  Confirmation warning strings and post-confirm state updates were verified in source.

Browser asset verification was interrupted before completion. I tried one page-scope asset check, but browser runtime does not expose ordinary `fetch`/`XMLHttpRequest` constructors in that evaluation context. Do not repeat that path. Use normal page navigation/manual testing instead.

## What Still Needs Testing

Use this link if the server is still running:

`http://127.0.0.1:4173/pages/dashboard/index.html`

If not running, start from VS Code terminal:

```bash
cd /Users/jakebroos-williams/Developer/ClassroomWebsite/v2
python3 -m http.server 4173 --bind 127.0.0.1
```

Optional remaining destructive-ish test path, only with an explicit throwaway record or user approval:

1. On a complete throwaway course, accept the `Publish course` confirmation.
   - Badge should show public and public link copy should enable.
2. Accept `Make private` on that throwaway course.
   - Existing enrolled students/classrooms should keep access.
3. Accept `Archive classroom` on a throwaway classroom.
   - Classroom card should become view-only and joining should close.
4. Optional deeper check:
   - As a student in an archived classroom, try to submit work.
   - The database should block the write.

Do not archive/delete the user’s real useful course/classroom unless they are okay with it. For destructive-ish tests, use a throwaway test course/classroom if possible.

## Likely Next Code Fixes If Testing Fails

Potential gaps to watch:

- Publish validation may be stricter than the user expects because it requires every lesson to have before/during/reflection questions and estimated time.
- Course editor cache may need hard refresh because the script query string was changed to `v=20260531-publish-controls`.
- If archived classroom still allows a student to open an existing lesson, that may be okay; #20 specifically says archived classrooms should not allow new submissions. The migration blocks saving/submitting.
- If the UI should support unarchiving/restoring, that is not implemented yet. #20 did not explicitly require restore.

## Commit Guidance

After manual testing, stage only the issue #20 files:

```bash
git add \
  supabase/migrations/20260531000300_enforce_archive_visibility_rules.sql \
  v2/pages/courses/editor.html \
  v2/scripts/classrooms/manage.js \
  v2/scripts/courses/editor.js \
  v2/CODEX_HANDOFF.md
```

Do not add:

```text
v2/CREATE_USERS_PROFILES_SCHEMA_HANDOFF.md
```

Suggested commit message after verified:

```bash
git commit -m "Add publish and archive controls"
```

Then push:

```bash
git push origin v2
```

After pushing and confirming behavior, issue #20 may likely be closed.

## Anti-Stall Notes

- Do not rerun `supabase db push`; it already succeeded for the new migration.
- Do not repeat the failed browser asset `fetch` / `XMLHttpRequest` check; use normal page navigation or file-based checks.
- If a page looks stale, hard refresh first (`Cmd + Shift + R`) because this is a static Python server.
- If localhost commands fail in sandbox but browser works, trust the browser/server state and avoid spinning on `curl`.
