create or replace function public.leave_student_enrollment(enrollment_id_input uuid)
returns table (
    enrollment_id uuid,
    course_id uuid,
    classroom_id uuid,
    enrollment_type text,
    enrollment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    profile_id uuid;
    target_enrollment record;
begin
    profile_id := public.current_profile_id();

    if profile_id is null then
        raise exception 'Complete your profile before leaving a course.';
    end if;

    select enrollment.id,
           enrollment.user_id,
           enrollment.course_id,
           enrollment.classroom_id,
           enrollment.enrollment_type,
           enrollment.enrollment_status
    into target_enrollment
    from public.enrollments as enrollment
    where enrollment.id = enrollment_id_input
    limit 1;

    if target_enrollment.id is null then
        raise exception 'That enrollment could not be found.';
    end if;

    if target_enrollment.user_id <> profile_id then
        raise exception 'You can only leave your own enrollments.';
    end if;

    update public.enrollments as enrollment
    set enrollment_status = 'removed'
    where enrollment.id = target_enrollment.id
    returning enrollment.id,
              enrollment.course_id,
              enrollment.classroom_id,
              enrollment.enrollment_type,
              enrollment.enrollment_status
    into enrollment_id,
         course_id,
         classroom_id,
         enrollment_type,
         enrollment_status;

    return next;
end;
$$;

revoke all on function public.leave_student_enrollment(uuid) from public;
grant execute on function public.leave_student_enrollment(uuid) to authenticated;
