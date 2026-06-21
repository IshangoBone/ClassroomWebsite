# Codex Handoff

## Start Here

Repository:

`/Users/jakebroos-williams/Developer/ClassroomWebsite`

Current branch:

`codex/deidentified-mvp`

Latest pushed commit:

`3546b2b Make shared navbar responsive`

Current workflow:

- Keep working on `codex/deidentified-mvp`.
- Do not push every small change to live/main.
- Preserve uncommitted and untracked work.
- Do not commit `v2/CREATE_USERS_PROFILES_SCHEMA_HANDOFF.md` unless Jake explicitly asks.
- Do not rerun `supabase db push` unless there is a clear database/migration reason.
- Avoid retry loops. If something fails twice the same way, stop and diagnose.

## Current State

As of this handoff:

```text
git branch --show-current
codex/deidentified-mvp

git log -1 --oneline
3546b2b Make shared navbar responsive

git status --short
?? v2/CREATE_USERS_PROFILES_SCHEMA_HANDOFF.md
```

The only untracked file should still be:

`v2/CREATE_USERS_PROFILES_SCHEMA_HANDOFF.md`

## What We Are Building Now

We are carving a cleaner MVP out of the existing V2 app so it can run real classroom testing.

The MVP direction:

- Focus on student and teacher workflows first.
- One main course for now: `Computing Foundations for a Digital Age`.
- Four default classrooms/periods planned: 2, 3, 5, and 6.
- Students can be identifiable.
- A possible de-identified mode can exist later, but it is not the current blocker.
- Keep the existing larger V2 work intact; do not delete broad functionality unless asked.

Core MVP workflows:

1. Student signs up or logs in.
2. Student joins a class with a class code.
3. Student sees `Home`, `My Classes`, `Browse Courses`, and `Profile`.
4. Student opens lessons, completes work, turns in lessons, and earns engagement points.
5. Teacher logs in.
6. Teacher sees courses/classes they teach.
7. Teacher can manage rosters and individual students.
8. Teacher can use the lesson builder inside the course/class workflow.
9. Teacher can view class-level and student-level analytics.
10. Teacher can create more classrooms if needed.

## Recently Completed

### Shared Navbar

Commit:

`3546b2b Make shared navbar responsive`

What changed:

- Replaced the old sidebar-style shared navigation with a full-width sticky top navbar.
- Desktop now behaves like a normal website navbar.
- Mobile and small screens now show a compact hamburger menu that expands into stacked links.
- Shared nav is rendered through `v2/scripts/utils/app-sidebar.js`, despite the old filename.
- `auth-guard.js` imports the cache-bumped shared nav.
- V2 page stylesheet query strings were cache-bumped to load the new CSS.

Files involved:

- `v2/scripts/utils/app-sidebar.js`
- `v2/scripts/utils/auth-guard.js`
- `v2/styles/main.css`
- V2 HTML pages with updated stylesheet cache tags.

Checks that passed:

```bash
node --input-type=module --check < v2/scripts/utils/app-sidebar.js
node --input-type=module --check < v2/scripts/utils/auth-guard.js
python3 -m html.parser v2/pages/dashboard/index.html
python3 -m html.parser v2/pages/lessons/builder.html
git diff --check
```

Browser note:

- The in-app browser redirected protected pages to login because it was unauthenticated.
- Attempts to use a data/file fixture for visual testing were blocked by browser policy.
- Do not keep retrying that same fixture path.

## Current Local URLs

If the local server is running:

- Dashboard: `http://127.0.0.1:4173/v2/pages/dashboard/index.html`
- Browse courses: `http://127.0.0.1:4173/v2/pages/courses/discover.html`
- Student course view: `http://127.0.0.1:4173/v2/pages/courses/student.html`
- Lesson view: `http://127.0.0.1:4173/v2/pages/lessons/view.html?lesson=LESSON_ID`
- Lesson builder: `http://127.0.0.1:4173/v2/pages/lessons/builder.html?lesson=LESSON_ID`

If the server is off:

```bash
cd /Users/jakebroos-williams/Developer/ClassroomWebsite
python3 -m http.server 4173 --bind 127.0.0.1
```

Note: Some older messages used `/pages/...` from inside `v2`. Current links above include `/v2/pages/...` from the repository root server.

## Navigation Decisions

Current desired product navigation is top-navbar based, not sidebar based.

Student nav should be simple:

- Home
- My Classes
- Browse Courses
- Profile

Teacher nav should be simple:

- Home
- My Courses
- Classes / class detail flows
- Profile

Teacher analytics and student work should generally live inside the relevant course/class context instead of being top-level nav clutter.

Account/menu area should stay minimal:

- Settings
- Log out

Help/support items can exist, but should not dominate the MVP nav.

## Next Best Task

Start with responsive layout cleanup across MVP pages now that the navbar is fixed.

Recommended order:

1. Student dashboard / My Classes
2. Browse Courses
3. Student lesson view
4. Profile
5. Teacher home
6. Teacher My Courses / Classes I Teach
7. Class detail / roster
8. Lesson builder

Goals for the responsive cleanup:

- Page content should not feel zoomed in.
- Cards and buttons should never overflow the viewport.
- Mobile should stack cleanly.
- Tablet and desktop should use comfortable max-widths and padding.
- Tables/filter bars should collapse or stack in a usable way.
- The sticky top navbar should stay visible while scrolling.

## Known Product Notes

Lesson builder direction:

- Should feel closer to Google Sites: lesson page canvas, right-side insert panel, clear content blocks.
- Content tools: text, images, YouTube, upload/PDF, slides, dividers/spacers, etc.
- Data collection tools should insert into the lesson page itself, not into a separate disconnected assessment section.
- Student lesson view should show the full lesson page and a clean turn-in area at the bottom.

Teacher/classroom direction:

- Roster controls are a likely next major feature after responsive polish.
- Teachers need class code joining, roster management, individual student views, and class analytics.
- Lesson unlock timing is by class, based on lesson completion/unlock rules.
- Students can submit late work.

Authentication notes:

- Login/signup loading feedback was improved earlier.
- Password reset flow was added earlier.
- Supabase redirect URLs may need production configuration when deploying.

## Suggested New Thread Starter

Paste this into the new thread:

```text
Please pick up from the handoff file at:

/Users/jakebroos-williams/Developer/ClassroomWebsite/v2/CODEX_HANDOFF.md

Read that first, then check git status --short, current branch, and latest commit before editing anything.

We are on branch codex/deidentified-mvp. Preserve uncommitted work and do not commit v2/CREATE_USERS_PROFILES_SCHEMA_HANDOFF.md.

The latest pushed commit should be 3546b2b Make shared navbar responsive.

Next task: start responsive layout cleanup across the MVP pages, beginning with the student-facing pages. The navbar is now a sticky full-width responsive top navbar, but the page bodies still need to adapt better across mobile, tablet, desktop, and classroom displays.
```
