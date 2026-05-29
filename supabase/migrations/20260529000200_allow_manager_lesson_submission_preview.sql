create or replace function public.can_submit_draft_for_context(
    course_to_check uuid,
    classroom_to_check uuid
)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select
        public.can_review_student_context(course_to_check, classroom_to_check)
        or exists (
            select 1
            from public.enrollments as enrollment
            where enrollment.user_id = public.current_profile_id()
                and enrollment.course_id = course_to_check
                and enrollment.enrollment_status = 'active'
                and (
                    (
                        classroom_to_check is null
                        and enrollment.enrollment_type = 'course'
                        and enrollment.classroom_id is null
                    )
                    or (
                        classroom_to_check is not null
                        and enrollment.enrollment_type = 'classroom'
                        and enrollment.classroom_id = classroom_to_check
                    )
                )
        );
$$;

revoke all on function public.can_submit_draft_for_context(uuid, uuid) from public;
grant execute on function public.can_submit_draft_for_context(uuid, uuid) to authenticated;
