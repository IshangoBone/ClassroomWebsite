# Submission Flow Verification

Use this checklist when validating issues #24, #36, #37, and #38.

## Apply Supabase Updates

Apply these migrations to the hosted Supabase project before final browser
testing:

- `supabase/migrations/20260529000100_support_student_lesson_experience.sql`
- `supabase/migrations/20260529000200_allow_manager_lesson_submission_preview.sql`
- `supabase/migrations/20260529000300_add_submission_feedback_fields.sql`
- `supabase/migrations/20260529000400_add_reviewable_student_profiles.sql`

## Local Server

Run the V2 site from the `v2` directory:

```bash
cd /Users/jakebroos-williams/Developer/ClassroomWebsite/v2
python3 -m http.server 4173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4173/pages/auth/login.html
```

## Student Checks

- Open a lesson URL with a valid `lesson` query parameter.
- Confirm lesson content renders.
- Answer at least one question and confirm the draft saves.
- Refresh the page and confirm the draft restores.
- Reset the draft and confirm answers clear.
- Turn in the lesson and confirm answers lock.
- Return to the dashboard and confirm the lesson appears under `My lesson work`.
- Open the submitted lesson from `My lesson work`.

## Teacher Checks

- Log in as a course/classroom manager.
- Confirm drafts do not appear under `Recent student submissions`.
- Confirm submitted lessons do appear.
- Filter submissions by course, classroom, lesson, and student.
- Open a submitted lesson.
- Confirm the answer review page loads.
- Save points and teacher feedback.
- Log back in as the student and confirm feedback is visible.

## Close Criteria

- Close #24 when student lesson content, questions, and completion state work.
- Close #36 when draft save, restore, and reset work.
- Close #37 when final turn-in locks answers and records submission data.
- Close #38 when teacher review, filters, feedback, and student history work.
