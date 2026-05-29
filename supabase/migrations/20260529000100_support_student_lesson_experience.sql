create view public.student_visible_questions as
select
    question.id,
    question.lesson_id,
    question.phase,
    question.question_type,
    question.prompt,
    question.student_instructions,
    question.hint,
    question.points,
    question.is_required,
    question.order_index
from public.questions as question
where question.is_visible
    and question.archived_at is null
    and public.lesson_is_available(question.lesson_id)
    and public.can_view_course_content(public.course_id_for_lesson(question.lesson_id));

create view public.student_visible_question_options as
select
    option.id,
    option.question_id,
    option.option_text,
    option.option_value,
    option.order_index
from public.question_options as option
join public.questions as question
    on question.id = option.question_id
where question.is_visible
    and question.archived_at is null
    and public.lesson_is_available(question.lesson_id)
    and public.can_view_course_content(public.course_id_for_lesson(question.lesson_id));

revoke all on table public.student_visible_questions from anon;
revoke all on table public.student_visible_questions from authenticated;
revoke all on table public.student_visible_question_options from anon;
revoke all on table public.student_visible_question_options from authenticated;

grant select on table public.student_visible_questions to authenticated;
grant select on table public.student_visible_question_options to authenticated;

grant update (
    answers_json,
    total_questions,
    points_possible,
    status,
    submitted_at
) on table public.lesson_submissions to authenticated;

create policy "Students can submit their own lesson drafts"
    on public.lesson_submissions
    for update
    to authenticated
    using (
        student_user_id = public.current_profile_id()
        and status = 'draft'
        and public.can_submit_draft_for_context(course_id, classroom_id)
    )
    with check (
        student_user_id = public.current_profile_id()
        and status = 'submitted'
        and submitted_at is not null
        and public.lesson_belongs_to_course(lesson_id, course_id)
        and public.can_submit_draft_for_context(course_id, classroom_id)
    );
