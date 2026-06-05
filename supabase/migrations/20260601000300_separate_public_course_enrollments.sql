create or replace function public.preview_public_course_join(course_id_input uuid)
returns table (
    course_id uuid,
    classroom_id uuid,
    classroom_name text,
    course_title text,
    is_joining_open boolean,
    already_enrolled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    joining_profile_id uuid;
begin
    joining_profile_id := public.current_profile_id();

    if course_id_input is null then
        raise exception 'This course link is missing its course id.';
    end if;

    if joining_profile_id is null then
        raise exception 'Complete your profile before joining a course.';
    end if;

    return query
    select
        course.id as course_id,
        null::uuid as classroom_id,
        null::text as classroom_name,
        course.title as course_title,
        true as is_joining_open,
        exists (
            select 1
            from public.enrollments as enrollment
            where enrollment.user_id = joining_profile_id
                and enrollment.course_id = course.id
                and enrollment.enrollment_type = 'course'
                and enrollment.classroom_id is null
                and enrollment.enrollment_status <> 'removed'
        ) as already_enrolled
    from public.courses as course
    where course.id = course_id_input
        and course.status = 'published'
    limit 1;

    if not found then
        raise exception 'That public course was not found.';
    end if;
end;
$$;

create or replace function public.join_public_course(course_id_input uuid)
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
    joining_profile_id uuid;
    target_course record;
    existing_enrollment record;
    final_enrollment_id uuid;
begin
    joining_profile_id := public.current_profile_id();

    if course_id_input is null then
        raise exception 'This course link is missing its course id.';
    end if;

    if joining_profile_id is null then
        raise exception 'Complete your profile before joining a course.';
    end if;

    select course.id, course.title
    into target_course
    from public.courses as course
    where course.id = course_id_input
        and course.status = 'published'
    limit 1;

    if target_course.id is null then
        raise exception 'That public course was not found.';
    end if;

    select enrollment.id, enrollment.enrollment_status
    into existing_enrollment
    from public.enrollments as enrollment
    where enrollment.user_id = joining_profile_id
        and enrollment.course_id = target_course.id
        and enrollment.enrollment_type = 'course'
        and enrollment.classroom_id is null
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
            joining_profile_id,
            target_course.id,
            null,
            'course',
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
        target_course.id,
        null::uuid,
        null::text,
        target_course.title;
end;
$$;

revoke all on function public.preview_public_course_join(uuid) from public;
grant execute on function public.preview_public_course_join(uuid) to authenticated;

revoke all on function public.join_public_course(uuid) from public;
grant execute on function public.join_public_course(uuid) to authenticated;
