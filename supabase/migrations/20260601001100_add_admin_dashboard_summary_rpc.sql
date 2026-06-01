create function public.get_admin_dashboard_summary()
returns table (
    total_users bigint,
    active_users bigint,
    teacher_users bigint,
    student_users bigint,
    total_courses bigint,
    published_courses bigint,
    archived_courses bigint,
    total_classrooms bigint,
    active_classrooms bigint,
    total_enrollments bigint,
    submissions_this_week bigint,
    new_signups_this_week bigint,
    suspended_users bigint,
    activity_this_week bigint
)
language sql
stable
security definer
set search_path = ''
as $$
    with teacher_profiles as (
        select owner_user_id as profile_id
        from public.courses
        union
        select owner_teacher_id as profile_id
        from public.classrooms
        union
        select user_id as profile_id
        from public.course_collaborators
        where permission_level in ('teacher', 'editor', 'co_owner')
        union
        select user_id as profile_id
        from public.classroom_teachers
    ),
    student_profiles as (
        select user_id as profile_id
        from public.enrollments
        where enrollment_status <> 'removed'
    )
    select
        (select count(*) from public.profiles) as total_users,
        (select count(*) from public.profiles where account_status = 'active') as active_users,
        (select count(distinct profile_id) from teacher_profiles) as teacher_users,
        (select count(distinct profile_id) from student_profiles) as student_users,
        (select count(*) from public.courses where status <> 'deleted') as total_courses,
        (select count(*) from public.courses where status = 'published') as published_courses,
        (select count(*) from public.courses where status = 'archived') as archived_courses,
        (select count(*) from public.classrooms where status <> 'deleted') as total_classrooms,
        (select count(*) from public.classrooms where status = 'active') as active_classrooms,
        (select count(*) from public.enrollments where enrollment_status <> 'removed') as total_enrollments,
        (
            select count(*)
            from public.lesson_submissions
            where status = 'submitted'
                and submitted_at >= now() - interval '7 days'
        ) as submissions_this_week,
        (
            select count(*)
            from public.profiles
            where created_at >= now() - interval '7 days'
        ) as new_signups_this_week,
        (select count(*) from public.profiles where account_status = 'suspended') as suspended_users,
        (
            select count(*)
            from public.activity_logs
            where created_at >= now() - interval '7 days'
        ) as activity_this_week
    where public.is_platform_admin();
$$;

revoke all on function public.get_admin_dashboard_summary() from public;
grant execute on function public.get_admin_dashboard_summary() to authenticated;
