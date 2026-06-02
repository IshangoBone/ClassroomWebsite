create function public.get_admin_platform_analytics()
returns table (
    total_users bigint,
    active_users bigint,
    teacher_users bigint,
    student_users bigint,
    total_courses bigint,
    published_courses bigint,
    private_courses bigint,
    draft_courses bigint,
    archived_courses bigint,
    total_classrooms bigint,
    active_classrooms bigint,
    archived_classrooms bigint,
    total_enrollments bigint,
    total_submissions bigint,
    submitted_submissions bigint,
    draft_submissions bigint,
    engagement_points numeric,
    completion_rate numeric,
    new_users_this_week bigint,
    new_courses_this_month bigint,
    new_classrooms_this_month bigint,
    active_users_this_week bigint,
    suspended_users bigint,
    deleted_users bigint,
    deleted_courses bigint,
    deleted_classrooms bigint,
    top_teachers_json jsonb,
    top_courses_json jsonb,
    status_breakdown_json jsonb,
    growth_7d_json jsonb
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
    ),
    submission_counts as (
        select
            count(*) as total_count,
            count(*) filter (where status = 'submitted') as submitted_count,
            count(*) filter (where status = 'draft') as draft_count,
            coalesce(sum(points_earned), 0) as total_points
        from public.lesson_submissions
    ),
    top_teachers as (
        select
            profile.id,
            coalesce(
                nullif(btrim(concat_ws(' ', profile.legal_first_name, profile.legal_last_name)), ''),
                profile.username,
                profile.email,
                profile.id::text
            )::text as display_name,
            profile.email,
            (
                select count(*)
                from public.courses as course
                where course.owner_user_id = profile.id
            ) as course_count,
            (
                select count(*)
                from public.classrooms as classroom
                where classroom.owner_teacher_id = profile.id
            ) as classroom_count,
            (
                select count(*)
                from public.lesson_submissions as submission
                join public.courses as course
                    on course.id = submission.course_id
                where course.owner_user_id = profile.id
                    and submission.status = 'submitted'
            ) as submitted_count
        from public.profiles as profile
        where profile.id in (select profile_id from teacher_profiles)
        order by submitted_count desc, classroom_count desc, course_count desc, display_name
        limit 5
    ),
    top_courses as (
        select
            course.id,
            coalesce(course.title, course.id::text)::text as title,
            course.status,
            owner.email as owner_email,
            (
                select count(*)
                from public.enrollments as enrollment
                where enrollment.course_id = course.id
                    and enrollment.enrollment_status <> 'removed'
            ) as enrollment_count,
            (
                select count(*)
                from public.lesson_submissions as submission
                where submission.course_id = course.id
                    and submission.status = 'submitted'
            ) as submitted_count
        from public.courses as course
        left join public.profiles as owner
            on owner.id = course.owner_user_id
        where course.status <> 'deleted'
        order by submitted_count desc, enrollment_count desc, course.updated_at desc
        limit 5
    ),
    status_breakdown as (
        select 'users_active'::text as key, count(*)::numeric as value from public.profiles where account_status = 'active'
        union all
        select 'users_suspended', count(*)::numeric from public.profiles where account_status = 'suspended'
        union all
        select 'users_deleted', count(*)::numeric from public.profiles where account_status = 'deleted'
        union all
        select 'courses_published', count(*)::numeric from public.courses where status = 'published'
        union all
        select 'courses_private', count(*)::numeric from public.courses where status = 'private'
        union all
        select 'courses_archived', count(*)::numeric from public.courses where status = 'archived'
        union all
        select 'classrooms_active', count(*)::numeric from public.classrooms where status = 'active'
        union all
        select 'classrooms_archived', count(*)::numeric from public.classrooms where status = 'archived'
    ),
    growth_days as (
        select generate_series(current_date - interval '6 days', current_date, interval '1 day')::date as day
    ),
    growth_7d as (
        select
            growth_days.day,
            (
                select count(*)
                from public.profiles as profile
                where profile.created_at::date = growth_days.day
            ) as new_users,
            (
                select count(distinct activity.actor_user_id)
                from public.activity_logs as activity
                where activity.created_at::date = growth_days.day
                    and activity.actor_user_id is not null
            ) as active_users
        from growth_days
    )
    select
        (select count(*) from public.profiles) as total_users,
        (select count(*) from public.profiles where account_status = 'active') as active_users,
        (select count(distinct profile_id) from teacher_profiles) as teacher_users,
        (select count(distinct profile_id) from student_profiles) as student_users,
        (select count(*) from public.courses where status <> 'deleted') as total_courses,
        (select count(*) from public.courses where status = 'published') as published_courses,
        (select count(*) from public.courses where status = 'private') as private_courses,
        (select count(*) from public.courses where status = 'draft') as draft_courses,
        (select count(*) from public.courses where status = 'archived') as archived_courses,
        (select count(*) from public.classrooms where status <> 'deleted') as total_classrooms,
        (select count(*) from public.classrooms where status = 'active') as active_classrooms,
        (select count(*) from public.classrooms where status = 'archived') as archived_classrooms,
        (select count(*) from public.enrollments where enrollment_status <> 'removed') as total_enrollments,
        submission_counts.total_count as total_submissions,
        submission_counts.submitted_count as submitted_submissions,
        submission_counts.draft_count as draft_submissions,
        submission_counts.total_points as engagement_points,
        case
            when submission_counts.total_count = 0 then 0
            else round((submission_counts.submitted_count::numeric / submission_counts.total_count::numeric) * 100, 1)
        end as completion_rate,
        (select count(*) from public.profiles where created_at >= now() - interval '7 days') as new_users_this_week,
        (select count(*) from public.courses where created_at >= now() - interval '30 days') as new_courses_this_month,
        (select count(*) from public.classrooms where created_at >= now() - interval '30 days') as new_classrooms_this_month,
        (
            select count(distinct actor_user_id)
            from public.activity_logs
            where created_at >= now() - interval '7 days'
                and actor_user_id is not null
        ) as active_users_this_week,
        (select count(*) from public.profiles where account_status = 'suspended') as suspended_users,
        (select count(*) from public.profiles where account_status = 'deleted') as deleted_users,
        (select count(*) from public.courses where status = 'deleted') as deleted_courses,
        (select count(*) from public.classrooms where status = 'deleted') as deleted_classrooms,
        coalesce((
            select jsonb_agg(to_jsonb(top_teachers.*))
            from top_teachers
        ), '[]'::jsonb) as top_teachers_json,
        coalesce((
            select jsonb_agg(to_jsonb(top_courses.*))
            from top_courses
        ), '[]'::jsonb) as top_courses_json,
        coalesce((
            select jsonb_agg(to_jsonb(status_breakdown.*))
            from status_breakdown
        ), '[]'::jsonb) as status_breakdown_json,
        coalesce((
            select jsonb_agg(to_jsonb(growth_7d.*) order by growth_7d.day)
            from growth_7d
        ), '[]'::jsonb) as growth_7d_json
    from submission_counts
    where public.is_platform_admin();
$$;

revoke all on function public.get_admin_platform_analytics() from public;
grant execute on function public.get_admin_platform_analytics() to authenticated;
