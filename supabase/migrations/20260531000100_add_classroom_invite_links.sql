create or replace function public.preview_classroom_join_by_invite(invite_token_input text)
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
    normalized_token text;
    joining_profile_id uuid;
begin
    normalized_token := nullif(btrim(coalesce(invite_token_input, '')), '');
    joining_profile_id := public.current_profile_id();

    if normalized_token is null then
        raise exception 'This invite link is missing its invite token.';
    end if;

    if joining_profile_id is null then
        raise exception 'Complete your profile before joining a classroom.';
    end if;

    return query
    select
        classroom.course_id,
        classroom.id as classroom_id,
        classroom.name as classroom_name,
        course.title as course_title,
        classroom.join_enabled as is_joining_open,
        exists (
            select 1
            from public.enrollments as enrollment
            where enrollment.user_id = joining_profile_id
                and enrollment.classroom_id = classroom.id
                and enrollment.enrollment_type = 'classroom'
                and enrollment.enrollment_status <> 'removed'
        ) as already_enrolled
    from public.classrooms as classroom
    join public.courses as course
        on course.id = classroom.course_id
    where classroom.invite_token = normalized_token
        and classroom.status = 'active'
        and course.status <> 'deleted'
    limit 1;

    if not found then
        raise exception 'That invite link was not found.';
    end if;
end;
$$;

create or replace function public.join_classroom_by_invite(invite_token_input text)
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
    normalized_token text;
    joining_profile_id uuid;
    target_classroom record;
    existing_enrollment record;
    final_enrollment_id uuid;
begin
    normalized_token := nullif(btrim(coalesce(invite_token_input, '')), '');
    joining_profile_id := public.current_profile_id();

    if normalized_token is null then
        raise exception 'This invite link is missing its invite token.';
    end if;

    if joining_profile_id is null then
        raise exception 'Complete your profile before joining a classroom.';
    end if;

    select
        classroom.id as classroom_id,
        classroom.course_id,
        classroom.name as classroom_name,
        classroom.join_enabled,
        course.title as course_title
    into target_classroom
    from public.classrooms as classroom
    join public.courses as course
        on course.id = classroom.course_id
    where classroom.invite_token = normalized_token
        and classroom.status = 'active'
        and course.status <> 'deleted'
    limit 1;

    if target_classroom.classroom_id is null then
        raise exception 'That invite link was not found.';
    end if;

    if not target_classroom.join_enabled then
        raise exception 'Joining is closed for this classroom.';
    end if;

    select enrollment.id, enrollment.enrollment_status
    into existing_enrollment
    from public.enrollments as enrollment
    where enrollment.user_id = joining_profile_id
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
            joining_profile_id,
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
        target_classroom.course_id,
        target_classroom.classroom_id,
        target_classroom.classroom_name,
        target_classroom.course_title;
end;
$$;

revoke all on function public.preview_classroom_join_by_invite(text) from public;
grant execute on function public.preview_classroom_join_by_invite(text) to authenticated;

revoke all on function public.join_classroom_by_invite(text) from public;
grant execute on function public.join_classroom_by_invite(text) to authenticated;
