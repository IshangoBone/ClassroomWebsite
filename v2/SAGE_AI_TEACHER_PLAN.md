# SAGE AI Teacher-Side Build Plan

## Current build

The SAGE teacher dashboard now starts with these surfaces:

- Classroom SAGE settings
- SAGE Lesson Generator planning workflow
- Placeholder entry points for insights, conversations, settings, and student profiles
- Student profile signal capture from reviewed SAGE conversations
- A paused student-facing SAGE chat shell with an OpenAI-backed Edge Function ready for later use

Classroom settings now have a Supabase-backed foundation through `sage_classroom_settings`, with a local development fallback if the migration has not been applied yet. Conversation review now reads live rows from `sage_conversations`, `sage_messages`, and `sage_conversation_signals`, and teachers can mark conversations reviewed from the SAGE dashboard.

The student-facing SAGE chat bubble is currently not mounted in the app shell. It can be restored later, but the near-term priority is teacher-triggered lesson generation because it gives more value while controlling OpenAI API usage.

The SAGE Lesson Generator panel now lets teachers choose a classroom, enter a lesson topic, enter the shared objective, and choose the first lesson ingredients SAGE should include. This is a no-credit planning workflow until the generation endpoint is connected.

## Teacher conversation review data

Recommended tables:

- `sage_conversations`
  - `id`
  - `classroom_id`
  - `lesson_id`
  - `student_profile_id`
  - `status`
  - `started_at`
  - `last_message_at`
  - `reviewed_at`
  - `reviewed_by`

- `sage_messages`
  - `id`
  - `conversation_id`
  - `sender_type`
  - `message_text`
  - `screen_context`
  - `created_at`

- `sage_conversation_signals`
  - `id`
  - `conversation_id`
  - `signal_type`
  - `summary`
  - `severity`
  - `teacher_action`
  - `created_at`

- `sage_student_profile_signals`
  - `id`
  - `student_profile_id`
  - `classroom_id`
  - `lesson_id`
  - `conversation_id`
  - `signal_id`
  - `signal_type`
  - `summary`
  - `evidence`
  - `confidence`
  - `source`
  - `added_by`
  - `created_at`

- `sage_classroom_settings`
  - `id`
  - `classroom_id`
  - `sage_chat_enabled`
  - `direct_answers_enabled`
  - `test_mode_enabled`
  - `conversation_review_enabled`
  - `updated_by`
  - `updated_at`

## First useful workflow

1. Teacher opens SAGE AI.
2. Teacher opens the SAGE Lesson Generator.
3. Teacher chooses a classroom.
4. Teacher enters the daily topic and shared class objective.
5. SAGE previews the classroom/profile context it will use.
6. Next, an AI endpoint will draft teacher-reviewable lesson versions from that context.
7. Later, SAGE Insights and conversation review feed stronger profile signals back into the generator.

## Database foundation

Added migration:

- `supabase/migrations/20260622000100_add_sage_teacher_foundation.sql`

The migration creates:

- `sage_classroom_settings`
- `sage_conversations`
- `sage_messages`
- `sage_conversation_signals`
- `sage_student_profile_signals`

The policies use the existing classroom management helpers so teachers can manage SAGE settings and review SAGE activity only for classrooms they manage. Students can own their future SAGE conversations and messages.

The migration also adds `add_sage_signal_to_student_profile(signal_to_add uuid)`, which lets a teacher promote one reviewed conversation signal into the student profile while marking that signal as `profile_added`.

## Current conversation review behavior

- The SAGE dashboard loads conversations for classrooms managed by the current teacher.
- Conversation cards show the student, classroom, lesson, latest student question, primary signal, and review status.
- The detail pane shows the latest student message, latest SAGE response, and recorded learning signals.
- Marking a conversation reviewed updates `sage_conversations.status` and marks pending `sage_conversation_signals` reviewed.
- Adding a signal to the student profile writes a durable `sage_student_profile_signals` row for future SAGE Insights and lesson generation.
- If the migration has not been applied yet, the page shows a ready state instead of prototype data.

## Next implementation step

Build the SAGE Lesson Generator endpoint and draft review flow:

1. Add database tables for lesson generation jobs, student lesson drafts, and teacher feedback.
2. Create a server-side generation endpoint that calls OpenAI with classroom, lesson, and student-profile context.
3. Return structured lesson JSON that maps to the existing lesson tools.
4. Let teachers preview generated drafts, regenerate, edit, and publish.
5. Store teacher edits as feedback so SAGE can improve future drafts.
