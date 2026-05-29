alter table public.lesson_submissions
    add column teacher_feedback text,
    add column feedback_updated_by uuid references public.profiles (id) on delete set null,
    add column feedback_updated_at timestamptz;

grant update (
    points_earned,
    teacher_feedback,
    feedback_updated_by,
    feedback_updated_at
) on table public.lesson_submissions to authenticated;

create policy "Teachers can update managed submitted feedback"
    on public.lesson_submissions
    for update
    to authenticated
    using (
        status = 'submitted'
        and public.can_review_student_context(course_id, classroom_id)
    )
    with check (
        status = 'submitted'
        and public.lesson_belongs_to_course(lesson_id, course_id)
        and public.can_review_student_context(course_id, classroom_id)
    );
