grant update (join_code, invite_token) on table public.classrooms to authenticated;

create or replace function public.join_classroom_by_code(join_code_input text)
returns table (
    enrollment_id uuid,
    course_id uuid,
    classroom_id uuid,
    classroom_name text,
    course_title text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    normalized_code text;
    joining_profile_id uuid;
    target_classroom record;
    existing_enrollment_id uuid;
begin
    normalized_code := upper(regexp_replace(coalesce(join_code_input, ''), '\s+', '', 'g'));
    joining_profile_id := public.current_profile_id();

    if normalized_code = '' then
        raise exception 'Enter a join code.';
    end if;

    if joining_profile_id is null then
        raise exception 'Complete your profile before joining a classroom.';
    end if;

    select
        classroom.id as classroom_id,
        classroom.course_id,
        classroom.name as classroom_name,
        course.title as course_title
    into target_classroom
    from public.classrooms as classroom
    join public.courses as course
        on course.id = classroom.course_id
    where upper(classroom.join_code) = normalized_code
        and classroom.status = 'active'
        and course.status <> 'deleted'
    limit 1;

    if target_classroom.classroom_id is null then
        raise exception 'That join code was not found.';
    end if;

    select enrollment.id
    into existing_enrollment_id
    from public.enrollments as enrollment
    where enrollment.user_id = joining_profile_id
        and enrollment.classroom_id = target_classroom.classroom_id
        and enrollment.enrollment_type = 'classroom'
    limit 1;

    if existing_enrollment_id is null then
        insert into public.enrollments (
            user_id,
            course_id,
            classroom_id,
            enrollment_type,
            enrollment_status
        )
        values (
            joining_profile_id,
            target_classroom.course_id,
            target_classroom.classroom_id,
            'classroom',
            'active'
        )
        returning id into existing_enrollment_id;
    else
        update public.enrollments
        set enrollment_status = 'active'
        where id = existing_enrollment_id;
    end if;

    return query select
        existing_enrollment_id,
        target_classroom.course_id,
        target_classroom.classroom_id,
        target_classroom.classroom_name,
        target_classroom.course_title;
end;
$$;

revoke all on function public.join_classroom_by_code(text) from public;
grant execute on function public.join_classroom_by_code(text) to authenticated;
