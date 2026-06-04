# Version 2 Git Workflow

## Purpose

Version 2 is developed separately from the current public Version 1 site so V1
can stay stable while the platform work continues.

## Branch Strategy

| Branch | Purpose |
| --- | --- |
| `main` | Stable Version 1 public site. Keep this focused on the current live experience until V2 is ready to replace it. |
| `v2` | Long-lived active development branch for Version 2. Feature work lands here before anything reaches `main`. |
| `codex/<short-task>` or `feature/v2-<short-task>` | Optional short-lived branches for larger V2 features or PR checkpoints. Branch from `v2`, then merge back into `v2`. |

Small solo-development checkpoints may be committed directly to `v2` when the
scope is narrow, tested, and pushed immediately. Larger or riskier work should
use a short-lived branch and pull request.

## Naming Convention

Use simple, readable names:

```text
v2
codex/v2-auth-polish
codex/v2-course-copy
feature/v2-student-dashboard
feature/v2-course-builder
```

Prefer a name that includes `v2` and the issue or feature area.

## Issue Workflow

1. Start from an up-to-date `v2` branch.
2. Check `git status --short` before editing.
3. Preserve unrelated local files and uncommitted work.
4. Break large issues into small, testable slices.
5. Commit only the files needed for that slice.
6. Push the slice to `origin/v2`.
7. Close the GitHub issue only after the requirements are implemented,
   checked, and pushed.

## Pull Request Workflow

Use pull requests for:

- larger features
- database or RLS changes with high risk
- deployment changes
- work that should be reviewed before it lands in `v2`

PR flow:

1. Branch from `v2`.
2. Complete and test the feature slice.
3. Open a PR back into `v2`.
4. Review the diff, migrations, and manual-test notes.
5. Merge into `v2`.
6. Delete the short-lived branch after merge.

## Release Path

V2 should not replace V1 until the platform is stable enough for real users.

Future release flow:

1. Finish the V2 milestone issues required for launch.
2. Confirm Supabase environment, RLS, storage, auth, and deployment settings.
3. Create a final release PR from `v2` into `main`.
4. Review V1-to-V2 file replacement carefully.
5. Deploy V2 as the main public experience.
6. Keep a rollback note or tag for the last stable V1 state.

Until that final release PR, `main` remains the Version 1 public site and `v2`
remains the active Version 2 development branch.
