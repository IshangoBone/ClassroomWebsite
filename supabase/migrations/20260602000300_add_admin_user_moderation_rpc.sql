create function public.get_admin_user_moderation_records(
    status_filter text default '',
    role_filter text default '',
    search_input text default '',
    limit_input integer default 100
)
returns table (
    user_id uuid,
    display_name text,
    email text,
    username text,
    platform_role text,
    account_status text,
    profile_completed boolean,
    courses_owned bigint,
    classrooms_managed bigint,
    enrollments bigint,
    submissions bigint,
    activity_count bigint,
    last_activity_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    with filters as (
        select
            nullif(btrim(lower(coalesce(status_filter, ''))), '') as status_value,
            nullif(btrim(lower(coalesce(role_filter, ''))), '') as role_value,
            nullif(btrim(lower(coalesce(search_input, ''))), '') as search_value
    )
    select
        profile.id as user_id,
        coalesce(
            nullif(btrim(concat_ws(' ', profile.legal_first_name, profile.legal_last_name)), ''),
            profile.username,
            profile.email,
            profile.id::text
        )::text as display_name,
        profile.email,
        profile.username,
        profile.platform_role,
        profile.account_status,
        profile.profile_completed,
        (
            select count(*)
            from public.courses as course
            where course.owner_user_id = profile.id
        ) as courses_owned,
        (
            select count(*)
            from public.classrooms as classroom
            where classroom.owner_teacher_id = profile.id
        ) as classrooms_managed,
        (
            select count(*)
            from public.enrollments as enrollment
            where enrollment.user_id = profile.id
        ) as enrollments,
        (
            select count(*)
            from public.lesson_submissions as submission
            where submission.student_user_id = profile.id
        ) as submissions,
        (
            select count(*)
            from public.activity_logs as activity
            where activity.actor_user_id = profile.id
                or (
                    activity.target_type = 'user'
                    and activity.target_id = profile.id
                )
        ) as activity_count,
        (
            select max(activity.created_at)
            from public.activity_logs as activity
            where activity.actor_user_id = profile.id
                or (
                    activity.target_type = 'user'
                    and activity.target_id = profile.id
                )
        ) as last_activity_at,
        profile.created_at,
        profile.updated_at
    from public.profiles as profile
    cross join filters
    where public.is_platform_admin()
        and (
            filters.status_value is null
            or profile.account_status = filters.status_value
        )
        and (
            filters.role_value is null
            or profile.platform_role = filters.role_value
        )
        and (
            filters.search_value is null
            or profile.email ilike '%' || filters.search_value || '%'
            or profile.username ilike '%' || filters.search_value || '%'
            or profile.legal_first_name ilike '%' || filters.search_value || '%'
            or profile.legal_last_name ilike '%' || filters.search_value || '%'
            or profile.id::text ilike '%' || filters.search_value || '%'
        )
    order by
        case profile.account_status
            when 'suspended' then 0
            when 'deleted' then 1
            else 2
        end,
        profile.updated_at desc
    limit least(greatest(coalesce(limit_input, 100), 1), 200);
$$;

revoke all on function public.get_admin_user_moderation_records(text, text, text, integer) from public;
grant execute on function public.get_admin_user_moderation_records(text, text, text, integer) to authenticated;
