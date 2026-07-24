create or replace function public.reviewable_student_profiles()
returns table (
    id uuid,
    username text,
    legal_first_name text,
    legal_last_name text
)
language sql
stable
security definer set search_path = ''
as $$
    select distinct
        profile.id,
        profile.username,
        profile.legal_first_name,
        profile.legal_last_name
    from public.profiles as profile
    join public.enrollments as enrollment
        on enrollment.user_id = profile.id
    where enrollment.enrollment_status = 'active'
        and (
            public.can_manage_course(enrollment.course_id)
            or (
                enrollment.classroom_id is not null
                and public.manages_classroom(enrollment.classroom_id)
            )
        );
$$;

revoke all on function public.reviewable_student_profiles() from public;
grant execute on function public.reviewable_student_profiles() to authenticated;
