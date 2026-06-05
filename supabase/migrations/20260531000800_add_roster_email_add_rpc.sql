create or replace function public.add_student_to_classroom_by_email(
    classroom_to_check uuid,
    student_email_input text
)
returns table (
    enrollment_id uuid,
    student_user_id uuid,
    email text,
    enrollment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    normalized_email text;
    target_classroom record;
    target_profile record;
    existing_enrollment record;
    final_enrollment_id uuid;
begin
    normalized_email := lower(nullif(btrim(coalesce(student_email_input, '')), ''));

    if normalized_email is null then
        raise exception 'Enter a student email address.';
    end if;

    select
        classroom.id as classroom_id,
        classroom.course_id,
        classroom.status as classroom_status,
        course.status as course_status
    into target_classroom
    from public.classrooms as classroom
    join public.courses as course
        on course.id = classroom.course_id
    where classroom.id = classroom_to_check
    limit 1;

    if target_classroom.classroom_id is null then
        raise exception 'This classroom could not be found.';
    end if;

    if not public.manages_classroom(target_classroom.classroom_id) then
        raise exception 'You do not have permission to add students to this classroom.';
    end if;

    if target_classroom.classroom_status <> 'active' or target_classroom.course_status in ('archived', 'deleted') then
        raise exception 'Students cannot be added to an archived or deleted classroom.';
    end if;

    select profile.id, profile.email
    into target_profile
    from public.profiles as profile
    where lower(profile.email) = normalized_email
        and profile.account_status = 'active'
    limit 1;

    if target_profile.id is null then
        raise exception 'No active student profile was found for that email. Share the classroom invite link instead.';
    end if;

    select enrollment.id, enrollment.enrollment_status
    into existing_enrollment
    from public.enrollments as enrollment
    where enrollment.user_id = target_profile.id
        and enrollment.classroom_id = target_classroom.classroom_id
        and enrollment.enrollment_type = 'classroom'
    limit 1;

    if existing_enrollment.id is null then
        insert into public.enrollments (
            user_id,
            course_id,
            classroom_id,
            enrollment_type,
            enrollment_status
        )
        values (
            target_profile.id,
            target_classroom.course_id,
            target_classroom.classroom_id,
            'classroom',
            'active'
        )
        returning id into final_enrollment_id;
    elsif existing_enrollment.enrollment_status = 'removed' then
        update public.enrollments
        set enrollment_status = 'active'
        where id = existing_enrollment.id
        returning id into final_enrollment_id;
    else
        final_enrollment_id := existing_enrollment.id;
    end if;

    return query select
        final_enrollment_id,
        target_profile.id,
        target_profile.email,
        'active'::text;
end;
$$;

revoke all on function public.add_student_to_classroom_by_email(uuid, text) from public;
grant execute on function public.add_student_to_classroom_by_email(uuid, text) to authenticated;
